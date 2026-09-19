-- Supabase v48: shorten the Hourly Pulse global Treasury critical section.
--
-- Per-user validation, backing verification and trust refresh happen before the
-- shared Treasury row lock. Exact global availability/budget checks are still
-- serialized and fail closed. A nested subtransaction rolls back ledger, claim
-- and trust together if a late shared-state check rejects the claim.

drop index if exists public.pulse_claims_treasury_created_idx;
create index pulse_claims_treasury_created_idx
  on public.pulse_claims(treasury_id, created_at desc)
  include (reward_credits, user_id);

drop index if exists public.pulse_claims_user_created_idx;
create index pulse_claims_user_created_idx
  on public.pulse_claims(user_id, created_at desc)
  include (treasury_id, reward_credits);

drop index if exists public.treasury_reservations_treasury_status_idx;
create index treasury_reservations_treasury_status_idx
  on public.treasury_reservations(treasury_id, status, created_at desc)
  include (amount_credits, user_id, expires_at);

drop index if exists public.treasury_reservations_user_created_idx;
create index treasury_reservations_user_created_idx
  on public.treasury_reservations(user_id, created_at desc)
  include (treasury_id, status, amount_credits, expires_at);

create index if not exists treasury_reservations_expiry_idx
  on public.treasury_reservations(treasury_id, expires_at)
  include (amount_credits)
  where status = 'reserved';

