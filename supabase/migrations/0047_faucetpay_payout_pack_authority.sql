-- Payout-pack authority v47.
-- The database, not the caller, owns the conversion used to decide whether
-- a FaucetPay balance observation covers current internal exposure.

create table if not exists public.faucetpay_payout_pack_authority (
  singleton boolean primary key default true check (singleton),
  asset text not null,
  credits bigint not null check (credits > 0),
  units bigint not null check (units > 0),
  authority_version integer not null default 1 check (authority_version > 0),
  updated_at timestamptz not null default now()
);

alter table public.faucetpay_payout_pack_authority enable row level security;

-- The runtime service role may read the canonical pack but cannot mutate it.
-- Changing payout economics requires a governed migration executed by the DB owner.
revoke all on table public.faucetpay_payout_pack_authority
  from public, anon, authenticated, service_role;
grant select on table public.faucetpay_payout_pack_authority
  to service_role;

insert into public.faucetpay_payout_pack_authority (
  singleton,
  asset,
  credits,
  units,
  authority_version
)
values (true, 'USDT', 10, 1000000, 1)
on conflict (singleton) do update
set asset = excluded.asset,
    credits = excluded.credits,
    units = excluded.units,
    authority_version = excluded.authority_version,
    updated_at = now();

-- Remove the first-draft mutable authority if this migration is replayed
-- against a database where an earlier v47 draft was tested.
delete from public.app_config
where key = 'faucetpay_payout_pack_authority';

-- Break the old contract dependency before removing the caller-controlled RPC.
create or replace function public.release_treasury_backing_guard_contract()
returns boolean
language sql
security definer
set search_path = public
as $$
  select false;
$$;

drop function if exists public.record_treasury_backing_observation(text,text,bigint,bigint,bigint);

