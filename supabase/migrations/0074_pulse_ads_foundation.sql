-- Pulse Ads v1: owned sponsored inventory for the Faucet-first economic loop.
-- Compatible with release schema v55 / 0055. This migration does not change
-- Pulse reward amount, Treasury values, payout authority, claim eligibility,
-- Direct campaign settlement, or the canonical release marker.

create table if not exists public.pulse_ads_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  checkout_reference uuid not null unique default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 90),
  body text not null check (char_length(trim(body)) between 1 and 220),
  destination_url text not null check (destination_url ~ '^https://'),
  status text not null default 'pending_review'
    check (status in ('pending_review','approved','active','paused','exhausted','rejected','cancelled')),
  pricing_model text not null default 'cpc' check (pricing_model = 'cpc'),
  budget_usd_micros bigint not null check (budget_usd_micros between 5000000 and 5000000000),
  funded_usd_micros bigint not null default 0 check (funded_usd_micros >= 0),
  spent_usd_micros bigint not null default 0 check (spent_usd_micros >= 0),
  price_per_click_usd_micros bigint not null default 50000
    check (price_per_click_usd_micros between 10000 and 5000000),
  country_codes text[] not null default '{}',
  device_platforms text[] not null default '{}',
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (funded_usd_micros <= budget_usd_micros),
  check (spent_usd_micros <= funded_usd_micros)
);

create table if not exists public.pulse_ads_funding_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.pulse_ads_campaigns(id) on delete restrict,
  provider text not null default 'faucetpay_merchant' check (provider = 'faucetpay_merchant'),
  provider_transaction_id text not null unique check (char_length(trim(provider_transaction_id)) between 1 and 160),
  amount_usd_micros bigint not null check (amount_usd_micros > 0),
  pricing_currency text not null default 'USDT' check (pricing_currency = 'USDT'),
  created_at timestamptz not null default now()
);

create table if not exists public.pulse_ads_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.pulse_ads_campaigns(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('served','click')),
  event_day date not null default ((now() at time zone 'utc')::date),
  billable_usd_micros bigint not null default 0 check (billable_usd_micros >= 0),
  created_at timestamptz not null default now(),
  unique (campaign_id, user_id, event_type, event_day)
);