create or replace function public.claim_hourly_pulse(p_user_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_config jsonb := '{}'::jsonb;
  v_reward integer := 1;
  v_interval_minutes integer := 60;
  v_treasury_code text := 'launch';
  v_max_risk integer := 59;
  v_pilot_mode boolean := false;
  v_profile public.profiles%rowtype;
  v_treasury public.reward_treasuries%rowtype;
  v_treasury_id uuid;
  v_last_claim_at timestamptz;
  v_next_eligible_at timestamptz;
  v_today_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_daily_total bigint := 0;
  v_user_daily_total bigint := 0;
  v_reservation_daily bigint := 0;
  v_user_reservation_daily bigint := 0;
  v_available bigint := 0;
  v_claim_id uuid := gen_random_uuid();
  v_ledger_id uuid := gen_random_uuid();
  v_trust smallint := 0;
  v_abort_status text;
begin
  if p_user_id is null then
    return jsonb_build_object('status', 'invalid_user');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('hourly-pulse:' || p_user_id::text, 0));

  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('status', 'unknown_user');
  end if;

  select value into v_config
  from public.app_config
  where key = 'hourly_pulse';

  v_reward := greatest(1, least(coalesce((v_config->>'credits')::integer, 1), 1000000));
  v_interval_minutes := greatest(15, least(coalesce((v_config->>'interval_minutes')::integer, 60), 1440));
  v_treasury_code := coalesce(nullif(trim(v_config->>'treasury_code'), ''), 'launch');
  v_max_risk := greatest(0, least(coalesce((v_config->>'max_risk_score')::integer, 59), 100));
  v_pilot_mode := lower(coalesce(v_config->>'pilot_mode', 'false')) in ('true','1','yes','on');

  if v_pilot_mode and not exists (
    select 1
    from jsonb_array_elements_text(
      case when jsonb_typeof(v_config->'pilot_user_ids') = 'array'
        then v_config->'pilot_user_ids'
        else '[]'::jsonb
      end
    ) as pilot(user_id)
    where pilot.user_id = p_user_id::text
  ) then
    return jsonb_build_object('status', 'pilot_restricted');
  end if;

  if v_profile.risk_score > v_max_risk then
    return jsonb_build_object('status', 'risk_hold');
  end if;

  select created_at into v_last_claim_at
  from public.pulse_claims
  where user_id = p_user_id
  order by created_at desc
  limit 1;

  if v_last_claim_at is not null then
    v_next_eligible_at := v_last_claim_at + make_interval(mins => v_interval_minutes);
    if v_next_eligible_at > now() then
      return jsonb_build_object(
        'status', 'not_ready',
        'next_eligible_at', v_next_eligible_at,
        'interval_minutes', v_interval_minutes
      );
    end if;
  end if;

  select * into v_treasury
  from public.reward_treasuries
  where code = v_treasury_code;

  if not found then
    return jsonb_build_object('status', 'treasury_missing');
  end if;

  v_treasury_id := v_treasury.id;

  perform public.release_expired_treasury_reservations(v_treasury_id);

  select * into v_treasury
  from public.reward_treasuries
  where id = v_treasury_id;

  if not found then
    return jsonb_build_object('status', 'treasury_missing');
  end if;

  if not v_treasury.enabled or v_treasury.kill_switch then
    return jsonb_build_object('status', 'treasury_closed');
  end if;

  if v_treasury.daily_budget_credits <= 0 or v_treasury.max_user_daily_credits <= 0 then
    return jsonb_build_object('status', 'budget_disabled');
  end if;

  v_available := v_treasury.funded_credits - v_treasury.reserved_credits - v_treasury.spent_credits;
  if v_reward > v_available then
    return jsonb_build_object('status', 'insufficient_treasury');
  end if;

  select coalesce(sum(reward_credits), 0)
  into v_user_daily_total
  from public.pulse_claims
  where treasury_id = v_treasury_id
    and user_id = p_user_id
    and created_at >= v_today_start;

  select coalesce(sum(amount_credits), 0)
  into v_user_reservation_daily
  from public.treasury_reservations
  where treasury_id = v_treasury_id
    and user_id = p_user_id
    and created_at >= v_today_start
    and status in ('reserved','consumed');

  if v_user_daily_total + v_user_reservation_daily + v_reward > v_treasury.max_user_daily_credits then
    return jsonb_build_object('status', 'user_daily_limit');
  end if;

  select coalesce(sum(reward_credits), 0)
  into v_daily_total
  from public.pulse_claims
  where treasury_id = v_treasury_id
    and created_at >= v_today_start;

  select coalesce(sum(amount_credits), 0)
  into v_reservation_daily
  from public.treasury_reservations
  where treasury_id = v_treasury_id
    and created_at >= v_today_start
    and status in ('reserved','consumed');

  if v_daily_total + v_reservation_daily + v_reward > v_treasury.daily_budget_credits then
    return jsonb_build_object('status', 'daily_budget_exhausted');
  end if;

  begin
    insert into public.ledger_entries(
      id, user_id, event_key, entry_type, state, credits, metadata
    ) values (
      v_ledger_id,
      p_user_id,
      'hourly_pulse:' || v_claim_id::text,
      'pulse_reward',
      'available',
      v_reward,
      jsonb_build_object(
        'claim_id', v_claim_id,
        'funding_source', 'pulse',
        'treasury_code', v_treasury.code,
        'interval_minutes', v_interval_minutes
      )
    );

    insert into public.pulse_claims(
      id, user_id, treasury_id, reward_credits, funding_source, ledger_entry_id,
      metadata
    ) values (
      v_claim_id,
      p_user_id,
      v_treasury_id,
      v_reward,
      'pulse',
      v_ledger_id,
      jsonb_build_object('interval_minutes', v_interval_minutes)
    );

    v_trust := public.refresh_pulse_trust(p_user_id);

    -- SCALE_V48_GLOBAL_CRITICAL_SECTION
    select * into v_treasury
    from public.reward_treasuries
    where id = v_treasury_id
    for update;

    if not found then
      raise exception 'pulse_claim_abort:treasury_missing' using errcode = 'P0001';
    end if;

    if not v_treasury.enabled or v_treasury.kill_switch then
      raise exception 'pulse_claim_abort:treasury_closed' using errcode = 'P0001';
    end if;

    if v_treasury.daily_budget_credits <= 0 or v_treasury.max_user_daily_credits <= 0 then
      raise exception 'pulse_claim_abort:budget_disabled' using errcode = 'P0001';
    end if;

    v_available := v_treasury.funded_credits - v_treasury.reserved_credits - v_treasury.spent_credits;
    if v_reward > v_available then
      raise exception 'pulse_claim_abort:insufficient_treasury' using errcode = 'P0001';
    end if;

    select coalesce(sum(reward_credits), 0)
    into v_daily_total
    from public.pulse_claims
    where treasury_id = v_treasury_id
      and created_at >= v_today_start;

    select coalesce(sum(amount_credits), 0)
    into v_reservation_daily
    from public.treasury_reservations
    where treasury_id = v_treasury_id
      and created_at >= v_today_start
      and status in ('reserved','consumed');

    if v_daily_total + v_reservation_daily > v_treasury.daily_budget_credits then
      raise exception 'pulse_claim_abort:daily_budget_exhausted' using errcode = 'P0001';
    end if;

    select coalesce(sum(reward_credits), 0)
    into v_user_daily_total
    from public.pulse_claims
    where treasury_id = v_treasury_id
      and user_id = p_user_id
      and created_at >= v_today_start;

    select coalesce(sum(amount_credits), 0)
    into v_user_reservation_daily
    from public.treasury_reservations
    where treasury_id = v_treasury_id
      and user_id = p_user_id
      and created_at >= v_today_start
      and status in ('reserved','consumed');

    if v_user_daily_total + v_user_reservation_daily > v_treasury.max_user_daily_credits then
      raise exception 'pulse_claim_abort:user_daily_limit' using errcode = 'P0001';
    end if;

    update public.reward_treasuries
    set spent_credits = spent_credits + v_reward,
        updated_at = now()
    where id = v_treasury_id;
    -- SCALE_V48_GLOBAL_CRITICAL_SECTION_END
  exception
    when sqlstate 'P0001' then
      if sqlerrm like 'pulse_claim_abort:%' then
        v_abort_status := split_part(sqlerrm, ':', 2);
        return jsonb_build_object('status', v_abort_status);
      end if;
      raise;
  end;

  v_next_eligible_at := now() + make_interval(mins => v_interval_minutes);

  return jsonb_build_object(
    'status', 'claimed',
    'claim_id', v_claim_id,
    'ledger_id', v_ledger_id,
    'reward_credits', v_reward,
    'trust_level', v_trust,
    'next_eligible_at', v_next_eligible_at,
    'interval_minutes', v_interval_minutes
  );
