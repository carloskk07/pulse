create or replace function public.claim_hourly_pulse(p_user_id uuid)
returns jsonb
language plpgsql
set search_path to 'pg_catalog', 'public'
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

create or replace function public.release_hourly_pulse_pilot_contract()
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select
    not has_function_privilege('anon', 'public.claim_hourly_pulse(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.claim_hourly_pulse(uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.claim_hourly_pulse(uuid)', 'EXECUTE')
    and position('pilot_mode' in pg_get_functiondef('public.claim_hourly_pulse(uuid)'::regprocedure)) > 0
    and position('pilot_user_ids' in pg_get_functiondef('public.claim_hourly_pulse(uuid)'::regprocedure)) > 0
    and position('pilot_restricted' in pg_get_functiondef('public.claim_hourly_pulse(uuid)'::regprocedure)) > 0;
$$;

revoke all on function public.release_hourly_pulse_pilot_contract() from public, anon, authenticated;
grant execute on function public.release_hourly_pulse_pilot_contract() to service_role;

update public.app_config
set value = jsonb_set(
              jsonb_set(coalesce(value, '{}'::jsonb), '{pilot_mode}', 'false'::jsonb, true),
              '{pilot_user_ids}', '[]'::jsonb, true
            ),
    version = greatest(version, 2),
    reason = 'Hourly Pulse supports isolated pilot allowlisting; pilot mode remains disabled until explicitly activated',
    updated_at = now()
where key = 'hourly_pulse';

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 36, 'migration', '0036_hourly_pulse_pilot_isolation.sql'),
  36,
  'Hourly Pulse can be restricted to an explicit pilot user allowlist before a controlled Treasury test'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();