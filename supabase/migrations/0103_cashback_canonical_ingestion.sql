-- V13.9 canonical cashback ingestion foundation.
-- Keeps cashback hidden until a verified affiliate offer is deliberately enabled,
-- while making tracking and settlement launch-ready behind service authority.
-- Canonical release schema remains v55/0055.

create table if not exists public.cashback_tracking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid not null references public.reward_opportunities(id) on delete restrict,
  provider text not null,
  status text not null default 'started'
    check (status in ('started','pending','confirmed','reversed')),
  last_external_id text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cashback_tracking_sessions enable row level security;

revoke all on table public.cashback_tracking_sessions
  from public, anon, authenticated;
grant select, insert, update, delete on table public.cashback_tracking_sessions
  to service_role;

create index if not exists cashback_tracking_user_created_idx
  on public.cashback_tracking_sessions(user_id, created_at desc);

create index if not exists cashback_tracking_opportunity_created_idx
  on public.cashback_tracking_sessions(opportunity_id, created_at desc);

create or replace function public.create_cashback_tracking_session(
  p_user_id uuid,
  p_opportunity_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_config jsonb := '{}'::jsonb;
  v_enabled boolean := false;
  v_row public.reward_opportunities%rowtype;
  v_destination text;
  v_tracking_param text;
  v_tracking_id uuid;
begin
  if p_user_id is null or p_opportunity_id is null then
    return jsonb_build_object('status','invalid');
  end if;

  select coalesce(value,'{}'::jsonb)
  into v_config
  from public.app_config
  where key='pulse_economy_v13';

  v_enabled := lower(coalesce(v_config->>'cashback_enabled','false'))
    in ('true','1','yes','on');

  if not v_enabled then
    return jsonb_build_object('status','cashback_disabled');
  end if;

  if not exists(select 1 from public.profiles where id=p_user_id) then
    return jsonb_build_object('status','unknown_user');
  end if;

  select *
  into v_row
  from public.reward_opportunities
  where id=p_opportunity_id
    and source_type='affiliate'
    and status='active'
    and health_state <> 'hidden'
    and (expires_at is null or expires_at > now())
    and refreshed_at + make_interval(mins => freshness_ttl_minutes) > now()
  limit 1;

  if not found then
    return jsonb_build_object('status','offer_unavailable');
  end if;

  v_destination := trim(coalesce(v_row.metadata->>'destination_url',''));
  v_tracking_param := trim(coalesce(v_row.metadata->>'tracking_param','subid'));

  if length(v_destination) < 9
     or length(v_destination) > 2000
     or lower(v_destination) not like 'https://%'
     or v_tracking_param !~ '^[A-Za-z][A-Za-z0-9_]{0,63}$' then
    return jsonb_build_object('status','offer_configuration_invalid');
  end if;

  insert into public.cashback_tracking_sessions(
    user_id,opportunity_id,provider,status
  ) values (
    p_user_id,v_row.id,v_row.provider,'started'
  )
  returning id into v_tracking_id;

  return jsonb_build_object(
    'status','ready',
    'tracking_id',v_tracking_id,
    'provider',v_row.provider,
    'destination_url',v_destination,
    'tracking_param',v_tracking_param
  );
end;
$$;

revoke all on function public.create_cashback_tracking_session(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_cashback_tracking_session(uuid,uuid)
  to service_role;

create or replace function public.apply_cashback_attributed_event(
  p_provider text,
  p_tracking_id uuid,
  p_external_id text,
  p_status text,
  p_commission_usd_micros bigint,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_provider text := lower(trim(coalesce(p_provider,'')));
  v_external_id text := trim(coalesce(p_external_id,''));
  v_session public.cashback_tracking_sessions%rowtype;
  v_config jsonb := '{}'::jsonb;
  v_share_bps integer := 0;
  v_reward_credits bigint := 0;
  v_existing public.cashback_events%rowtype;
  v_result jsonb;
  v_result_status text;
begin
  if p_tracking_id is null
     or length(v_provider) = 0
     or length(v_provider) > 100
     or length(v_external_id) = 0
     or length(v_external_id) > 200
     or p_status not in ('pending','confirmed','reversed') then
    return jsonb_build_object('status','invalid');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'cashback-attributed:' || v_provider || ':' || v_external_id,
    0
  ));

  select *
  into v_session
  from public.cashback_tracking_sessions
  where id=p_tracking_id
  for update;

  if not found then
    return jsonb_build_object('status','unknown_tracking');
  end if;

  if lower(trim(v_session.provider)) <> v_provider then
    return jsonb_build_object('status','provider_mismatch');
  end if;

  if v_session.last_external_id is not null
     and v_session.last_external_id <> v_external_id then
    return jsonb_build_object('status','tracking_already_bound');
  end if;

  if p_status='reversed' then
    select *
    into v_existing
    from public.cashback_events
    where lower(provider)=v_provider
      and external_id=v_external_id
      and user_id=v_session.user_id
    limit 1;

    if not found then
      return jsonb_build_object('status','orphan_reversal');
    end if;

    v_result := public.apply_cashback_event(
      v_existing.provider,
      v_existing.external_id,
      v_existing.user_id,
      'reversed',
      v_existing.commission_usd_micros,
      v_existing.user_reward_credits,
      coalesce(p_payload,'{}'::jsonb)
        || jsonb_build_object(
          'tracking_id',v_session.id,
          'opportunity_id',v_session.opportunity_id
        )
    );
  else
    if p_commission_usd_micros is null or p_commission_usd_micros <= 0 then
      return jsonb_build_object('status','invalid_commission');
    end if;

    select coalesce(value,'{}'::jsonb)
    into v_config
    from public.app_config
    where key='pulse_economy_v13';

    if lower(coalesce(v_config->>'cashback_enabled','false'))
       not in ('true','1','yes','on') then
      return jsonb_build_object('status','cashback_disabled');
    end if;

    v_share_bps := greatest(0,least(
      coalesce((v_config->>'cashback_user_share_bps')::integer,0),
      7500
    ));

    -- 1 credit = USD 0.001 = 1,000 USD micros.
    -- The partner supplies verified commission only; the database owns reward math.
    v_reward_credits := floor(
      (p_commission_usd_micros::numeric * v_share_bps::numeric)
      / 10000000::numeric
    )::bigint;

    if v_reward_credits <= 0 then
      return jsonb_build_object('status','reward_below_one_credit');
    end if;

    v_result := public.apply_cashback_event(
      v_provider,
      v_external_id,
      v_session.user_id,
      p_status,
      p_commission_usd_micros,
      v_reward_credits,
      coalesce(p_payload,'{}'::jsonb)
        || jsonb_build_object(
          'tracking_id',v_session.id,
          'opportunity_id',v_session.opportunity_id,
          'cashback_user_share_bps',v_share_bps
        )
    );
  end if;

  v_result_status := coalesce(v_result->>'status','');

  if v_result_status in ('pending','confirmed','reversed','idempotent') then
    update public.cashback_tracking_sessions
    set status=case
          when p_status='reversed' then 'reversed'
          when p_status='confirmed' then 'confirmed'
          else 'pending'
        end,
        last_external_id=v_external_id,
        last_event_at=now(),
        updated_at=now()
    where id=v_session.id;
  end if;

  return coalesce(v_result,'{}'::jsonb)
    || jsonb_build_object(
      'tracking_id',v_session.id,
      'opportunity_id',v_session.opportunity_id
    );
end;
$$;

revoke all on function public.apply_cashback_attributed_event(text,uuid,text,text,bigint,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_cashback_attributed_event(text,uuid,text,text,bigint,jsonb)
  to service_role;

create or replace function public.release_cashback_ingestion_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
with settlement as (
  select lower(pg_get_functiondef(
    'public.apply_cashback_attributed_event(text,uuid,text,text,bigint,jsonb)'::regprocedure
  )) as src
),
start_fn as (
  select lower(pg_get_functiondef(
    'public.create_cashback_tracking_session(uuid,uuid)'::regprocedure
  )) as src
)
select
  to_regclass('public.cashback_tracking_sessions') is not null
  and coalesce((
    select relrowsecurity
    from pg_catalog.pg_class
    where oid='public.cashback_tracking_sessions'::regclass
  ),false)
  and coalesce((
    select (value->>'cashback_user_share_bps')::integer = 7500
    from public.app_config
    where key='pulse_economy_v13'
  ),false)
  and public.release_cashback_budget_contract()
  and position('source_type=''affiliate''' in (select src from start_fn)) > 0
  and position('destination_url' in (select src from start_fn)) > 0
  and position('tracking_param' in (select src from start_fn)) > 0
  and position('p_commission_usd_micros::numeric * v_share_bps::numeric' in (select src from settlement)) > 0
  and position('/ 10000000::numeric' in (select src from settlement)) > 0
  and position('public.apply_cashback_event' in (select src from settlement)) > 0
  and position('orphan_reversal' in (select src from settlement)) > 0
  and position('provider_mismatch' in (select src from settlement)) > 0
  and position('tracking_already_bound' in (select src from settlement)) > 0
  and has_function_privilege(
    'service_role',
    'public.create_cashback_tracking_session(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.create_cashback_tracking_session(uuid,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.apply_cashback_attributed_event(text,uuid,text,text,bigint,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.apply_cashback_attributed_event(text,uuid,text,text,bigint,jsonb)',
    'EXECUTE'
  );
$$;

revoke all on function public.release_cashback_ingestion_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_cashback_ingestion_contract()
  to service_role;

do $$
begin
  if not public.release_cashback_ingestion_contract() then
    raise exception 'cashback ingestion contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'cashback ingestion foundation requires canonical release schema v55';
  end if;
end
$$;
