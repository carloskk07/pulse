-- V13.7 variable reward awareness for controlled readiness snapshots.
-- Keep the canonical release schema at v55/0055 while allowing readiness
-- proofs to accept any reward band authorized by the active faucet contract.

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
economy as (
  select coalesce((
    select value
    from public.app_config
    where key = 'pulse_economy_v13'
  ), '{}'::jsonb) as value
),
reward_mode as (
  select
    (
      coalesce(lower(e.value->>'variable_reward_enabled') in ('true','1','yes','on'), false)
      and not coalesce(lower(e.value->>'variable_reward_review_required') in ('true','1','yes','on'), true)
      and public.variable_reward_model_valid(e.value)
    ) as variable_active,
    e.value as value
  from economy e
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
  cross join reward_mode rm
  where (
      (
        rm.variable_active
        and exists (
          select 1
          from jsonb_array_elements(
            case
              when jsonb_typeof(rm.value->'reward_bands') = 'array'
                then rm.value->'reward_bands'
              else '[]'::jsonb
            end
          ) band
          where jsonb_typeof(band->'credits') = 'number'
            and (band->>'credits')::integer = c.reward_credits
        )
      )
      or (
        not rm.variable_active
        and c.reward_credits = coalesce(nullif(p.value->>'credits','')::integer, 0)
      )
    )
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
  'pulse_economy', (select value from economy),
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

create or replace function public.release_variable_reward_execution_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
with sources as (
  select
    lower(pg_get_functiondef('public.resolve_hourly_pulse_reward(integer)'::regprocedure)) as resolver_src,
    lower(pg_get_functiondef('public.controlled_technical_readiness_snapshot()'::regprocedure)) as snapshot_src
)
select
  position('variable_reward_model_valid' in (select resolver_src from sources)) > 0
  and position('variable_reward_public_open_ready' in (select resolver_src from sources)) > 0
  and position('v_pilot_mode' in (select resolver_src from sources)) > 0
  and position('extensions.gen_random_bytes' in (select resolver_src from sources)) > 0
  and position('v_sample < 60000' in (select resolver_src from sources)) > 0
  and position('pulse_economy_v13' in (select snapshot_src from sources)) > 0
  and position('variable_reward_model_valid' in (select snapshot_src from sources)) > 0
  and position('jsonb_array_elements' in (select snapshot_src from sources)) > 0
  and position('pulse_economy' in (select snapshot_src from sources)) > 0
  and has_function_privilege('service_role','public.resolve_hourly_pulse_reward(integer)','EXECUTE')
  and not has_function_privilege('anon','public.resolve_hourly_pulse_reward(integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.resolve_hourly_pulse_reward(integer)','EXECUTE')
  and has_function_privilege('service_role','public.controlled_technical_readiness_snapshot()','EXECUTE')
  and not has_function_privilege('anon','public.controlled_technical_readiness_snapshot()','EXECUTE')
  and not has_function_privilege('authenticated','public.controlled_technical_readiness_snapshot()','EXECUTE');
$$;

revoke all on function public.release_variable_reward_execution_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_variable_reward_execution_contract()
  to service_role;

do $$
declare
  v_snapshot jsonb;
begin
  select public.controlled_technical_readiness_snapshot() into v_snapshot;

  if jsonb_typeof(v_snapshot->'pulse_economy') <> 'object' then
    raise exception 'controlled readiness snapshot is missing pulse economy authority';
  end if;

  if not public.release_variable_reward_execution_contract() then
    raise exception 'variable reward readiness snapshot contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'variable reward readiness snapshot requires canonical release schema v55';
  end if;
end
$$;