create table if not exists public.pulse_ads_merchant_callbacks (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  provider_transaction_id text,
  custom_reference text,
  state text not null default 'pending' check (state in ('pending','verified','rejected')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pulse_ads_campaigns_status_budget_idx
  on public.pulse_ads_campaigns(status, spent_usd_micros, created_at);
create index if not exists pulse_ads_campaigns_owner_created_idx
  on public.pulse_ads_campaigns(owner_user_id, created_at desc);
create index if not exists pulse_ads_events_campaign_type_day_idx
  on public.pulse_ads_events(campaign_id, event_type, event_day desc);
create index if not exists pulse_ads_events_user_day_idx
  on public.pulse_ads_events(user_id, event_day desc);
create index if not exists pulse_ads_funding_campaign_created_idx
  on public.pulse_ads_funding_events(campaign_id, created_at desc);

alter table public.pulse_ads_campaigns enable row level security;
alter table public.pulse_ads_funding_events enable row level security;
alter table public.pulse_ads_events enable row level security;
alter table public.pulse_ads_merchant_callbacks enable row level security;

revoke all on table public.pulse_ads_campaigns from public, anon, authenticated;
revoke all on table public.pulse_ads_funding_events from public, anon, authenticated;
revoke all on table public.pulse_ads_events from public, anon, authenticated;
revoke all on table public.pulse_ads_merchant_callbacks from public, anon, authenticated;

grant select, insert, update, delete on table public.pulse_ads_campaigns to service_role;
grant select, insert, update, delete on table public.pulse_ads_funding_events to service_role;
grant select, insert, update, delete on table public.pulse_ads_events to service_role;
grant select, insert, update, delete on table public.pulse_ads_merchant_callbacks to service_role;

create or replace function public.create_pulse_ads_campaign(
  p_owner_user_id uuid,
  p_title text,
  p_body text,
  p_destination_url text,
  p_budget_usd_micros bigint,
  p_country_codes text[] default '{}',
  p_device_platforms text[] default '{}'
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_campaign public.pulse_ads_campaigns%rowtype;
  v_countries text[] := array(
    select upper(trim(value))
    from unnest(coalesce(p_country_codes, '{}')) as item(value)
    where trim(value) ~ '^[A-Za-z]{2}$'
    limit 24
  );
  v_devices text[] := array(
    select lower(trim(value))
    from unnest(coalesce(p_device_platforms, '{}')) as item(value)
    where lower(trim(value)) in ('mobile','desktop')
    limit 2
  );
begin
  if p_owner_user_id is null
     or not exists (select 1 from public.profiles where id = p_owner_user_id)
     or char_length(trim(coalesce(p_title, ''))) not between 3 and 90
     or char_length(trim(coalesce(p_body, ''))) not between 1 and 220
     or coalesce(trim(p_destination_url), '') !~ '^https://'
     or p_budget_usd_micros is null
     or p_budget_usd_micros < 5000000
     or p_budget_usd_micros > 5000000000 then
    return jsonb_build_object('status','invalid_request');
  end if;

  insert into public.pulse_ads_campaigns(
    owner_user_id, title, body, destination_url, budget_usd_micros,
    country_codes, device_platforms
  ) values (
    p_owner_user_id,
    trim(p_title),
    trim(p_body),
    trim(p_destination_url),
    p_budget_usd_micros,
    coalesce(v_countries, '{}'),
    coalesce(v_devices, '{}')
  )
  returning * into v_campaign;

  return jsonb_build_object(
    'status','pending_review',
    'campaign_id',v_campaign.id,
    'checkout_reference',v_campaign.checkout_reference,
    'budget_usd_micros',v_campaign.budget_usd_micros,
    'price_per_click_usd_micros',v_campaign.price_per_click_usd_micros
  );
end;
$$;

create or replace function public.review_pulse_ads_campaign(
  p_campaign_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_campaign public.pulse_ads_campaigns%rowtype;
begin
  select * into v_campaign
  from public.pulse_ads_campaigns
  where id = p_campaign_id
  for update;

  if not found then return jsonb_build_object('status','not_found'); end if;
  if v_campaign.status <> 'pending_review' then return jsonb_build_object('status','not_reviewable'); end if;

  update public.pulse_ads_campaigns
  set status = case when coalesce(p_approve,false) then 'approved' else 'rejected' end,
      review_note = nullif(left(trim(coalesce(p_note,'')),500),''),
      reviewed_at = now(),
      updated_at = now()
  where id = p_campaign_id
  returning * into v_campaign;

  return jsonb_build_object('status',v_campaign.status,'campaign_id',v_campaign.id);
end;
$$;

create or replace function public.record_verified_pulse_ads_payment(
  p_campaign_id uuid,
  p_checkout_reference uuid,
  p_provider_transaction_id text,
  p_amount_usd_micros bigint,
  p_pricing_currency text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_campaign public.pulse_ads_campaigns%rowtype;
begin
  if p_campaign_id is null
     or p_checkout_reference is null
     or coalesce(trim(p_provider_transaction_id),'') = ''
     or p_amount_usd_micros is null
     or p_amount_usd_micros <= 0
     or upper(coalesce(trim(p_pricing_currency),'')) <> 'USDT' then
    return jsonb_build_object('status','invalid_payment');
  end if;

  if exists (
    select 1 from public.pulse_ads_funding_events
    where provider_transaction_id = trim(p_provider_transaction_id)
  ) then
    return jsonb_build_object('status','idempotent');
  end if;

  select * into v_campaign
  from public.pulse_ads_campaigns
  where id = p_campaign_id
    and checkout_reference = p_checkout_reference
  for update;

  if not found then return jsonb_build_object('status','campaign_mismatch'); end if;
  if v_campaign.status <> 'approved' then return jsonb_build_object('status','campaign_not_payable'); end if;
  if v_campaign.funded_usd_micros <> 0 then return jsonb_build_object('status','already_funded'); end if;
  if p_amount_usd_micros <> v_campaign.budget_usd_micros then return jsonb_build_object('status','amount_mismatch'); end if;

  insert into public.pulse_ads_funding_events(
    campaign_id, provider_transaction_id, amount_usd_micros, pricing_currency
  ) values (
    v_campaign.id, trim(p_provider_transaction_id), p_amount_usd_micros, 'USDT'
  );

  update public.pulse_ads_campaigns
  set funded_usd_micros = p_amount_usd_micros,
      status = 'active',
      updated_at = now()
  where id = v_campaign.id;

  return jsonb_build_object(
    'status','active',
    'campaign_id',v_campaign.id,
    'funded_usd_micros',p_amount_usd_micros
  );
end;
$$;

create or replace function public.serve_pulse_ad(
  p_user_id uuid,
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
     or not exists (select 1 from public.profiles where id = p_user_id) then
    return jsonb_build_object('status','unavailable');
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

  insert into public.pulse_ads_events(campaign_id,user_id,event_type,event_day)
  values (v_campaign.id,p_user_id,'served',v_day)
  on conflict (campaign_id,user_id,event_type,event_day) do nothing;

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
begin
  if p_campaign_id is null or p_user_id is null then
    return jsonb_build_object('status','invalid_request');
  end if;

  select * into v_campaign
  from public.pulse_ads_campaigns
  where id = p_campaign_id
  for update;

  if not found then return jsonb_build_object('status','not_found'); end if;
  if v_campaign.owner_user_id = p_user_id then return jsonb_build_object('status','owner_click_rejected'); end if;
  if v_campaign.status <> 'active' then return jsonb_build_object('status','not_active'); end if;
  if v_campaign.funded_usd_micros - v_campaign.spent_usd_micros < v_campaign.price_per_click_usd_micros then
    update public.pulse_ads_campaigns set status='exhausted', updated_at=now() where id=v_campaign.id;
    return jsonb_build_object('status','exhausted');
  end if;
  if not exists (
    select 1 from public.pulse_ads_events
    where campaign_id=v_campaign.id
      and user_id=p_user_id
      and event_type='served'
      and event_day=v_day
  ) then
    return jsonb_build_object('status','not_served');
  end if;

  insert into public.pulse_ads_events(
    campaign_id,user_id,event_type,event_day,billable_usd_micros
  ) values (
    v_campaign.id,p_user_id,'click',v_day,v_campaign.price_per_click_usd_micros
  )
  on conflict (campaign_id,user_id,event_type,event_day) do nothing
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
    update public.pulse_ads_campaigns set status='exhausted', updated_at=now() where id=v_campaign.id;
  end if;

  return jsonb_build_object(
    'status','clicked',
    'destination_url',v_campaign.destination_url,
    'billed_usd_micros',v_campaign.price_per_click_usd_micros
  );
end;
$$;

create or replace function public.user_pulse_ads_snapshot(p_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'status','ok',
    'campaigns',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,
        'checkout_reference',c.checkout_reference,
        'title',c.title,
        'body',c.body,
        'destination_url',c.destination_url,
        'status',c.status,
        'budget_usd_micros',c.budget_usd_micros,
        'funded_usd_micros',c.funded_usd_micros,
        'spent_usd_micros',c.spent_usd_micros,
        'price_per_click_usd_micros',c.price_per_click_usd_micros,
        'served',coalesce((select count(*) from public.pulse_ads_events e where e.campaign_id=c.id and e.event_type='served'),0),
        'clicks',coalesce((select count(*) from public.pulse_ads_events e where e.campaign_id=c.id and e.event_type='click'),0),
        'review_note',c.review_note,
        'created_at',c.created_at
      ) order by c.created_at desc)
      from public.pulse_ads_campaigns c
      where c.owner_user_id = p_user_id
    ),'[]'::jsonb)
  );
$$;

create or replace function public.admin_pulse_ads_snapshot()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'status','ok',
    'campaign_count',(select count(*) from public.pulse_ads_campaigns),
    'pending_review',(select count(*) from public.pulse_ads_campaigns where status='pending_review'),
    'active_count',(select count(*) from public.pulse_ads_campaigns where status='active'),
    'funded_usd_micros',coalesce((select sum(funded_usd_micros) from public.pulse_ads_campaigns),0),
    'spent_usd_micros',coalesce((select sum(spent_usd_micros) from public.pulse_ads_campaigns),0),
    'served',(select count(*) from public.pulse_ads_events where event_type='served'),
    'clicks',(select count(*) from public.pulse_ads_events where event_type='click'),
    'campaigns',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,
        'owner_user_id',c.owner_user_id,
        'title',c.title,
        'body',c.body,
        'destination_url',c.destination_url,
        'status',c.status,
        'budget_usd_micros',c.budget_usd_micros,
        'funded_usd_micros',c.funded_usd_micros,
        'spent_usd_micros',c.spent_usd_micros,
        'price_per_click_usd_micros',c.price_per_click_usd_micros,
        'country_codes',c.country_codes,
        'device_platforms',c.device_platforms,
        'served',coalesce((select count(*) from public.pulse_ads_events e where e.campaign_id=c.id and e.event_type='served'),0),
        'clicks',coalesce((select count(*) from public.pulse_ads_events e where e.campaign_id=c.id and e.event_type='click'),0),
        'review_note',c.review_note,
        'created_at',c.created_at
      ) order by case when c.status='pending_review' then 0 else 1 end, c.created_at desc)
      from public.pulse_ads_campaigns c
    ),'[]'::jsonb)
  );