end;
$$;

revoke all on function public.claim_hourly_pulse(uuid) from public, anon, authenticated;
grant execute on function public.claim_hourly_pulse(uuid) to service_role;

create or replace function public.release_hourly_pulse_scale_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  with fn as (
    select lower(pg_get_functiondef('public.claim_hourly_pulse(uuid)'::regprocedure)) as src
  )
  select
    to_regprocedure('public.claim_hourly_pulse(uuid)') is not null
    and not coalesce((
      select prosecdef
      from pg_proc
      where oid = 'public.claim_hourly_pulse(uuid)'::regprocedure
    ), true)
    and has_function_privilege('service_role', 'public.claim_hourly_pulse(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.claim_hourly_pulse(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.claim_hourly_pulse(uuid)', 'EXECUTE')
    and to_regclass('public.pulse_claims_treasury_created_idx') is not null
    and to_regclass('public.pulse_claims_user_created_idx') is not null
    and to_regclass('public.treasury_reservations_treasury_status_idx') is not null
    and to_regclass('public.treasury_reservations_user_created_idx') is not null
    and to_regclass('public.treasury_reservations_expiry_idx') is not null
    and position('scale_v48_global_critical_section' in (select src from fn)) > 0
    and position('insert into public.pulse_claims' in (select src from fn))
        < position('scale_v48_global_critical_section' in (select src from fn))
    and position('refresh_pulse_trust(p_user_id)' in (select src from fn))
        < position('scale_v48_global_critical_section' in (select src from fn))
    and position('for update' in substring(
          (select src from fn)
          from position('scale_v48_global_critical_section' in (select src from fn))
        )) > 0
    and position('pulse_claim_abort:daily_budget_exhausted' in (select src from fn)) > 0
    and position('pulse_claim_abort:user_daily_limit' in (select src from fn)) > 0
    and position('when sqlstate ''p0001''' in (select src from fn)) > 0;
$$;

revoke all on function public.release_hourly_pulse_scale_contract()
  from public, anon, authenticated;
grant execute on function public.release_hourly_pulse_scale_contract()
  to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 48, 'migration', '0048_hourly_pulse_claim_concurrency.sql'),
  48,
  'Short Hourly Pulse Treasury critical section with rollback-safe late budget checks and covering hot-path indexes'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
