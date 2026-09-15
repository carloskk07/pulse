-- Supabase v33: make Treasury reservation TTL authoritative.
--
-- Reservations already carried expires_at/status=expired, but no runtime path
-- transitioned overdue rows or released their reserved credits. This could
-- strand Treasury capacity indefinitely and allowed a late finalize/consume.

create or replace function public.release_expired_treasury_reservations(p_treasury_id uuid)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_released bigint := 0;
begin
  if p_treasury_id is null then
    return 0;
  end if;

  with expired as (
    update public.treasury_reservations
    set status = 'expired',
        updated_at = now()
    where treasury_id = p_treasury_id
      and status = 'reserved'
      and expires_at <= now()
    returning amount_credits
  )
  select coalesce(sum(amount_credits), 0)::bigint
  into v_released
  from expired;

  if v_released > 0 then
    update public.reward_treasuries
    set reserved_credits = greatest(0, reserved_credits - v_released),
        updated_at = now()
    where id = p_treasury_id;
  end if;

  return v_released;
end;
$$;

revoke all on function public.release_expired_treasury_reservations(uuid) from public, anon, authenticated;
grant execute on function public.release_expired_treasury_reservations(uuid) to service_role;

create or replace function public.finalize_treasury_reservation(p_idempotency_key text, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_reservation public.treasury_reservations%rowtype;
  v_next_status text;
begin
  if p_action not in ('consume','release') then
    return jsonb_build_object('status', 'invalid_action');
  end if;

  select * into v_reservation
  from public.treasury_reservations
  where idempotency_key = p_idempotency_key
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_reservation.status = 'reserved' and v_reservation.expires_at <= now() then
    update public.reward_treasuries
    set reserved_credits = greatest(0, reserved_credits - v_reservation.amount_credits),
        updated_at = now()
    where id = v_reservation.treasury_id;

    update public.treasury_reservations
    set status = 'expired',
        updated_at = now()
    where id = v_reservation.id;

    return jsonb_build_object(
      'status', 'expired',
      'reservation_id', v_reservation.id,
      'amount_credits', v_reservation.amount_credits
    );
  end if;

  if v_reservation.status <> 'reserved' then
    return jsonb_build_object(
      'status', 'idempotent',
      'reservation_status', v_reservation.status,
      'amount_credits', v_reservation.amount_credits
    );
  end if;

  v_next_status := case when p_action = 'consume' then 'consumed' else 'released' end;

  update public.reward_treasuries
  set reserved_credits = greatest(0, reserved_credits - v_reservation.amount_credits),
      spent_credits = spent_credits + case when p_action = 'consume' then v_reservation.amount_credits else 0 end,
      updated_at = now()
  where id = v_reservation.treasury_id;

  update public.treasury_reservations
  set status = v_next_status,
      updated_at = now()
  where id = v_reservation.id;

  return jsonb_build_object(
    'status', v_next_status,
    'reservation_id', v_reservation.id,
    'amount_credits', v_reservation.amount_credits
  );
end;
$$;

revoke all on function public.finalize_treasury_reservation(text,text) from public, anon, authenticated;
grant execute on function public.finalize_treasury_reservation(text,text) to service_role;

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
begin
  if p_user_id is null or coalesce(trim(p_opportunity_key), '') = '' or coalesce(trim(p_idempotency_key), '') = ''
     or p_amount_credits is null or p_amount_credits <= 0 then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select * into v_existing
  from public.treasury_reservations
  where idempotency_key = p_idempotency_key;

  if found then
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

  if v_treasury.daily_budget_credits <= 0 or v_treasury.max_user_daily_credits <= 0 then
    return jsonb_build_object('status', 'budget_disabled');
  end if;

  v_available := v_treasury.funded_credits - v_treasury.reserved_credits - v_treasury.spent_credits;
  if p_amount_credits > v_available then
    return jsonb_build_object('status', 'insufficient_treasury');
  end if;

  select coalesce(sum(amount_credits), 0)
  into v_daily_total
  from public.treasury_reservations
  where treasury_id = v_treasury.id
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    and status in ('reserved','consumed');

  if v_daily_total + p_amount_credits > v_treasury.daily_budget_credits then
    return jsonb_build_object('status', 'daily_budget_exhausted');
  end if;

  select coalesce(sum(amount_credits), 0)
  into v_user_daily_total
  from public.treasury_reservations
  where treasury_id = v_treasury.id
    and user_id = p_user_id
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    and status in ('reserved','consumed');

  if v_user_daily_total + p_amount_credits > v_treasury.max_user_daily_credits then
    return jsonb_build_object('status', 'user_daily_limit');
  end if;

  insert into public.treasury_reservations (
    treasury_id, user_id, opportunity_key, amount_credits, idempotency_key, expires_at
  ) values (
    v_treasury.id,
    p_user_id,
    p_opportunity_key,
    p_amount_credits,
    p_idempotency_key,
    now() + make_interval(mins => greatest(1, least(coalesce(p_ttl_minutes, 60), 1440)))
  ) returning id into v_reservation_id;

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

revoke all on function public.reserve_treasury_boost(text,uuid,text,bigint,text,integer) from public, anon, authenticated;
grant execute on function public.reserve_treasury_boost(text,uuid,text,bigint,text,integer) to service_role;

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

  select id into v_treasury_id
  from public.reward_treasuries
  where code = v_treasury_code;

  if not found then
    return jsonb_build_object('status', 'treasury_missing');
  end if;

  perform public.release_expired_treasury_reservations(v_treasury_id);

  select * into v_treasury
  from public.reward_treasuries
  where id = v_treasury_id
  for update;

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
  into v_daily_total
  from public.pulse_claims
  where treasury_id = v_treasury.id
    and created_at >= v_today_start;

  select coalesce(sum(amount_credits), 0)
  into v_reservation_daily
  from public.treasury_reservations
  where treasury_id = v_treasury.id
    and created_at >= v_today_start
    and status in ('reserved','consumed');

  if v_daily_total + v_reservation_daily + v_reward > v_treasury.daily_budget_credits then
    return jsonb_build_object('status', 'daily_budget_exhausted');
  end if;

  select coalesce(sum(reward_credits), 0)
  into v_user_daily_total
  from public.pulse_claims
  where treasury_id = v_treasury.id
    and user_id = p_user_id
    and created_at >= v_today_start;

  select coalesce(sum(amount_credits), 0)
  into v_user_reservation_daily
  from public.treasury_reservations
  where treasury_id = v_treasury.id
    and user_id = p_user_id
    and created_at >= v_today_start
    and status in ('reserved','consumed');

  if v_user_daily_total + v_user_reservation_daily + v_reward > v_treasury.max_user_daily_credits then
    return jsonb_build_object('status', 'user_daily_limit');
  end if;

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
    v_treasury.id,
    v_reward,
    'pulse',
    v_ledger_id,
    jsonb_build_object('interval_minutes', v_interval_minutes)
  );

  update public.reward_treasuries
  set spent_credits = spent_credits + v_reward,
      updated_at = now()
  where id = v_treasury.id;

  v_trust := public.refresh_pulse_trust(p_user_id);
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