create or replace function public.record_treasury_backing_observation(
  p_treasury_code text,
  p_observed_balance_units bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_treasury public.reward_treasuries%rowtype;
  v_read_proof_fingerprint text;
  v_policy jsonb := '{}'::jsonb;
  v_pack_asset text;
  v_pack_credits bigint;
  v_pack_units bigint;
  v_max_age_seconds integer := 900;
  v_user_balance_liability bigint := 0;
  v_active_withdrawal_liability bigint := 0;
  v_active_reservation_liability bigint := 0;
  v_available bigint := 0;
  v_total_exposure bigint := 0;
  v_required_units bigint := 0;
  v_sufficient boolean := false;
  v_observed_at timestamptz := now();
  v_expires_at timestamptz;
  v_observation_id uuid;
begin
  if coalesce(trim(p_treasury_code), '') = ''
     or p_observed_balance_units is null or p_observed_balance_units < 0 then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select value->'faucetpay_read'->>'fingerprint'
  into v_read_proof_fingerprint
  from public.app_config
  where key = 'release_external_proof';

  if coalesce(trim(v_read_proof_fingerprint), '') = '' then
    return jsonb_build_object('status', 'read_proof_missing');
  end if;

  select upper(trim(asset)), credits, units
  into v_pack_asset, v_pack_credits, v_pack_units
  from public.faucetpay_payout_pack_authority
  where singleton is true;

  if not found
     or coalesce(trim(v_pack_asset), '') = ''
     or v_pack_credits is null or v_pack_credits <= 0
     or v_pack_units is null or v_pack_units <= 0 then
    return jsonb_build_object('status', 'pack_authority_missing');
  end if;

  select value into v_policy
  from public.app_config
  where key = 'treasury_backing_policy';

  if coalesce(v_policy->>'max_age_seconds', '') ~ '^[0-9]+$' then
    v_max_age_seconds := greatest(60, least((v_policy->>'max_age_seconds')::integer, 3600));
  end if;

  select * into v_treasury
  from public.reward_treasuries
  where code = trim(p_treasury_code)
  for update;

  if not found then
    return jsonb_build_object('status', 'unknown_treasury');
  end if;

  select coalesce(sum(greatest(available_credits, 0) + greatest(pending_credits, 0)), 0)::bigint
  into v_user_balance_liability
  from public.user_balances;

  select coalesce(sum(amount_credits), 0)::bigint
  into v_active_withdrawal_liability
  from public.withdrawals
  where status in ('requested', 'held', 'submitted');

  select coalesce(sum(amount_credits), 0)::bigint
  into v_active_reservation_liability
  from public.treasury_reservations
  where status = 'reserved';

  v_available := greatest(
    v_treasury.funded_credits - v_treasury.reserved_credits - v_treasury.spent_credits,
    0
  );

  v_total_exposure :=
    v_user_balance_liability
    + v_active_withdrawal_liability
    + v_active_reservation_liability
    + v_available;

  v_required_units := ceil(
    (v_total_exposure::numeric * v_pack_units::numeric)
    / v_pack_credits::numeric
  )::bigint;

  v_sufficient := p_observed_balance_units >= v_required_units;
  v_expires_at := v_observed_at + make_interval(secs => v_max_age_seconds);

  insert into public.treasury_backing_observations (
    treasury_id,
    backing_provider,
    backing_asset,
    observed_balance_units,
    payout_pack_credits,
    payout_pack_units,
    user_balance_liability_credits,
    active_withdrawal_liability_credits,
    active_reservation_liability_credits,
    treasury_available_credits,
    total_exposure_credits,
    required_units,
    sufficient,
    read_proof_fingerprint,
    observed_at,
    expires_at
  )
  values (
    v_treasury.id,
    'faucetpay',
    v_pack_asset,
    p_observed_balance_units,
    v_pack_credits,
    v_pack_units,
    v_user_balance_liability,
    v_active_withdrawal_liability,
    v_active_reservation_liability,
    v_available,
    v_total_exposure,
    v_required_units,
    v_sufficient,
    trim(v_read_proof_fingerprint),
    v_observed_at,
    v_expires_at
  )
  returning id into v_observation_id;

  return jsonb_build_object(
    'status', case when v_sufficient then 'backing_ready' else 'backing_insufficient' end,
    'observation_id', v_observation_id,
    'observed_units', p_observed_balance_units,
    'required_units', v_required_units,
    'total_exposure_credits', v_total_exposure,
    'asset', v_pack_asset,
    'payout_pack_credits', v_pack_credits,
    'payout_pack_units', v_pack_units,
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.treasury_backing_guard(
  p_treasury_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_treasury public.reward_treasuries%rowtype;
  v_observation public.treasury_backing_observations%rowtype;
  v_read_proof_fingerprint text;
  v_pack_asset text;
  v_pack_credits bigint;
  v_pack_units bigint;
  v_user_balance_liability bigint := 0;
  v_active_withdrawal_liability bigint := 0;
  v_active_reservation_liability bigint := 0;
  v_available bigint := 0;
  v_total_exposure bigint := 0;
  v_required_units bigint := 0;
begin
  if coalesce(trim(p_treasury_code), '') = '' then
    return jsonb_build_object('status', 'backing_refresh_required');
  end if;

  select * into v_treasury
  from public.reward_treasuries
  where code = trim(p_treasury_code);

  if not found then
    return jsonb_build_object('status', 'backing_refresh_required');
  end if;

  select value->'faucetpay_read'->>'fingerprint'
  into v_read_proof_fingerprint
  from public.app_config
  where key = 'release_external_proof';

  if coalesce(trim(v_read_proof_fingerprint), '') = '' then
    return jsonb_build_object('status', 'backing_refresh_required');
  end if;

  select upper(trim(asset)), credits, units
  into v_pack_asset, v_pack_credits, v_pack_units
  from public.faucetpay_payout_pack_authority
  where singleton is true;

  if not found
     or coalesce(trim(v_pack_asset), '') = ''
     or v_pack_credits is null or v_pack_credits <= 0
     or v_pack_units is null or v_pack_units <= 0 then
    return jsonb_build_object('status', 'backing_refresh_required');
  end if;

  select * into v_observation
  from public.treasury_backing_observations
  where treasury_id = v_treasury.id
  order by observed_at desc
  limit 1;

  if not found
     or v_observation.expires_at <= now()
     or v_observation.read_proof_fingerprint <> trim(v_read_proof_fingerprint)
     or upper(trim(v_observation.backing_asset)) <> v_pack_asset
     or v_observation.payout_pack_credits <> v_pack_credits
     or v_observation.payout_pack_units <> v_pack_units then
    return jsonb_build_object('status', 'backing_refresh_required');
  end if;

  select coalesce(sum(greatest(available_credits, 0) + greatest(pending_credits, 0)), 0)::bigint
  into v_user_balance_liability
  from public.user_balances;

  select coalesce(sum(amount_credits), 0)::bigint
  into v_active_withdrawal_liability
  from public.withdrawals
  where status in ('requested', 'held', 'submitted');

  select coalesce(sum(amount_credits), 0)::bigint
  into v_active_reservation_liability
  from public.treasury_reservations
  where status = 'reserved';

  v_available := greatest(
    v_treasury.funded_credits - v_treasury.reserved_credits - v_treasury.spent_credits,
    0
  );

  v_total_exposure :=
    v_user_balance_liability
    + v_active_withdrawal_liability
    + v_active_reservation_liability
    + v_available;

  v_required_units := ceil(
    (v_total_exposure::numeric * v_pack_units::numeric)
    / v_pack_credits::numeric
  )::bigint;

  if not v_observation.sufficient
     or v_observation.observed_balance_units < v_required_units then
    return jsonb_build_object(
      'status', 'backing_insufficient',
      'observation_id', v_observation.id,
      'required_units', v_required_units,
      'expires_at', v_observation.expires_at
    );
  end if;

  return jsonb_build_object(
    'status', 'backing_ready',
    'observation_id', v_observation.id,
    'required_units', v_required_units,
    'expires_at', v_observation.expires_at
  );
end;
$$;

revoke all on function public.record_treasury_backing_observation(text,bigint)
  from public, anon, authenticated;
grant execute on function public.record_treasury_backing_observation(text,bigint)
  to service_role;

revoke all on function public.treasury_backing_guard(text)
  from public, anon, authenticated;
grant execute on function public.treasury_backing_guard(text)
  to service_role;

create or replace function public.release_treasury_backing_guard_contract()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    to_regclass('public.treasury_backing_observations') is not null
    and coalesce((
      select relrowsecurity
      from pg_class
      where oid = 'public.treasury_backing_observations'::regclass
    ), false)
    and to_regprocedure('public.record_treasury_backing_observation(text,bigint)') is not null
    and to_regprocedure('public.record_treasury_backing_observation(text,text,bigint,bigint,bigint)') is null
    and to_regprocedure('public.treasury_backing_guard(text)') is not null
    and to_regprocedure('public.enforce_pulse_claim_backing_guard()') is not null
    and coalesce((
      select not prosecdef
      from pg_proc
      where oid = 'public.record_treasury_backing_observation(text,bigint)'::regprocedure
    ), false)
    and coalesce((
      select not prosecdef
      from pg_proc
      where oid = 'public.treasury_backing_guard(text)'::regprocedure
    ), false)
    and has_function_privilege(
      'service_role',
      'public.record_treasury_backing_observation(text,bigint)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.record_treasury_backing_observation(text,bigint)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.record_treasury_backing_observation(text,bigint)',
      'EXECUTE'
    )
    and not has_table_privilege('anon', 'public.treasury_backing_observations', 'SELECT')
    and not has_table_privilege('authenticated', 'public.treasury_backing_observations', 'SELECT')
    and to_regclass('public.faucetpay_payout_pack_authority') is not null
    and coalesce((
      select relrowsecurity
      from pg_class
      where oid = 'public.faucetpay_payout_pack_authority'::regclass
    ), false)
    and has_table_privilege('service_role', 'public.faucetpay_payout_pack_authority', 'SELECT')
    and not has_table_privilege('service_role', 'public.faucetpay_payout_pack_authority', 'INSERT')
    and not has_table_privilege('service_role', 'public.faucetpay_payout_pack_authority', 'UPDATE')
    and not has_table_privilege('service_role', 'public.faucetpay_payout_pack_authority', 'DELETE')
    and not has_table_privilege('service_role', 'public.faucetpay_payout_pack_authority', 'TRUNCATE')
    and not has_table_privilege('anon', 'public.faucetpay_payout_pack_authority', 'SELECT')
    and not has_table_privilege('authenticated', 'public.faucetpay_payout_pack_authority', 'SELECT')
    and not exists (
      select 1
      from public.app_config
      where key = 'faucetpay_payout_pack_authority'
    )
    and coalesce((
      select
        upper(trim(asset)) = 'USDT'
        and credits = 10
        and units = 1000000
        and authority_version = 1
      from public.faucetpay_payout_pack_authority
      where singleton is true
    ), false)
    and position(
      'faucetpay_payout_pack_authority'
      in lower(pg_get_functiondef('public.record_treasury_backing_observation(text,bigint)'::regprocedure))
    ) > 0
    and position(
      'v_observation.payout_pack_credits <> v_pack_credits'
      in lower(pg_get_functiondef('public.treasury_backing_guard(text)'::regprocedure))
    ) > 0
    and position(
      'v_observation.payout_pack_units <> v_pack_units'
      in lower(pg_get_functiondef('public.treasury_backing_guard(text)'::regprocedure))
    ) > 0
    and position(
      'upper(trim(v_observation.backing_asset)) <> v_pack_asset'
      in lower(pg_get_functiondef('public.treasury_backing_guard(text)'::regprocedure))
    ) > 0
    and exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.pulse_claims'::regclass
        and tgname = 'pulse_claim_backing_guard'
        and tgenabled <> 'D'
    )
    and coalesce((
      select (value->>'max_age_seconds')::integer = 900
      from public.app_config
      where key = 'treasury_backing_policy'
    ), false);
$$;

revoke all on function public.release_treasury_backing_guard_contract()
  from public, anon, authenticated;
grant execute on function public.release_treasury_backing_guard_contract()
  to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 47, 'migration', '0047_faucetpay_payout_pack_authority.sql'),
  47,
  'Database-owned FaucetPay payout-pack authority for backing calculations'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
