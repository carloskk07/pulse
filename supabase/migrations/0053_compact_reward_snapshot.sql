-- Supabase v53: compact read-only reward snapshots for the authenticated hot path.
-- Reduces dashboard Data API fan-out without caching, widening RLS, or moving
-- financial authority into the client.

create or replace function public.current_user_reward_snapshot()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
with
current_identity as (
  select auth.uid() as user_id
),
recent_claims as (
  select c.created_at
  from public.pulse_claims c, current_identity i
  where c.user_id = i.user_id
  order by c.created_at desc
  limit 200
),
claim_days as (
  select distinct (created_at at time zone 'UTC')::date as claim_day
  from recent_claims
),
anchor_day as (
  select case
    when exists (
      select 1
      from claim_days
      where claim_day = (now() at time zone 'UTC')::date
    )
      then (now() at time zone 'UTC')::date
    else (now() at time zone 'UTC')::date - 1
  end as day
),
streak as (
  select coalesce(
    min(offset_day) filter (
      where not exists (
        select 1
        from claim_days d
        where d.claim_day = a.day - offset_day
      )
    ),
    366
  )::integer as days
  from anchor_day a
  cross join generate_series(0, 365) as g(offset_day)
)
select jsonb_build_object(
  'user_id', i.user_id,
  'available_credits', coalesce(b.available_credits, 0),
  'pending_credits', coalesce(b.pending_credits, 0),
  'handle', p.handle,
  'trust_level', coalesce(p.trust_level, 0),
  'last_claim_at', (select max(created_at) from recent_claims),
  'hourly_claim_count', (select count(*)::integer from recent_claims),
  'streak_days', (select days from streak)
)
from current_identity i
left join public.user_balances b on b.user_id = i.user_id
left join public.profiles p on p.id = i.user_id
where i.user_id is not null;
$$;

revoke all on function public.current_user_reward_snapshot()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_reward_snapshot()
  to authenticated;

create or replace function public.current_pulse_runtime_state()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
with
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
)
select jsonb_build_object(
  'hourly_pulse', (select value from pulse),
  'treasury', (
    select jsonb_build_object(
      'code', code,
      'funded_credits', funded_credits,
      'reserved_credits', reserved_credits,
      'spent_credits', spent_credits,
      'enabled', enabled,
      'kill_switch', kill_switch,
      'daily_budget_credits', daily_budget_credits,
      'max_user_daily_credits', max_user_daily_credits
    )
    from treasury
  )
);
$$;

revoke all on function public.current_pulse_runtime_state()
  from public, anon, authenticated, service_role;
grant execute on function public.current_pulse_runtime_state()
  to service_role;

create or replace function public.release_reward_snapshot_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select
    to_regprocedure('public.current_user_reward_snapshot()') is not null
    and to_regprocedure('public.current_pulse_runtime_state()') is not null
    and coalesce((
      select not prosecdef
      from pg_proc
      where oid = 'public.current_user_reward_snapshot()'::regprocedure
    ), false)
    and coalesce((
      select not prosecdef
      from pg_proc
      where oid = 'public.current_pulse_runtime_state()'::regprocedure
    ), false)
    and has_function_privilege(
      'authenticated',
      'public.current_user_reward_snapshot()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.current_user_reward_snapshot()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'service_role',
      'public.current_user_reward_snapshot()',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.current_pulse_runtime_state()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.current_pulse_runtime_state()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.current_pulse_runtime_state()',
      'EXECUTE'
    )
    and not has_table_privilege('authenticated', 'public.profiles', 'INSERT')
    and not has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.profiles', 'DELETE')
    and not has_table_privilege('authenticated', 'public.pulse_claims', 'INSERT')
    and not has_table_privilege('authenticated', 'public.pulse_claims', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.pulse_claims', 'DELETE');
$$;

revoke all on function public.release_reward_snapshot_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_reward_snapshot_contract()
  to service_role;

create or replace function public.release_runtime_contract_snapshot()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'schema_version',
      coalesce((
        select coalesce(nullif(value->>'version','')::integer, version, 0)
        from public.app_config
        where key = 'release_schema'
      ), 0),
    'schema_migration',
      coalesce((
        select value->>'migration'
        from public.app_config
        where key = 'release_schema'
      ), ''),
    'external_proof',
      coalesce((
        select value
        from public.app_config
        where key = 'release_external_proof'
      ), '{}'::jsonb),
    'economics_ok',
      public.admin_economics_snapshot(
        '1970-01-01T00:00:00.000Z'::timestamptz,
        '1970-01-02T00:00:00.000Z'::timestamptz
      ) is not null,
    'referral_ok',
      exists (
        select 1
        from pg_catalog.pg_attribute
        where attrelid = 'public.profiles'::regclass
          and attname = 'referral_code'
          and attnum > 0
          and not attisdropped
      ),
    'security', public.release_security_contract(),
    'authenticated_read_scope', public.release_authenticated_read_scope_contract(),
    'withdrawal_read', public.release_withdrawal_read_contract(),
    'withdrawal_settlement', public.release_withdrawal_settlement_contract(),
    'withdrawal_pilot', public.release_withdrawal_pilot_contract(),
    'faucetpay_proof_chain', public.release_faucetpay_proof_chain_contract(),
    'reward_exchange', public.release_reward_exchange_contract(),
    'treasury_funding', public.release_treasury_funding_contract(),
    'treasury_backing', public.release_treasury_backing_guard_contract(),
    'opportunity_intelligence', public.release_opportunity_intelligence_contract(),
    'pulse_direct', public.release_pulse_direct_contract(),
    'business_intake', public.release_business_intake_contract(),
    'advertiser_outbound', public.release_advertiser_outbound_contract(),
    'hourly_pilot', public.release_hourly_pulse_pilot_contract(),
    'hourly_scale', public.release_hourly_pulse_scale_contract(),
    'user_balance_materialization', public.release_user_balance_materialization_contract(),
    'reward_snapshot', public.release_reward_snapshot_contract(),
    'snapshot_authority',
      coalesce((
        select
          not prosecdef
          and has_function_privilege(
            'service_role',
            'public.release_runtime_contract_snapshot()',
            'EXECUTE'
          )
          and not has_function_privilege(
            'anon',
            'public.release_runtime_contract_snapshot()',
            'EXECUTE'
          )
          and not has_function_privilege(
            'authenticated',
            'public.release_runtime_contract_snapshot()',
            'EXECUTE'
          )
        from pg_catalog.pg_proc
        where oid = 'public.release_runtime_contract_snapshot()'::regprocedure
      ), false)
  );
$$;

revoke all on function public.release_runtime_contract_snapshot()
  from public, anon, authenticated, service_role;
grant execute on function public.release_runtime_contract_snapshot()
  to service_role;

do $$
declare
  v_snapshot jsonb;
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
    and coalesce((v_snapshot->>'reward_snapshot')::boolean, false)
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
    raise exception 'v53 release authority refused: one or more static release contracts failed';
  end if;

  update public.controlled_readiness_release_authority
  set schema_version = 53,
      schema_migration = '0053_compact_reward_snapshot.sql',
      contracts_passed = true,
      contracts = v_snapshot - 'schema_version' - 'schema_migration' - 'external_proof',
      attested_at = now()
  where singleton is true;

  if not found then
    raise exception 'v53 release authority missing';
  end if;
end
$$;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 53, 'migration', '0053_compact_reward_snapshot.sql'),
  53,
  'Compact authenticated reward snapshot and service-only Pulse runtime state'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
