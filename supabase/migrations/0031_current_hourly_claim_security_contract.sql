-- Supabase v31: bind the release security contract to the current Hourly Pulse RPC.
--
-- The previous contract still inspected the legacy claim_daily_pulse(uuid) function.
-- Production uses claim_hourly_pulse(uuid), so the release gate could pass while
-- measuring the wrong RPC. The current Hourly Pulse function is executable only
-- by service_role; SECURITY DEFINER is therefore unnecessary privilege elevation.

alter function public.claim_hourly_pulse(uuid) security invoker;
alter function public.claim_hourly_pulse(uuid) set search_path = pg_catalog, public;

revoke all on function public.claim_hourly_pulse(uuid) from public, anon, authenticated;
grant execute on function public.claim_hourly_pulse(uuid) to service_role;

create or replace function public.release_security_contract()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'status', 'ok',
    'profiles_rls', (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.profiles'::regclass),
    'ledger_rls', (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.ledger_entries'::regclass),
    'claims_rls', (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.claims'::regclass),
    'referrals_rls', (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.referrals'::regclass),
    'withdrawals_rls', (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.withdrawals'::regclass),
    'app_config_rls', (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.app_config'::regclass),
    'anon_app_config_select', has_table_privilege('anon', 'public.app_config', 'SELECT'),
    'anon_ledger_select', has_table_privilege('anon', 'public.ledger_entries', 'SELECT'),
    'authenticated_profile_select', has_column_privilege('authenticated', 'public.profiles', 'id', 'SELECT')
      and has_column_privilege('authenticated', 'public.profiles', 'handle', 'SELECT')
      and has_column_privilege('authenticated', 'public.profiles', 'trust_level', 'SELECT')
      and has_column_privilege('authenticated', 'public.profiles', 'referral_code', 'SELECT'),
    'authenticated_ledger_select', has_column_privilege('authenticated', 'public.ledger_entries', 'id', 'SELECT')
      and has_column_privilege('authenticated', 'public.ledger_entries', 'user_id', 'SELECT')
      and has_column_privilege('authenticated', 'public.ledger_entries', 'entry_type', 'SELECT')
      and has_column_privilege('authenticated', 'public.ledger_entries', 'state', 'SELECT')
      and has_column_privilege('authenticated', 'public.ledger_entries', 'credits', 'SELECT')
      and has_column_privilege('authenticated', 'public.ledger_entries', 'created_at', 'SELECT'),
    'authenticated_claims_select', has_column_privilege('authenticated', 'public.claims', 'user_id', 'SELECT')
      and has_column_privilege('authenticated', 'public.claims', 'claim_day', 'SELECT')
      and has_column_privilege('authenticated', 'public.claims', 'reward_credits', 'SELECT'),
    'authenticated_referrals_select', has_column_privilege('authenticated', 'public.referrals', 'inviter_id', 'SELECT')
      and has_column_privilege('authenticated', 'public.referrals', 'invitee_id', 'SELECT')
      and has_column_privilege('authenticated', 'public.referrals', 'status', 'SELECT'),
    'authenticated_balance_select', has_table_privilege('authenticated', 'public.user_balances', 'SELECT'),
    'service_app_config_select', has_table_privilege('service_role', 'public.app_config', 'SELECT'),
    'service_withdrawals_insert', has_table_privilege('service_role', 'public.withdrawals', 'INSERT'),
    'service_withdrawals_update', has_table_privilege('service_role', 'public.withdrawals', 'UPDATE'),
    'authenticated_claim_rpc_execute', has_function_privilege('authenticated', 'public.claim_hourly_pulse(uuid)', 'EXECUTE'),
    'service_claim_rpc_execute', has_function_privilege('service_role', 'public.claim_hourly_pulse(uuid)', 'EXECUTE'),
    'claim_security_definer', (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.claim_hourly_pulse(uuid)'::regprocedure),
    'callback_security_definer', (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.apply_monetization_callback(text,text,text,uuid,text,bigint,bigint,timestamptz,jsonb)'::regprocedure)
  );
$$;

revoke all on function public.release_security_contract() from public, anon, authenticated;
grant execute on function public.release_security_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 31, 'migration', '0031_current_hourly_claim_security_contract.sql'),
  31,
  'Release security contract measures the current Hourly Pulse RPC and removes unnecessary SECURITY DEFINER authority'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
