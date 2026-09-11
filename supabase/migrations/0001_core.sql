-- Reward Pulse core schema
-- Ledger-first, idempotent provider events, additive evolution.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  trust_level smallint not null default 0 check (trust_level between 0 and 10),
  risk_score smallint not null default 0 check (risk_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null unique,
  entry_type text not null check (entry_type in ('daily_reward','offer','survey','referral','withdrawal','chargeback','adjustment')),
  state text not null check (state in ('pending','confirmed','available','withdrawn','reversed')),
  credits bigint not null,
  usd_micros bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ledger_entries_user_created_idx on public.ledger_entries(user_id, created_at desc);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  claim_day date not null default current_date,
  reward_credits integer not null check (reward_credits > 0),
  ledger_entry_id uuid not null references public.ledger_entries(id),
  created_at timestamptz not null default now(),
  unique (user_id, claim_day)
);

create table if not exists public.monetization_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('conversion','chargeback')),
  status text not null check (status in ('pending','confirmed','reversed')),
  payout_usd_micros bigint not null default 0,
  reward_credits bigint not null default 0,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (provider, external_id, event_type)
);

create index if not exists monetization_events_user_created_idx on public.monetization_events(user_id, created_at desc);

create table if not exists public.provider_callbacks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_key text not null,
  payload_hash text not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique (provider, external_event_key)
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null unique,
  payout_provider text not null,
  asset text not null,
  destination text not null,
  amount_credits bigint not null check (amount_credits > 0),
  status text not null default 'requested' check (status in ('requested','held','submitted','paid','failed','cancelled')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawals_user_created_idx on public.withdrawals(user_id, created_at desc);

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  signal text not null,
  score_delta smallint not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  version integer not null default 1,
  reason text,
  updated_at timestamptz not null default now()
);

create or replace view public.user_balances
with (security_invoker = true) as
select
  user_id,
  coalesce(sum(case when state = 'available' then credits else 0 end), 0)::bigint as available_credits,
  coalesce(sum(case when state = 'pending' then credits else 0 end), 0)::bigint as pending_credits
from public.ledger_entries
group by user_id;

alter table public.profiles enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.claims enable row level security;
alter table public.monetization_events enable row level security;
alter table public.provider_callbacks enable row level security;
alter table public.withdrawals enable row level security;
alter table public.risk_events enable row level security;
alter table public.app_config enable row level security;

create policy "profiles_read_own" on public.profiles for select using (auth.uid() = id);
create policy "ledger_read_own" on public.ledger_entries for select using (auth.uid() = user_id);
create policy "claims_read_own" on public.claims for select using (auth.uid() = user_id);
create policy "events_read_own" on public.monetization_events for select using (auth.uid() = user_id);
create policy "withdrawals_read_own" on public.withdrawals for select using (auth.uid() = user_id);
create policy "risk_read_own" on public.risk_events for select using (auth.uid() = user_id);

-- Writes to financial tables intentionally have no client-side policies.
-- They must be performed by trusted server code using the service role.
