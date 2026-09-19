-- Supabase v55: compact read-only Invite snapshots.
-- Collapses the authenticated Invite page from four Data API reads into
-- one user-scoped RPC plus one service-role runtime RPC.

create or replace function public.current_user_invite_state()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
with
identity as (
  select auth.uid() as user_id
),
profile as (
  select p.referral_code
  from public.profiles p, identity i
  where p.id = i.user_id
),
referral_counts as (
  select
    count(*) filter (where r.status = 'pending')::integer as pending,
    count(*) filter (where r.status = 'rewarded')::integer as rewarded,
    count(*) filter (where r.status = 'reversed')::integer as reversed
  from public.referrals r, identity i
  where r.inviter_id = i.user_id
),
referral_ledger as (
  select coalesce(sum(le.credits),0)::bigint as credits
  from public.ledger_entries le, identity i
  where le.user_id = i.user_id
    and le.entry_type = 'referral'
)
select jsonb_build_object(
  'user_id', (select user_id from identity),
  'referral_code', (select referral_code from profile),
  'pending', (select pending from referral_counts),
  'rewarded', (select rewarded from referral_counts),
  'reversed', (select reversed from referral_counts),
  'referral_credits', (select credits from referral_ledger)
)
where (select user_id from identity) is not null;
$$;

revoke all on function public.current_user_invite_state()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_invite_state()
  to authenticated;

create or replace function public.current_invite_runtime_state()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
select jsonb_build_object(
  'referral_reward', coalesce((
    select value
    from public.app_config
    where key='referral_reward'
  ), '{}'::jsonb)
);
$$;

revoke all on function public.current_invite_runtime_state()
  from public, anon, authenticated, service_role;
grant execute on function public.current_invite_runtime_state()
  to service_role;

create or replace function public.release_invite_snapshot_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select
    to_regprocedure('public.current_user_invite_state()') is not null
    and to_regprocedure('public.current_invite_runtime_state()') is not null
    and coalesce((
      select not prosecdef
      from pg_proc
      where oid = 'public.current_user_invite_state()'::regprocedure
    ), false)
    and coalesce((
      select not prosecdef
      from pg_proc
      where oid = 'public.current_invite_runtime_state()'::regprocedure
    ), false)
    and has_function_privilege(
      'authenticated',
      'public.current_user_invite_state()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.current_user_invite_state()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'service_role',
      'public.current_user_invite_state()',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.current_invite_runtime_state()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.current_invite_runtime_state()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.current_invite_runtime_state()',
      'EXECUTE'
    );
$$;

revoke all on function public.release_invite_snapshot_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_invite_snapshot_contract()
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
    'wallet_snapshot', public.release_wallet_snapshot_contract(),
    'invite_snapshot', public.release_invite_snapshot_contract(),
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
    and coalesce((v_snapshot->>'wallet_snapshot')::boolean, false)
    and coalesce((v_snapshot->>'invite_snapshot')::boolean, false)
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
    raise exception 'v55 release authority refused: one or more static release contracts failed';
  end if;

  update public.controlled_readiness_release_authority
  set schema_version = 55,
      schema_migration = '0055_invite_snapshot_compaction.sql',
      contracts_passed = true,
      contracts = v_snapshot - 'schema_version' - 'schema_migration' - 'external_proof',
      attested_at = now()
  where singleton is true;

  if not found then
    raise exception 'v55 release authority missing';
  end if;
end
$$;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 55, 'migration', '0055_invite_snapshot_compaction.sql'),
  55,
  'Compact authenticated Invite state into one user RPC and one service-only runtime RPC'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
