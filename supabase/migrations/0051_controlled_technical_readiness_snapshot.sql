-- Supabase v51: one authoritative database snapshot for the public
-- controlled-technical readiness endpoint. Detailed admin readiness remains
-- separate; this returns only data required to decide public technical state.

create or replace function public.controlled_technical_readiness_snapshot()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
with
runtime as (
  select public.release_runtime_contract_snapshot() as value
),
pulse as (
  select coalesce((
    select value
    from public.app_config
    where key = 'hourly_pulse'
  ), '{}'::jsonb) as value
),
treasury as (
  select t.*
  from public.reward_treasuries t, pulse p
  where t.code = coalesce(nullif(trim(p.value->>'treasury_code'), ''), 'launch')
  limit 1
),
pack_authority as (
  select jsonb_build_object(
    'asset', asset,
    'credits', credits,
    'units', units,
    'authority_version', authority_version
  ) as value
  from public.faucetpay_payout_pack_authority
  where singleton is true
),
latest_claim as (
  select jsonb_build_object(
    'id', c.id,
    'user_id', c.user_id,
    'treasury_id', c.treasury_id,
    'reward_credits', c.reward_credits,
    'ledger_entry_id', c.ledger_entry_id,
    'metadata', c.metadata,
    'created_at', c.created_at
  ) as value
  from public.pulse_claims c
  order by c.created_at desc
  limit 1
),
proof_ids as (
  select
    nullif(trim(r.value->'external_proof'->'faucetpay_payout'->>'withdrawal_id'), '')::uuid as payout_withdrawal_id,
    nullif(trim(r.value->'external_proof'->'faucetpay_receipt'->>'withdrawal_id'), '')::uuid as receipt_withdrawal_id
  from runtime r
),
payout_withdrawal as (
  select w.*
  from public.withdrawals w, proof_ids p
  where w.id = p.payout_withdrawal_id
    and w.payout_provider = 'faucetpay'
    and w.status = 'paid'
  limit 1
),
receipt_withdrawal as (
  select w.*
  from public.withdrawals w, proof_ids p
  where w.id = p.receipt_withdrawal_id
    and w.payout_provider = 'faucetpay'
    and w.status = 'paid'
  limit 1
),
chain_claim as (
  select c.*
  from public.pulse_claims c
  join payout_withdrawal w on w.user_id = c.user_id
  join treasury t on t.id = c.treasury_id
  cross join pulse p
  where c.reward_credits = coalesce(nullif(p.value->>'credits','')::integer, 0)
    and c.metadata->>'interval_minutes' = p.value->>'interval_minutes'
    and c.created_at <= w.created_at
  order by c.created_at desc
  limit 1
),
daily as (
  select
    coalesce((
      select sum(c.reward_credits)::bigint
      from public.pulse_claims c, treasury t
      where c.treasury_id = t.id
        and c.created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    ), 0) as claim_credits,
    coalesce((
      select sum(r.amount_credits)::bigint
      from public.treasury_reservations r, treasury t
      where r.treasury_id = t.id
        and r.created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
        and r.status in ('reserved','consumed')
    ), 0) as reservation_credits
)
select jsonb_build_object(
  'snapshot_authority',
    coalesce((
      select
        not prosecdef
        and has_function_privilege(
          'service_role',
          'public.controlled_technical_readiness_snapshot()',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.controlled_technical_readiness_snapshot()',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.controlled_technical_readiness_snapshot()',
          'EXECUTE'
        )
      from pg_catalog.pg_proc
      where oid = 'public.controlled_technical_readiness_snapshot()'::regprocedure
    ), false),
  'runtime', (select value from runtime),
  'hourly_pulse', (select value from pulse),
  'payout_pack_authority', (select value from pack_authority),
  'treasury', (
    select jsonb_build_object(
      'id', id,
      'code', code,
      'funded_credits', funded_credits,
      'reserved_credits', reserved_credits,
      'spent_credits', spent_credits,
      'daily_budget_credits', daily_budget_credits,
      'max_user_daily_credits', max_user_daily_credits,
      'enabled', enabled,
      'kill_switch', kill_switch
    )
    from treasury
  ),
  'daily_claim_credits', (select claim_credits from daily),
  'daily_reservation_credits', (select reservation_credits from daily),
  'latest_claim', (select value from latest_claim),
  'payout_withdrawal', (
    select jsonb_build_object(
      'id', id,
      'user_id', user_id,
      'idempotency_key', idempotency_key,
      'payout_provider', payout_provider,
      'asset', asset,
      'destination', destination,
      'amount_credits', amount_credits,
      'payout_amount_units', payout_amount_units,
      'external_id', external_id,
      'status', status,
      'ledger_entry_id', ledger_entry_id,
      'created_at', created_at
    )
    from payout_withdrawal
  ),
  'receipt_withdrawal', (
    select jsonb_build_object(
      'id', id,
      'user_id', user_id,
      'idempotency_key', idempotency_key,
      'payout_provider', payout_provider,
      'asset', asset,
      'destination', destination,
      'amount_credits', amount_credits,
      'payout_amount_units', payout_amount_units,
      'external_id', external_id,
      'status', status,
      'ledger_entry_id', ledger_entry_id,
      'created_at', created_at
    )
    from receipt_withdrawal
  ),
  'chain_claim', (
    select jsonb_build_object(
      'id', id,
      'user_id', user_id,
      'treasury_id', treasury_id,
      'reward_credits', reward_credits,
      'ledger_entry_id', ledger_entry_id,
      'metadata', metadata,
      'created_at', created_at
    )
    from chain_claim
  ),
  'chain_claim_ledger', (
    select jsonb_build_object(
      'id', le.id,
      'user_id', le.user_id,
      'event_key', le.event_key,
      'entry_type', le.entry_type,
      'state', le.state,
      'credits', le.credits,
      'metadata', le.metadata,
      'created_at', le.created_at
    )
    from public.ledger_entries le, chain_claim c
    where le.id = c.ledger_entry_id
  ),
  'chain_withdrawal_ledger', (
    select jsonb_build_object(
      'id', le.id,
      'user_id', le.user_id,
      'event_key', le.event_key,
      'entry_type', le.entry_type,
      'state', le.state,
      'credits', le.credits,
      'metadata', le.metadata,
      'created_at', le.created_at
    )
    from public.ledger_entries le, payout_withdrawal w
    where le.id = w.ledger_entry_id
  )
);
$$;

revoke all on function public.controlled_technical_readiness_snapshot()
  from public, anon, authenticated, service_role;
grant execute on function public.controlled_technical_readiness_snapshot()
  to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 51, 'migration', '0051_controlled_technical_readiness_snapshot.sql'),
  51,
  'One-query controlled technical readiness snapshot for bounded public health checks'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
