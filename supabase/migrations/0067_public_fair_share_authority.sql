-- Correctness hardening: enforce public fair-share as database authority.
-- Compatible with release schema v55 / 0055. This changes no live Treasury
-- values, reward amount, payout, RLS, pilot allowlist or release authority.
--
-- Product Readiness already requires max_user_daily_credits to be at most 50%
-- of the daily budget before public expansion. Previously that was advisory:
-- toggling pilot_mode=false could make a non-pilot claim succeed with 10/10
-- per-user/global limits. This migration makes the existing policy fail-closed
-- in both base claims and same-Treasury reservations while leaving pilot mode
-- unchanged.

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
  v_available bigint := 0;
  v_claim_id uuid := gen_random_uuid();
  v_ledger_id uuid := gen_random_uuid();
  v_trust smallint := 0;
  v_abort_status text;
begin
  if p_user_id is null then
    return jsonb_build_object('status', 'invalid_user');
  end if;

  if not pg_try_advisory_xact_lock(
    hashtextextended('hourly-pulse:' || p_user_id::text, 0)
  ) then
    return jsonb_build_object('status', 'claim_in_progress');
  end if;

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

  if not v_pilot_mode
     and (v_treasury.max_user_daily_credits::numeric * 2)
       > v_treasury.daily_budget_credits::numeric then
    return jsonb_build_object('status', 'public_fair_share_required');
  end if;

  v_available := v_treasury.funded_credits - v_treasury.reserved_credits - v_treasury.spent_credits;
  if v_reward > v_available then
    return jsonb_build_object('status', 'insufficient_treasury');
  end if;

  -- One shared read-only snapshot replaces four independent SUM queries.
  select total_credits, user_credits
  into v_daily_total, v_user_daily_total
  from private.treasury_daily_usage_snapshot(
    v_treasury_id,
    p_user_id,
    v_today_start
  );

  if v_user_daily_total + v_reward > v_treasury.max_user_daily_credits then
    return jsonb_build_object('status', 'user_daily_limit');
  end if;

  if v_daily_total + v_reward > v_treasury.daily_budget_credits then
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

    if not v_pilot_mode
       and (v_treasury.max_user_daily_credits::numeric * 2)
         > v_treasury.daily_budget_credits::numeric then
      raise exception 'pulse_claim_abort:public_fair_share_required' using errcode = 'P0001';
    end if;

    v_available := v_treasury.funded_credits - v_treasury.reserved_credits - v_treasury.spent_credits;
    if v_reward > v_available then
      raise exception 'pulse_claim_abort:insufficient_treasury' using errcode = 'P0001';
    end if;

    -- The inserted claim is visible to this transaction. After the Treasury
    -- row lock, this statement sees all usage committed by the previous lock
    -- holder plus the current claim, preserving the v48 fail-closed ordering.
    select total_credits, user_credits
    into v_daily_total, v_user_daily_total
    from private.treasury_daily_usage_snapshot(
      v_treasury_id,
      p_user_id,
      v_today_start
    );

    if v_daily_total > v_treasury.daily_budget_credits then
      raise exception 'pulse_claim_abort:daily_budget_exhausted' using errcode = 'P0001';
    end if;

    if v_user_daily_total > v_treasury.max_user_daily_credits then
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


