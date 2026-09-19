-- Treasury funding v44: calculate the complete internal backing exposure
-- under the Treasury lock and reject stale web-layer liability snapshots.

alter table public.treasury_funding_events
  add column if not exists user_balance_liability_credits bigint not null default 0 check (user_balance_liability_credits >= 0),
  add column if not exists active_withdrawal_liability_credits bigint not null default 0 check (active_withdrawal_liability_credits >= 0),
  add column if not exists active_reservation_liability_credits bigint not null default 0 check (active_reservation_liability_credits >= 0);

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
  v_user_balance_liability bigint := 0;
  v_active_withdrawal_liability bigint := 0;
  v_active_reservation_liability bigint := 0;
  v_liability_credits bigint := 0;
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

  v_liability_credits :=
    v_user_balance_liability
    + v_active_withdrawal_liability
    + v_active_reservation_liability;

  if p_liability_credits <> v_liability_credits then
    return jsonb_build_object(
      'status', 'liability_changed',
      'expected_liability_credits', v_liability_credits
    );
  end if;

  v_required_units := (
    ((v_liability_credits + p_amount_credits) * p_payout_pack_units)
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
    user_balance_liability_credits,
    active_withdrawal_liability_credits,
    active_reservation_liability_credits,
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
    v_liability_credits,
    v_user_balance_liability,
    v_active_withdrawal_liability,
    v_active_reservation_liability,
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
    'liability_credits', v_liability_credits,
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
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'treasury_funding_events'
        and column_name = 'user_balance_liability_credits'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'treasury_funding_events'
        and column_name = 'active_withdrawal_liability_credits'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'treasury_funding_events'
        and column_name = 'active_reservation_liability_credits'
    )
    and to_regprocedure('public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)') is not null
    and coalesce((
      select not prosecdef
      from pg_proc
      where oid = 'public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)'::regprocedure
    ), false)
    and position(
      'user_balances'
      in lower(pg_get_functiondef('public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)'::regprocedure))
    ) > 0
    and position(
      'withdrawals'
      in lower(pg_get_functiondef('public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)'::regprocedure))
    ) > 0
    and position(
      'treasury_reservations'
      in lower(pg_get_functiondef('public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)'::regprocedure))
    ) > 0
    and position(
      'liability_changed'
      in lower(pg_get_functiondef('public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)'::regprocedure))
    ) > 0
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
    );
$$;

revoke all on function public.release_treasury_funding_contract() from public, anon, authenticated;
grant execute on function public.release_treasury_funding_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 44, 'migration', '0044_treasury_liability_backing.sql'),
  44,
  'Atomic complete-liability backing for Treasury funding'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
