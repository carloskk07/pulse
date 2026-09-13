-- Hourly Pulse core
-- Treasury-backed, deterministic claims with rolling eligibility and trust refresh.
-- Existing Daily Pulse history remains untouched for backwards compatibility.

alter table public.ledger_entries
  drop constraint if exists ledger_entries_entry_type_check;

alter table public.ledger_entries
  add constraint ledger_entries_entry_type_check
  check (entry_type in ('daily_reward','pulse_reward','offer','survey','referral','withdrawal','chargeback','adjustment'));

create table if not exists public.pulse_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  treasury_id uuid not null references public.reward_treasuries(id) on delete restrict,
  reward_credits integer not null check (reward_credits > 0),
  funding_source text not null default 'pulse' check (funding_source in ('pulse','sponsor')),
  ledger_entry_id uuid not null unique references public.ledger_entries(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pulse_claims_user_created_idx
  on public.pulse_claims(user_id, created_at desc);
create index if not exists pulse_claims_treasury_created_idx
  on public.pulse_claims(treasury_id, created_at desc);

alter table public.pulse_claims enable row level security;

drop policy if exists "pulse_claims_read_own" on public.pulse_claims;
create policy "pulse_claims_read_own"
on public.pulse_claims
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.pulse_claims from public, anon, authenticated;
grant select on table public.pulse_claims to authenticated;
grant select, insert, update, delete on table public.pulse_claims to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'hourly_pulse',
  '{"credits":1,"interval_minutes":60,"treasury_code":"launch","max_risk_score":59}'::jsonb,
  1,
  'Deterministic Hourly Pulse; treasury must be explicitly funded and enabled before claims open'
)
on conflict (key) do nothing;

create or replace function public.refresh_pulse_trust(p_user_id uuid)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_risk smallint := 0;
  v_claims bigint := 0;
  v_active_days bigint := 0;
  v_conversions bigint := 0;
  v_paid_withdrawals bigint := 0;
  v_reversals bigint := 0;
  v_level smallint := 0;
begin
  select risk_score into v_risk
  from public.profiles
  where id = p_user_id;

  if not found then return 0; end if;

  select
    count(*),
    count(distinct ((created_at at time zone 'UTC')::date))
  into v_claims, v_active_days
  from public.pulse_claims
  where user_id = p_user_id;

  select count(*) into v_conversions
  from public.monetization_events
  where user_id = p_user_id
    and event_type = 'conversion'
    and status = 'confirmed';

  select count(*) into v_paid_withdrawals
  from public.withdrawals
  where user_id = p_user_id and status = 'paid';

  select count(*) into v_reversals
  from public.monetization_events
  where user_id = p_user_id and event_type = 'chargeback';

  if v_risk < 80 and v_claims >= 3 then v_level := 1; end if;
  if v_risk < 60 and v_claims >= 12 and v_active_days >= 2 then v_level := 2; end if;
  if v_risk < 60 and v_conversions >= 1 and v_claims >= 12 then v_level := 3; end if;
  if v_risk < 40 and v_paid_withdrawals >= 1 and v_claims >= 24 and v_active_days >= 3 then v_level := 4; end if;
  if v_risk < 40 and v_paid_withdrawals >= 2 and v_claims >= 72 and v_active_days >= 7 and v_reversals = 0 then v_level := 5; end if;

  update public.profiles
  set trust_level = v_level,
      updated_at = now()
  where id = p_user_id;

  return v_level;
end;
$$;

create or replace function public.claim_hourly_pulse(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config jsonb := '{}'::jsonb;
  v_reward integer := 1;
  v_interval_minutes integer := 60;
  v_treasury_code text := 'launch';
  v_max_risk integer := 59;
  v_profile public.profiles%rowtype;
  v_treasury public.reward_treasuries%rowtype;
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

  select * into v_treasury
  from public.reward_treasuries
  where code = v_treasury_code
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

create or replace function public.refresh_pulse_trust_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_pulse_trust(new.user_id);
  return new;
end;
$$;

drop trigger if exists pulse_trust_after_monetization on public.monetization_events;
create trigger pulse_trust_after_monetization
after insert on public.monetization_events
for each row execute function public.refresh_pulse_trust_trigger();

drop trigger if exists pulse_trust_after_withdrawal on public.withdrawals;
create trigger pulse_trust_after_withdrawal
after update of status on public.withdrawals
for each row
when (old.status is distinct from new.status)
execute function public.refresh_pulse_trust_trigger();

create or replace function public.pulse_public_snapshot()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'claims_24h', (select count(*) from public.pulse_claims where created_at >= now() - interval '24 hours'),
    'unique_users_24h', (select count(distinct user_id) from public.pulse_claims where created_at >= now() - interval '24 hours'),
    'credited_24h_credits', (select coalesce(sum(reward_credits), 0) from public.pulse_claims where created_at >= now() - interval '24 hours'),
    'credited_all_time_credits', (select coalesce(sum(reward_credits), 0) from public.pulse_claims),
    'confirmed_turbos_24h', (select count(*) from public.monetization_events where event_type = 'conversion' and status = 'confirmed' and created_at >= now() - interval '24 hours'),
    'paid_withdrawals_all_time', (select count(*) from public.withdrawals where status = 'paid'),
    'paid_withdrawal_credits_all_time', (select coalesce(sum(amount_credits), 0) from public.withdrawals where status = 'paid')
  );
$$;

revoke all on function public.refresh_pulse_trust(uuid) from public, anon, authenticated;
revoke all on function public.claim_hourly_pulse(uuid) from public, anon, authenticated;
revoke all on function public.refresh_pulse_trust_trigger() from public, anon, authenticated;
revoke all on function public.pulse_public_snapshot() from public, anon, authenticated;

grant execute on function public.refresh_pulse_trust(uuid) to service_role;
grant execute on function public.claim_hourly_pulse(uuid) to service_role;
grant execute on function public.pulse_public_snapshot() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 21, 'migration', '0021_hourly_pulse_core.sql'),
  21,
  'Treasury-backed rolling Hourly Pulse, Pulse Trust and public proof foundation'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