revoke all on function public.claim_hourly_pulse(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_hourly_pulse(uuid)
  to service_role;

create or replace function public.reserve_treasury_boost(
  p_treasury_code text,
  p_user_id uuid,
  p_opportunity_key text,
  p_amount_credits bigint,
  p_idempotency_key text,
  p_ttl_minutes integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_treasury public.reward_treasuries%rowtype;
  v_treasury_id uuid;
  v_existing public.treasury_reservations%rowtype;
  v_daily_total bigint := 0;
  v_user_daily_total bigint := 0;
  v_available bigint := 0;
  v_reservation_id uuid;
  v_today_start timestamptz :=
    date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_pulse_config jsonb := '{}'::jsonb;
  v_configured_treasury_code text := 'launch';
  v_public_mode boolean := false;
begin
  if p_user_id is null
     or coalesce(trim(p_opportunity_key), '') = ''
     or coalesce(trim(p_idempotency_key), '') = ''
     or p_amount_credits is null
     or p_amount_credits <= 0 then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select * into v_existing
  from public.treasury_reservations
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.status = 'reserved'
       and v_existing.expires_at <= now() then
      perform public.release_expired_treasury_reservations(
        v_existing.treasury_id
      );

      select * into v_existing
      from public.treasury_reservations
      where id = v_existing.id;
    end if;

    return jsonb_build_object(
      'status', 'idempotent',
      'reservation_id', v_existing.id,
      'reservation_status', v_existing.status,
      'amount_credits', v_existing.amount_credits
    );
  end if;

  select id into v_treasury_id
  from public.reward_treasuries
  where code = p_treasury_code;

  if not found then
    return jsonb_build_object('status', 'unknown_treasury');
  end if;

  perform public.release_expired_treasury_reservations(v_treasury_id);

  -- Keep the pre-existing global serialization authority. The shared daily
  -- snapshot is read only after this lock, so claims and reservations cannot
  -- independently admit usage against the same budget.
  select * into v_treasury
  from public.reward_treasuries
  where id = v_treasury_id
  for update;

  if not found then
    return jsonb_build_object('status', 'unknown_treasury');
  end if;

  if not v_treasury.enabled or v_treasury.kill_switch then
    return jsonb_build_object('status', 'treasury_closed');
  end if;

  if v_treasury.daily_budget_credits <= 0
     or v_treasury.max_user_daily_credits <= 0 then
    return jsonb_build_object('status', 'budget_disabled');
  end if;

  select coalesce((
    select value
    from public.app_config
    where key = 'hourly_pulse'
  ), '{}'::jsonb)
  into v_pulse_config;

  v_configured_treasury_code :=
    coalesce(nullif(trim(v_pulse_config->>'treasury_code'), ''), 'launch');

  v_public_mode :=
    v_configured_treasury_code = p_treasury_code
    and not (
      lower(coalesce(v_pulse_config->>'pilot_mode', 'false'))
      in ('true','1','yes','on')
    );

  if v_public_mode
     and (v_treasury.max_user_daily_credits::numeric * 2)
       > v_treasury.daily_budget_credits::numeric then
    return jsonb_build_object('status', 'public_fair_share_required');
  end if;

  v_available :=
    v_treasury.funded_credits
    - v_treasury.reserved_credits
    - v_treasury.spent_credits;

  if p_amount_credits > v_available then
    return jsonb_build_object('status', 'insufficient_treasury');
  end if;

  select total_credits, user_credits
  into v_daily_total, v_user_daily_total
  from private.treasury_daily_usage_snapshot(
    v_treasury.id,
    p_user_id,
    v_today_start
  );

  if v_daily_total + p_amount_credits
       > v_treasury.daily_budget_credits then
    return jsonb_build_object('status', 'daily_budget_exhausted');
  end if;

  if v_user_daily_total + p_amount_credits
       > v_treasury.max_user_daily_credits then
    return jsonb_build_object('status', 'user_daily_limit');
  end if;

  insert into public.treasury_reservations (
    treasury_id,
    user_id,
    opportunity_key,
    amount_credits,
    idempotency_key,
    expires_at
  ) values (
    v_treasury.id,
    p_user_id,
    p_opportunity_key,
    p_amount_credits,
    p_idempotency_key,
    now() + make_interval(
      mins => greatest(
        1,
        least(coalesce(p_ttl_minutes, 60), 1440)
      )
    )
  )
  returning id into v_reservation_id;

  update public.reward_treasuries
  set reserved_credits = reserved_credits + p_amount_credits,
      updated_at = now()
  where id = v_treasury.id;

  return jsonb_build_object(
    'status', 'reserved',
    'reservation_id', v_reservation_id,
    'amount_credits', p_amount_credits
  );
end;
$$;

revoke all on function public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)
  to service_role;

create or replace function public.release_hourly_pulse_scale_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  with fn as (
    select lower(
      pg_get_functiondef('public.claim_hourly_pulse(uuid)'::regprocedure)
    ) as src
  )
  select
    to_regprocedure('public.claim_hourly_pulse(uuid)') is not null
    and to_regprocedure(
      'private.treasury_daily_usage_snapshot(uuid,uuid,timestamptz)'
    ) is not null
    and not coalesce((
      select prosecdef
      from pg_proc
      where oid = 'public.claim_hourly_pulse(uuid)'::regprocedure
    ), true)
    and has_function_privilege(
      'service_role',
      'public.claim_hourly_pulse(uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.claim_hourly_pulse(uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.claim_hourly_pulse(uuid)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'private.treasury_daily_usage_snapshot(uuid,uuid,timestamptz)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'private.treasury_daily_usage_snapshot(uuid,uuid,timestamptz)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'private.treasury_daily_usage_snapshot(uuid,uuid,timestamptz)',
      'EXECUTE'
    )
    and to_regclass('public.pulse_claims_treasury_created_idx') is not null
    and to_regclass('public.pulse_claims_user_created_idx') is not null
    and to_regclass('public.treasury_reservations_treasury_status_idx') is not null
    and to_regclass('public.treasury_reservations_user_created_idx') is not null
    and to_regclass('public.treasury_reservations_expiry_idx') is not null
    and position('scale_v48_global_critical_section' in (select src from fn)) > 0
    and position('pg_try_advisory_xact_lock' in (select src from fn)) > 0
    and position('claim_in_progress' in (select src from fn)) > 0
    and position('public_fair_share_required' in (select src from fn)) > 0
    and position('not v_pilot_mode' in (select src from fn)) > 0
    and position('perform pg_advisory_xact_lock(' in (select src from fn)) = 0
    and position('insert into public.pulse_claims' in (select src from fn))
        < position('scale_v48_global_critical_section' in (select src from fn))
    and position('refresh_pulse_trust(p_user_id)' in (select src from fn))
        < position('scale_v48_global_critical_section' in (select src from fn))
    and position('for update' in substring(
          (select src from fn)
          from position(
            'scale_v48_global_critical_section' in (select src from fn)
          )
        )) > 0
    and regexp_count(
      (select src from fn),
      'private[.]treasury_daily_usage_snapshot'
    ) = 2
    and position('sum(reward_credits)' in (select src from fn)) = 0
    and position('sum(amount_credits)' in (select src from fn)) = 0
    and position('pulse_claim_abort:daily_budget_exhausted' in (select src from fn)) > 0
    and position('pulse_claim_abort:user_daily_limit' in (select src from fn)) > 0
    and position('when sqlstate ''p0001''' in (select src from fn)) > 0;
$$;

revoke all on function public.release_hourly_pulse_scale_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_hourly_pulse_scale_contract()
  to service_role;

do $$
declare
  v_schema jsonb;
  v_claim_def text;
  v_reserve_def text;
begin
  select value into v_schema
  from public.app_config
  where key='release_schema';

  if coalesce((v_schema->>'version')::integer,0) <> 55
     or coalesce(v_schema->>'migration','') <> '0055_invite_snapshot_compaction.sql' then
    raise exception 'public fair-share authority requires v55/0055';
  end if;

  select lower(pg_get_functiondef('public.claim_hourly_pulse(uuid)'::regprocedure))
  into v_claim_def;
  select lower(pg_get_functiondef(
    'public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)'::regprocedure
  ))
  into v_reserve_def;

  if position('public_fair_share_required' in v_claim_def)=0
     or position('not v_pilot_mode' in v_claim_def)=0
     or position('max_user_daily_credits::numeric * 2' in v_claim_def)=0 then
    raise exception 'claim public fair-share authority missing';
  end if;

  if position('public_fair_share_required' in v_reserve_def)=0
     or position('v_public_mode' in v_reserve_def)=0
     or position('max_user_daily_credits::numeric * 2' in v_reserve_def)=0 then
    raise exception 'reservation public fair-share authority missing';
  end if;

  if not public.release_hourly_pulse_scale_contract() then
    raise exception 'hourly pulse scale contract failed after public fair-share authority';
  end if;

  if not has_function_privilege('service_role','public.claim_hourly_pulse(uuid)','EXECUTE')
     or has_function_privilege('anon','public.claim_hourly_pulse(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.claim_hourly_pulse(uuid)','EXECUTE')
     or not has_function_privilege(
       'service_role',
       'public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)',
       'EXECUTE'
     ) then
    raise exception 'public fair-share execution authority drifted';
  end if;
end
$$;