create or replace function public.release_reward_exchange_contract()
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    to_regclass('public.reward_treasuries') is not null
    and to_regclass('public.treasury_reservations') is not null
    and to_regclass('public.reward_opportunities') is not null
    and to_regprocedure('public.release_expired_treasury_reservations(uuid)') is not null
    and coalesce((select relrowsecurity from pg_catalog.pg_class where oid = 'public.reward_treasuries'::regclass), false)
    and coalesce((select relrowsecurity from pg_catalog.pg_class where oid = 'public.treasury_reservations'::regclass), false)
    and coalesce((select relrowsecurity from pg_catalog.pg_class where oid = 'public.reward_opportunities'::regclass), false)
    and not has_function_privilege('anon', 'public.release_expired_treasury_reservations(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.release_expired_treasury_reservations(uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.release_expired_treasury_reservations(uuid)', 'EXECUTE')
    and not exists (
      select 1
      from public.reward_treasuries t
      where t.reserved_credits <> coalesce((
        select sum(r.amount_credits)
        from public.treasury_reservations r
        where r.treasury_id = t.id and r.status = 'reserved'
      ), 0)
    );
$$;

revoke all on function public.release_reward_exchange_contract() from public, anon, authenticated;
grant execute on function public.release_reward_exchange_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 33, 'migration', '0033_treasury_reservation_expiry.sql'),
  33,
  'Treasury reservation TTL is authoritative; overdue reservations release capacity before claim/reserve and cannot be consumed late'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
