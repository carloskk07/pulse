-- Reward Exchange foundation
-- Additive treasury controls + normalized opportunity catalog.
-- The user ledger remains the only balance authority.

create table if not exists public.reward_treasuries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  asset text not null default 'CREDITS',
  funded_credits bigint not null default 0 check (funded_credits >= 0),
  reserved_credits bigint not null default 0 check (reserved_credits >= 0),
  spent_credits bigint not null default 0 check (spent_credits >= 0),
  daily_budget_credits bigint not null default 0 check (daily_budget_credits >= 0),
  max_user_daily_credits bigint not null default 0 check (max_user_daily_credits >= 0),
  enabled boolean not null default false,
  kill_switch boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved_credits + spent_credits <= funded_credits)
);

create table if not exists public.treasury_reservations (
  id uuid primary key default gen_random_uuid(),
  treasury_id uuid not null references public.reward_treasuries(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_key text not null,
  amount_credits bigint not null check (amount_credits > 0),
  status text not null default 'reserved' check (status in ('reserved','consumed','released','expired')),
  idempotency_key text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treasury_reservations_treasury_status_idx
  on public.treasury_reservations(treasury_id, status, created_at desc);
create index if not exists treasury_reservations_user_created_idx
  on public.treasury_reservations(user_id, created_at desc);

create table if not exists public.reward_opportunities (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  title text not null,
  category text not null default 'other',
  payout_usd_micros bigint not null default 0 check (payout_usd_micros >= 0),
  base_reward_credits bigint not null default 0 check (base_reward_credits >= 0),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  completion_probability numeric(6,5) check (completion_probability is null or (completion_probability >= 0 and completion_probability <= 1)),
  tracking_reliability numeric(6,5) check (tracking_reliability is null or (tracking_reliability >= 0 and tracking_reliability <= 1)),
  payout_reliability numeric(6,5) check (payout_reliability is null or (payout_reliability >= 0 and payout_reliability <= 1)),
  reversal_rate numeric(6,5) check (reversal_rate is null or (reversal_rate >= 0 and reversal_rate <= 1)),
  country_codes text[] not null default '{}',
  device_platforms text[] not null default '{}',
  status text not null default 'active' check (status in ('active','paused','expired')),
  metadata jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create index if not exists reward_opportunities_status_refreshed_idx
  on public.reward_opportunities(status, refreshed_at desc);
create index if not exists reward_opportunities_provider_status_idx
  on public.reward_opportunities(provider, status);

alter table public.reward_treasuries enable row level security;
alter table public.treasury_reservations enable row level security;
alter table public.reward_opportunities enable row level security;

-- These tables intentionally expose no anon/authenticated policies.
-- Only trusted server code using service_role may read/write them.

insert into public.reward_treasuries (
  code, name, funded_credits, daily_budget_credits, max_user_daily_credits, enabled, kill_switch
)
values ('launch', 'Launch Reward Treasury', 0, 0, 0, false, true)
on conflict (code) do nothing;

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
set search_path = public
as $$
declare
  v_treasury public.reward_treasuries%rowtype;
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

  select * into v_treasury
  from public.reward_treasuries
  where code = p_treasury_code
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

create or replace function public.finalize_treasury_reservation(
  p_idempotency_key text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
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

create or replace function public.reward_treasury_snapshot()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'code', code,
      'name', name,
      'asset', asset,
      'funded_credits', funded_credits,
      'reserved_credits', reserved_credits,
      'spent_credits', spent_credits,
      'available_credits', funded_credits - reserved_credits - spent_credits,
      'daily_budget_credits', daily_budget_credits,
      'max_user_daily_credits', max_user_daily_credits,
      'enabled', enabled,
      'kill_switch', kill_switch
    ) order by code
  ), '[]'::jsonb)
  from public.reward_treasuries;
$$;

create or replace function public.release_reward_exchange_contract()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    to_regclass('public.reward_treasuries') is not null
    and to_regclass('public.treasury_reservations') is not null
    and to_regclass('public.reward_opportunities') is not null
    and coalesce((select relrowsecurity from pg_class where oid = 'public.reward_treasuries'::regclass), false)
    and coalesce((select relrowsecurity from pg_class where oid = 'public.treasury_reservations'::regclass), false)
    and coalesce((select relrowsecurity from pg_class where oid = 'public.reward_opportunities'::regclass), false);
$$;

revoke all on table public.reward_treasuries from public, anon, authenticated;
revoke all on table public.treasury_reservations from public, anon, authenticated;
revoke all on table public.reward_opportunities from public, anon, authenticated;

grant select, insert, update, delete on table public.reward_treasuries to service_role;
grant select, insert, update, delete on table public.treasury_reservations to service_role;
grant select, insert, update, delete on table public.reward_opportunities to service_role;

revoke all on function public.reserve_treasury_boost(text,uuid,text,bigint,text,integer) from public, anon, authenticated;
revoke all on function public.finalize_treasury_reservation(text,text) from public, anon, authenticated;
revoke all on function public.reward_treasury_snapshot() from public, anon, authenticated;
revoke all on function public.release_reward_exchange_contract() from public, anon, authenticated;

grant execute on function public.reserve_treasury_boost(text,uuid,text,bigint,text,integer) to service_role;
grant execute on function public.finalize_treasury_reservation(text,text) to service_role;
grant execute on function public.reward_treasury_snapshot() to service_role;
grant execute on function public.release_reward_exchange_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 11, 'migration', '0011_reward_exchange_foundation.sql'),
  11,
  'Reward Exchange treasury and normalized opportunity foundation'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
