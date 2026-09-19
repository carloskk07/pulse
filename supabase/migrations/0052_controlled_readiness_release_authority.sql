-- Supabase v52: release-attested controlled readiness authority.
-- Heavy schema/security contracts are evaluated once by the migration owner.
-- Runtime service_role can read the resulting authority but cannot mutate it.

create table public.controlled_readiness_release_authority (
  singleton boolean primary key default true check (singleton is true),
  schema_version integer not null check (schema_version > 0),
  schema_migration text not null check (length(trim(schema_migration)) > 0),
  contracts_passed boolean not null,
  contracts jsonb not null,
  attested_at timestamptz not null default now()
);

alter table public.controlled_readiness_release_authority enable row level security;

revoke all on table public.controlled_readiness_release_authority
  from public, anon, authenticated, service_role;
grant select on table public.controlled_readiness_release_authority
  to service_role;

do $$
declare
  v_snapshot jsonb;
  v_contracts jsonb;
  v_security jsonb;
  v_pass boolean;
begin
  select public.release_runtime_contract_snapshot() into v_snapshot;
  v_security := coalesce(v_snapshot->'security', '{}'::jsonb);

  v_pass :=
    coalesce((v_snapshot->>'snapshot_authority')::boolean, false)
    and coalesce((v_snapshot->>'economics_ok')::boolean, false)
    and coalesce((v_snapshot->>'referral_ok')::boolean, false)
    and coalesce((v_snapshot->>'authenticated_read_scope')::boolean, false)
    and coalesce((v_snapshot->>'withdrawal_read')::boolean, false)
    and coalesce((v_snapshot->>'withdrawal_settlement')::boolean, false)
    and coalesce((v_snapshot->>'withdrawal_pilot')::boolean, false)
    and coalesce((v_snapshot->>'faucetpay_proof_chain')::boolean, false)
    and coalesce((v_snapshot->>'reward_exchange')::boolean, false)
    and coalesce((v_snapshot->>'treasury_funding')::boolean, false)
    and coalesce((v_snapshot->>'treasury_backing')::boolean, false)
    and coalesce((v_snapshot->>'opportunity_intelligence')::boolean, false)
    and coalesce((v_snapshot->>'pulse_direct')::boolean, false)
    and coalesce((v_snapshot->>'business_intake')::boolean, false)
    and coalesce((v_snapshot->>'advertiser_outbound')::boolean, false)
    and coalesce((v_snapshot->>'hourly_pilot')::boolean, false)
    and coalesce((v_snapshot->>'hourly_scale')::boolean, false)
    and coalesce((v_snapshot->>'user_balance_materialization')::boolean, false)
    and v_security->>'status' = 'ok'
    and coalesce((v_security->>'profiles_rls')::boolean, false)
    and coalesce((v_security->>'ledger_rls')::boolean, false)
    and coalesce((v_security->>'claims_rls')::boolean, false)
    and coalesce((v_security->>'referrals_rls')::boolean, false)
    and coalesce((v_security->>'withdrawals_rls')::boolean, false)
    and coalesce((v_security->>'app_config_rls')::boolean, false)
    and not coalesce((v_security->>'anon_app_config_select')::boolean, true)
    and not coalesce((v_security->>'anon_ledger_select')::boolean, true)
    and coalesce((v_security->>'authenticated_profile_select')::boolean, false)
    and coalesce((v_security->>'authenticated_ledger_select')::boolean, false)
    and coalesce((v_security->>'authenticated_claims_select')::boolean, false)
    and coalesce((v_security->>'authenticated_referrals_select')::boolean, false)
    and coalesce((v_security->>'authenticated_balance_select')::boolean, false)
    and coalesce((v_security->>'service_app_config_select')::boolean, false)
    and coalesce((v_security->>'service_withdrawals_insert')::boolean, false)
    and coalesce((v_security->>'service_withdrawals_update')::boolean, false)
    and not coalesce((v_security->>'authenticated_claim_rpc_execute')::boolean, true)
    and coalesce((v_security->>'service_claim_rpc_execute')::boolean, false)
    and not coalesce((v_security->>'claim_security_definer')::boolean, true)
    and coalesce((v_security->>'callback_security_definer')::boolean, false);

  if not v_pass then
    raise exception 'v52 release authority refused: one or more static release contracts failed';
  end if;

  v_contracts := v_snapshot
    - 'schema_version'
    - 'schema_migration'
    - 'external_proof';

  insert into public.controlled_readiness_release_authority(
    singleton,
    schema_version,
    schema_migration,
    contracts_passed,
    contracts
  )
  values (
    true,
    52,
    '0052_controlled_readiness_release_authority.sql',
    true,
    v_contracts
  );
end
$$;

create or replace function public.controlled_technical_readiness_snapshot()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
with
schema_marker as (
  select
    coalesce(nullif(value->>'version','')::integer, version, 0) as schema_version,
    coalesce(value->>'migration', '') as schema_migration
  from public.app_config
  where key = 'release_schema'
),
release_authority as (
  select
    schema_version,
    schema_migration,
    contracts_passed,
    attested_at
  from public.controlled_readiness_release_authority
  where singleton is true
),
proof as (
  select coalesce((
    select value
    from public.app_config
    where key = 'release_external_proof'
  ), '{}'::jsonb) as value
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
    nullif(trim(p.value->'faucetpay_payout'->>'withdrawal_id'), '')::uuid as payout_withdrawal_id,
    nullif(trim(p.value->'faucetpay_receipt'->>'withdrawal_id'), '')::uuid as receipt_withdrawal_id
  from proof p
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
  'authority_runtime_lock',
    has_table_privilege(
      'service_role',
      'public.controlled_readiness_release_authority',
      'SELECT'
    )
    and not has_table_privilege(
      'service_role',
      'public.controlled_readiness_release_authority',
      'INSERT'
    )
    and not has_table_privilege(
      'service_role',
      'public.controlled_readiness_release_authority',
      'UPDATE'
    )
    and not has_table_privilege(
      'service_role',
      'public.controlled_readiness_release_authority',
      'DELETE'
    )
    and not has_table_privilege(
      'service_role',
      'public.controlled_readiness_release_authority',
      'TRUNCATE'
    ),
  'schema_version', (select schema_version from schema_marker),
  'schema_migration', (select schema_migration from schema_marker),
  'release_authority', (
    select jsonb_build_object(
      'schema_version', schema_version,
      'schema_migration', schema_migration,
      'contracts_passed', contracts_passed,
      'attested_at', attested_at
    )
    from release_authority
  ),
  'external_proof', (select value from proof),
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
  jsonb_build_object('version', 52, 'migration', '0052_controlled_readiness_release_authority.sql'),
  52,
  'Attest static release contracts once and keep runtime readiness dynamic and read-only'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
