-- Treasury backing freshness v46.
-- Claims do not call FaucetPay on every request. A short-lived read-only
-- balance observation is refreshed on demand and enforced again inside the
-- database by a BEFORE INSERT trigger on pulse_claims.

create table if not exists public.treasury_backing_observations (
  id uuid primary key default gen_random_uuid(),
  treasury_id uuid not null references public.reward_treasuries(id) on delete restrict,
  backing_provider text not null default 'faucetpay' check (backing_provider = 'faucetpay'),
  backing_asset text not null check (length(trim(backing_asset)) between 2 and 16),
  observed_balance_units bigint not null check (observed_balance_units >= 0),
  payout_pack_credits bigint not null check (payout_pack_credits > 0),
  payout_pack_units bigint not null check (payout_pack_units > 0),
  user_balance_liability_credits bigint not null check (user_balance_liability_credits >= 0),
  active_withdrawal_liability_credits bigint not null check (active_withdrawal_liability_credits >= 0),
  active_reservation_liability_credits bigint not null check (active_reservation_liability_credits >= 0),
  treasury_available_credits bigint not null check (treasury_available_credits >= 0),
  total_exposure_credits bigint not null check (total_exposure_credits >= 0),
  required_units bigint not null check (required_units >= 0),
  sufficient boolean not null,
  read_proof_fingerprint text not null check (length(trim(read_proof_fingerprint)) >= 32),
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > observed_at),
  check (
    total_exposure_credits =
      user_balance_liability_credits
      + active_withdrawal_liability_credits
      + active_reservation_liability_credits
      + treasury_available_credits
  )
);

create index if not exists treasury_backing_observations_treasury_observed_idx
  on public.treasury_backing_observations(treasury_id, observed_at desc);

alter table public.treasury_backing_observations enable row level security;

revoke all on table public.treasury_backing_observations from public, anon, authenticated;
grant select, insert on table public.treasury_backing_observations to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'treasury_backing_policy',
  jsonb_build_object(
    'provider', 'faucetpay',
    'max_age_seconds', 900
  ),
  1,
  'On-demand external Treasury backing freshness guard'
)
on conflict (key) do nothing;

create or replace function public.record_treasury_backing_observation(
  p_treasury_code text,
  p_backing_asset text,
  p_observed_balance_units bigint,
  p_payout_pack_credits bigint,
  p_payout_pack_units bigint
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
     or coalesce(trim(p_backing_asset), '') = ''
     or p_observed_balance_units is null or p_observed_balance_units < 0
     or p_payout_pack_credits is null or p_payout_pack_credits <= 0
     or p_payout_pack_units is null or p_payout_pack_units <= 0 then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select value->'faucetpay_read'->>'fingerprint'
  into v_read_proof_fingerprint
  from public.app_config
  where key = 'release_external_proof';

  if coalesce(trim(v_read_proof_fingerprint), '') = '' then
    return jsonb_build_object('status', 'read_proof_missing');
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
    (v_total_exposure::numeric * p_payout_pack_units::numeric)
    / p_payout_pack_credits::numeric
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
    upper(trim(p_backing_asset)),
    p_observed_balance_units,
    p_payout_pack_credits,
    p_payout_pack_units,
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

  select * into v_observation
  from public.treasury_backing_observations
  where treasury_id = v_treasury.id
  order by observed_at desc
  limit 1;

  if not found
     or v_observation.expires_at <= now()
     or v_observation.read_proof_fingerprint <> trim(v_read_proof_fingerprint) then
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
    (v_total_exposure::numeric * v_observation.payout_pack_units::numeric)
    / v_observation.payout_pack_credits::numeric
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

revoke all on function public.record_treasury_backing_observation(text,text,bigint,bigint,bigint)
  from public, anon, authenticated;
grant execute on function public.record_treasury_backing_observation(text,text,bigint,bigint,bigint)
  to service_role;

revoke all on function public.treasury_backing_guard(text)
  from public, anon, authenticated;
grant execute on function public.treasury_backing_guard(text)
  to service_role;

create or replace function public.enforce_pulse_claim_backing_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_treasury_code text;
  v_guard jsonb;
  v_status text;
begin
  if coalesce(new.funding_source, '') <> 'pulse' then
    return new;
  end if;

  select code into v_treasury_code
  from public.reward_treasuries
  where id = new.treasury_id;

  if coalesce(v_treasury_code, '') = '' then
    raise exception 'pulse_backing_guard:treasury_missing' using errcode = 'P0001';
  end if;

  v_guard := public.treasury_backing_guard(v_treasury_code);
  v_status := coalesce(v_guard->>'status', 'backing_refresh_required');

  if v_status <> 'backing_ready' then
    raise exception 'pulse_backing_guard:%', v_status using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_pulse_claim_backing_guard()
  from public, anon, authenticated;
grant execute on function public.enforce_pulse_claim_backing_guard()
  to service_role;

drop trigger if exists pulse_claim_backing_guard on public.pulse_claims;
create trigger pulse_claim_backing_guard
before insert on public.pulse_claims
for each row
execute function public.enforce_pulse_claim_backing_guard();

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
    and to_regprocedure('public.record_treasury_backing_observation(text,text,bigint,bigint,bigint)') is not null
    and to_regprocedure('public.treasury_backing_guard(text)') is not null
    and to_regprocedure('public.enforce_pulse_claim_backing_guard()') is not null
    and coalesce((
      select not prosecdef
      from pg_proc
      where oid = 'public.record_treasury_backing_observation(text,text,bigint,bigint,bigint)'::regprocedure
    ), false)
    and coalesce((
      select not prosecdef
      from pg_proc
      where oid = 'public.treasury_backing_guard(text)'::regprocedure
    ), false)
    and coalesce((
      select not prosecdef
      from pg_proc
      where oid = 'public.enforce_pulse_claim_backing_guard()'::regprocedure
    ), false)
    and has_function_privilege(
      'service_role',
      'public.record_treasury_backing_observation(text,text,bigint,bigint,bigint)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.treasury_backing_guard(text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.record_treasury_backing_observation(text,text,bigint,bigint,bigint)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.record_treasury_backing_observation(text,text,bigint,bigint,bigint)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.treasury_backing_guard(text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.treasury_backing_guard(text)',
      'EXECUTE'
    )
    and not has_table_privilege('anon', 'public.treasury_backing_observations', 'SELECT')
    and not has_table_privilege('authenticated', 'public.treasury_backing_observations', 'SELECT')
    and exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.pulse_claims'::regclass
        and tgname = 'pulse_claim_backing_guard'
        and tgenabled <> 'D'
    )
    and position(
      'read_proof_fingerprint'
      in lower(pg_get_functiondef('public.treasury_backing_guard(text)'::regprocedure))
    ) > 0
    and position(
      'observed_balance_units < v_required_units'
      in lower(pg_get_functiondef('public.treasury_backing_guard(text)'::regprocedure))
    ) > 0
    and position(
      'pulse_backing_guard'
      in lower(pg_get_functiondef('public.enforce_pulse_claim_backing_guard()'::regprocedure))
    ) > 0
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
  jsonb_build_object('version', 46, 'migration', '0046_treasury_backing_freshness.sql'),
  46,
  'On-demand FaucetPay backing freshness guard for Hourly Pulse claims'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
