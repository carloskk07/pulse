-- Supabase v50: collapse release-readiness contract fan-out into one service-role RPC.
-- This reduces PostgREST round trips and pool pressure while keeping every
-- existing release contract authoritative and fail-closed.

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

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 50, 'migration', '0050_release_runtime_contract_snapshot.sql'),
  50,
  'Collapse release readiness contract fan-out into one service-role snapshot RPC'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
