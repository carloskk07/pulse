-- Bind each sponsored placement to the real Pulse claim that unlocked it.
-- One successful claim can create at most one sponsored serve event. Refreshes
-- cannot rotate through inventory or inflate served metrics.
-- Does not change Pulse reward, Treasury, payout, or release_schema authority.

alter table public.pulse_ads_events
  add column if not exists pulse_claim_id uuid references public.pulse_claims(id) on delete restrict;

create unique index if not exists pulse_ads_events_claim_type_unique
  on public.pulse_ads_events(user_id, pulse_claim_id, event_type)
  where pulse_claim_id is not null;

create index if not exists pulse_ads_events_claim_idx
  on public.pulse_ads_events(pulse_claim_id, created_at desc)
  where pulse_claim_id is not null;

drop function if exists public.serve_pulse_ad(uuid,text,text);

create or replace function public.serve_pulse_ad(
  p_user_id uuid,
  p_pulse_claim_id uuid,
  p_country_code text default null,
  p_device_platform text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_campaign public.pulse_ads_campaigns%rowtype;
  v_country text := upper(trim(coalesce(p_country_code,'')));
  v_device text := lower(trim(coalesce(p_device_platform,'')));
  v_day date := (now() at time zone 'utc')::date;
begin
  if p_user_id is null
     or p_pulse_claim_id is null
     or not exists (
       select 1
       from public.pulse_claims pc
       where pc.id = p_pulse_claim_id
         and pc.user_id = p_user_id
         and pc.created_at <= now() + interval '30 seconds'
         and pc.created_at >= now() - interval '10 minutes'
     ) then
    return jsonb_build_object('status','unavailable');
  end if;

  if exists (
    select 1
    from public.pulse_ads_events e
    where e.user_id = p_user_id
      and e.pulse_claim_id = p_pulse_claim_id
      and e.event_type = 'served'
  ) then
    return jsonb_build_object('status','already_served');
  end if;

  select c.* into v_campaign
  from public.pulse_ads_campaigns c
  where c.status = 'active'
    and c.owner_user_id <> p_user_id
    and c.funded_usd_micros - c.spent_usd_micros >= c.price_per_click_usd_micros
    and (
      cardinality(c.country_codes) = 0
      or (v_country ~ '^[A-Z]{2}$' and v_country = any(c.country_codes))
    )
    and (
      cardinality(c.device_platforms) = 0
      or (v_device in ('mobile','desktop') and v_device = any(c.device_platforms))
    )
    and not exists (
      select 1
      from public.pulse_ads_events e
      where e.campaign_id = c.id
        and e.user_id = p_user_id
        and e.event_type = 'served'
        and e.event_day = v_day
    )
  order by
    (c.spent_usd_micros::numeric / greatest(c.funded_usd_micros,1)) asc,
    c.created_at asc
  limit 1;

  if not found then return jsonb_build_object('status','empty'); end if;

  insert into public.pulse_ads_events(
    campaign_id,user_id,pulse_claim_id,event_type,event_day
  )
  values (
    v_campaign.id,p_user_id,p_pulse_claim_id,'served',v_day
  )
  on conflict do nothing;

  if not found then
    return jsonb_build_object('status','already_served');
  end if;

  return jsonb_build_object(
    'status','served',
    'campaign_id',v_campaign.id,
    'title',v_campaign.title,
    'body',v_campaign.body,
    'pricing_model',v_campaign.pricing_model
  );
end;
$$;

create or replace function public.click_pulse_ad(
  p_campaign_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_campaign public.pulse_ads_campaigns%rowtype;
  v_day date := (now() at time zone 'utc')::date;
  v_inserted uuid;
  v_remaining bigint;
  v_claim_id uuid;
begin
  if p_campaign_id is null or p_user_id is null then
    return jsonb_build_object('status','invalid_request');
  end if;

  select * into v_campaign
  from public.pulse_ads_campaigns
  where id = p_campaign_id
  for update;

  if not found then return jsonb_build_object('status','not_found'); end if;
  if v_campaign.owner_user_id = p_user_id then
    return jsonb_build_object('status','owner_click_rejected');
  end if;
  if v_campaign.status <> 'active' then
    return jsonb_build_object('status','not_active');
  end if;
  if v_campaign.funded_usd_micros - v_campaign.spent_usd_micros
       < v_campaign.price_per_click_usd_micros then
    update public.pulse_ads_campaigns
    set status='exhausted', updated_at=now()
    where id=v_campaign.id;
    return jsonb_build_object('status','exhausted');
  end if;

  select e.pulse_claim_id into v_claim_id
  from public.pulse_ads_events e
  where e.campaign_id=v_campaign.id
    and e.user_id=p_user_id
    and e.event_type='served'
    and e.event_day=v_day
    and e.pulse_claim_id is not null
  order by e.created_at desc
  limit 1;

  if v_claim_id is null then
    return jsonb_build_object('status','not_served');
  end if;

  insert into public.pulse_ads_events(
    campaign_id,user_id,pulse_claim_id,event_type,event_day,billable_usd_micros
  ) values (
    v_campaign.id,p_user_id,v_claim_id,'click',v_day,v_campaign.price_per_click_usd_micros
  )
  on conflict do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return jsonb_build_object(
      'status','idempotent',
      'destination_url',v_campaign.destination_url,
      'billed_usd_micros',0
    );
  end if;

  update public.pulse_ads_campaigns
  set spent_usd_micros = spent_usd_micros + v_campaign.price_per_click_usd_micros,
      updated_at = now()
  where id = v_campaign.id
  returning funded_usd_micros - spent_usd_micros into v_remaining;

  if v_remaining < v_campaign.price_per_click_usd_micros then
    update public.pulse_ads_campaigns
    set status='exhausted', updated_at=now()
    where id=v_campaign.id;
  end if;

  return jsonb_build_object(
    'status','clicked',
    'destination_url',v_campaign.destination_url,
    'billed_usd_micros',v_campaign.price_per_click_usd_micros
  );
end;
$$;

revoke all on function public.serve_pulse_ad(uuid,uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.serve_pulse_ad(uuid,uuid,text,text) to service_role;

revoke all on function public.click_pulse_ad(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.click_pulse_ad(uuid,uuid) to service_role;

comment on column public.pulse_ads_events.pulse_claim_id is
  'Real Pulse claim that authorized the post-claim sponsored placement. Used to prevent refresh-driven inventory rotation.';