$$;

revoke all on function public.create_pulse_ads_campaign(uuid,text,text,text,bigint,text[],text[]) from public, anon, authenticated, service_role;
revoke all on function public.review_pulse_ads_campaign(uuid,boolean,text) from public, anon, authenticated, service_role;
revoke all on function public.record_verified_pulse_ads_payment(uuid,uuid,text,bigint,text) from public, anon, authenticated, service_role;
revoke all on function public.serve_pulse_ad(uuid,text,text) from public, anon, authenticated, service_role;
revoke all on function public.click_pulse_ad(uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.user_pulse_ads_snapshot(uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_pulse_ads_snapshot() from public, anon, authenticated, service_role;

grant execute on function public.create_pulse_ads_campaign(uuid,text,text,text,bigint,text[],text[]) to service_role;
grant execute on function public.review_pulse_ads_campaign(uuid,boolean,text) to service_role;
grant execute on function public.record_verified_pulse_ads_payment(uuid,uuid,text,bigint,text) to service_role;
grant execute on function public.serve_pulse_ad(uuid,text,text) to service_role;
grant execute on function public.click_pulse_ad(uuid,uuid) to service_role;
grant execute on function public.user_pulse_ads_snapshot(uuid) to service_role;
grant execute on function public.admin_pulse_ads_snapshot() to service_role;

comment on table public.pulse_ads_campaigns is
  'Operator-reviewed, advertiser-funded native sponsored campaigns. Pulse claim and payout authority are intentionally separate.';
comment on table public.pulse_ads_events is
  'Privacy-minimized internal sponsored inventory events. No IP, user-agent, email, balance or payout destination is stored.';
