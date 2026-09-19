-- Controlled Treasury funding authority.
-- Funding never calls FaucetPay /send. The server must first observe current
-- FaucetPay read-only balance and pass the backing evidence into this RPC.

create table if not exists public.treasury_funding_events (
  id uuid primary key default gen_random_uuid(),
  treasury_id uuid not null references public.reward_treasuries(id) on delete restrict,
  amount_credits bigint not null check (amount_credits > 0),
  idempotency_key text not null unique check (length(trim(idempotency_key)) >= 8),
  backing_provider text not null default 'faucetpay' check (backing_provider = 'faucetpay'),
  backing_asset text not null check (length(trim(backing_asset)) between 2 and 16),
  backing_balance_units bigint not null check (backing_balance_units >= 0),
  liability_credits bigint not null check (liability_credits >= 0),
  payout_pack_credits bigint not null check (payout_pack_credits > 0),
  payout_pack_units bigint not null check (payout_pack_units > 0),
  backing_required_units bigint not null check (backing_required_units > 0),
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (length(trim(reason)) between 3 and 240),
  funded_credits_before bigint not null check (funded_credits_before >= 0),
  funded_credits_after bigint not null check (funded_credits_after >= funded_credits_before),
  created_at timestamptz not null default now(),
  check (backing_balance_units >= backing_required_units),
  check (funded_credits_after = funded_credits_before + amount_credits)
);

create index if not exists treasury_funding_events_treasury_created_idx
  on public.treasury_funding_events(treasury_id, created_at desc);

alter table public.treasury_funding_events enable row level security;

revoke all on table public.treasury_funding_events from public, anon, authenticated;
grant select, insert on table public.treasury_funding_events to service_role;

create or replace function public.fund_reward_treasury(
  p_treasury_code text,
  p_amount_credits bigint,
  p_idempotency_key text,
  p_backing_asset text,
  p_backing_balance_units bigint,
  p_liability_credits bigint,
  p_payout_pack_credits bigint,
  p_payout_pack_units bigint,
  p_actor_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_treasury public.reward_treasuries%rowtype;
  v_existing public.treasury_funding_events%rowtype;
  v_required_units bigint;
  v_event_id uuid;
begin
  if coalesce(trim(p_treasury_code), '') = ''
     or coalesce(trim(p_idempotency_key), '') = ''
     or coalesce(trim(p_backing_asset), '') = ''
     or coalesce(trim(p_reason), '') = ''
     or p_actor_user_id is null
     or p_amount_credits is null or p_amount_credits <= 0
     or p_backing_balance_units is null or p_backing_balance_units < 0
     or p_liability_credits is null or p_liability_credits < 0
     or p_payout_pack_credits is null or p_payout_pack_credits <= 0
     or p_payout_pack_units is null or p_payout_pack_units <= 0 then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select * into v_treasury
  from public.reward_treasuries
  where code = trim(p_treasury_code)
  for update;

  if not found then
    return jsonb_build_object('status', 'unknown_treasury');
  end if;

  if v_treasury.daily_budget_credits <= 0 then
    return jsonb_build_object('status', 'budget_disabled');
  end if;

  if p_amount_credits <> v_treasury.daily_budget_credits then
    return jsonb_build_object(
      'status', 'invalid_budget_amount',
      'expected_credits', v_treasury.daily_budget_credits
    );
  end if;

  select * into v_existing
  from public.treasury_funding_events
  where idempotency_key = trim(p_idempotency_key);

  if found then
    if v_existing.treasury_id <> v_treasury.id
       or v_existing.amount_credits <> p_amount_credits
       or v_existing.actor_user_id <> p_actor_user_id then
      return jsonb_build_object('status', 'idempotency_conflict');
    end if;

    return jsonb_build_object(
      'status', 'already_funded',
      'event_id', v_existing.id,
      'amount_credits', v_existing.amount_credits,
      'funded_credits', v_existing.funded_credits_after
    );
  end if;

  v_required_units := (
    ((p_liability_credits + p_amount_credits) * p_payout_pack_units)
    + p_payout_pack_credits - 1
  ) / p_payout_pack_credits;

  if v_required_units <= 0 or p_backing_balance_units < v_required_units then
    return jsonb_build_object(
      'status', 'insufficient_backing',
      'required_units', greatest(v_required_units, 0),
      'observed_units', p_backing_balance_units
    );
  end if;

  insert into public.treasury_funding_events (
    treasury_id,
    amount_credits,
    idempotency_key,
    backing_provider,
    backing_asset,
    backing_balance_units,
    liability_credits,
    payout_pack_credits,
    payout_pack_units,
    backing_required_units,
    actor_user_id,
    reason,
    funded_credits_before,
    funded_credits_after
  )
  values (
    v_treasury.id,
    p_amount_credits,
    trim(p_idempotency_key),
    'faucetpay',
    upper(trim(p_backing_asset)),
    p_backing_balance_units,
    p_liability_credits,
    p_payout_pack_credits,
    p_payout_pack_units,
    v_required_units,
    p_actor_user_id,
    trim(p_reason),
    v_treasury.funded_credits,
    v_treasury.funded_credits + p_amount_credits
  )
  returning id into v_event_id;

  update public.reward_treasuries
  set funded_credits = funded_credits + p_amount_credits,
      updated_at = now()
  where id = v_treasury.id;

  return jsonb_build_object(
    'status', 'funded',
    'event_id', v_event_id,
    'amount_credits', p_amount_credits,
    'required_units', v_required_units,
    'observed_units', p_backing_balance_units,
    'funded_credits', v_treasury.funded_credits + p_amount_credits
  );
end;
$$;

revoke all on function public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)
  from public, anon, authenticated;
grant execute on function public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)
  to service_role;

create or replace function public.release_treasury_funding_contract()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    to_regclass('public.treasury_funding_events') is not null
    and coalesce((
      select relrowsecurity
      from pg_class
      where oid = 'public.treasury_funding_events'::regclass
    ), false)
    and to_regprocedure('public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)') is not null
    and coalesce((
      select not prosecdef
      from pg_proc
      where oid = 'public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)'::regprocedure
    ), false)
    and has_function_privilege(
      'service_role',
      'public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)',
      'EXECUTE'
    )
    and has_table_privilege('service_role', 'public.treasury_funding_events', 'SELECT')
    and has_table_privilege('service_role', 'public.treasury_funding_events', 'INSERT')
    and not has_table_privilege('anon', 'public.treasury_funding_events', 'SELECT')
    and not has_table_privilege('authenticated', 'public.treasury_funding_events', 'SELECT');
$$;

revoke all on function public.release_treasury_funding_contract() from public, anon, authenticated;
grant execute on function public.release_treasury_funding_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 43, 'migration', '0043_treasury_funding_authority.sql'),
  43,
  'Backed and auditable Treasury funding authority'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
