-- Release hardening: keep authenticated read-scope proof fail-closed without
-- repeatedly expanding information_schema privilege views.
--
-- Compatible with release schema v55 / 0055. This changes no application data,
-- RLS policy, Treasury value, reward amount, payout authority, or release marker.
--
-- The prior contract enumerated direct grants through information_schema on every
-- readiness run. Effective privilege checks over pg_catalog are substantially
-- cheaper and stricter: they also detect access inherited through roles/PUBLIC.

create or replace function public.release_authenticated_read_scope_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select
    coalesce((
      select 'security_invoker=true' = any(c.reloptions)
      from pg_catalog.pg_class c
      where c.oid = 'public.user_balances'::regclass
    ), false)
    and not has_table_privilege('anon', 'public.user_balances', 'SELECT')
    and has_table_privilege('authenticated', 'public.user_balances', 'SELECT')
    and not has_column_privilege('authenticated', 'public.profiles', 'risk_score', 'SELECT')
    and not has_column_privilege('authenticated', 'public.ledger_entries', 'event_key', 'SELECT')
    and not has_column_privilege('authenticated', 'public.ledger_entries', 'usd_micros', 'SELECT')
    and not has_column_privilege('authenticated', 'public.ledger_entries', 'metadata', 'SELECT')
    and not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n
        on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p', 'v', 'm', 'f')
        and (
          has_table_privilege('anon', c.oid, 'INSERT')
          or has_table_privilege('anon', c.oid, 'UPDATE')
          or has_table_privilege('anon', c.oid, 'DELETE')
          or has_table_privilege('anon', c.oid, 'TRUNCATE')
          or has_table_privilege('anon', c.oid, 'REFERENCES')
          or has_table_privilege('anon', c.oid, 'TRIGGER')
          or has_table_privilege('authenticated', c.oid, 'INSERT')
          or has_table_privilege('authenticated', c.oid, 'UPDATE')
          or has_table_privilege('authenticated', c.oid, 'DELETE')
          or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          or has_table_privilege('authenticated', c.oid, 'REFERENCES')
          or has_table_privilege('authenticated', c.oid, 'TRIGGER')
        )
    )
    and not exists (
      select 1
      from pg_catalog.pg_attribute a
      join pg_catalog.pg_class c
        on c.oid = a.attrelid
      join pg_catalog.pg_namespace n
        on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p', 'v', 'm', 'f')
        and a.attnum > 0
        and not a.attisdropped
        and (
          has_column_privilege('anon', c.oid, a.attnum, 'INSERT')
          or has_column_privilege('anon', c.oid, a.attnum, 'UPDATE')
          or has_column_privilege('anon', c.oid, a.attnum, 'REFERENCES')
          or has_column_privilege('authenticated', c.oid, a.attnum, 'INSERT')
          or has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE')
          or has_column_privilege('authenticated', c.oid, a.attnum, 'REFERENCES')
        )
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'profiles'
        and p.policyname = 'profiles_read_own'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g'))
          = '((selectauth.uid()asuid)=id)'
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'ledger_entries'
        and p.policyname = 'ledger_read_own'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g'))
          = '((selectauth.uid()asuid)=user_id)'
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'claims'
        and p.policyname = 'claims_read_own'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g'))
          = '((selectauth.uid()asuid)=user_id)'
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'pulse_claims'
        and p.policyname = 'pulse_claims_read_own'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g'))
          = '((selectauth.uid()asuid)=user_id)'
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'referrals'
        and p.policyname = 'referrals_read_participant'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g'))
          = '(((selectauth.uid()asuid)=inviter_id)or((selectauth.uid()asuid)=invitee_id))'
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'support_cases'
        and p.policyname = 'support_cases_read_own'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g'))
          = '((selectauth.uid()asuid)=user_id)'
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'withdrawals'
        and p.policyname = 'withdrawals_read_own'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g'))
          = '((selectauth.uid()asuid)=user_id)'
    );
$$;

revoke all on function public.release_authenticated_read_scope_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_authenticated_read_scope_contract()
  to service_role;

do $$
declare
  v_schema jsonb;
  v_definition text;
  v_runtime jsonb;
begin
  select value into v_schema
  from public.app_config
  where key = 'release_schema';

  if coalesce((v_schema->>'version')::integer, 0) <> 55
     or coalesce(v_schema->>'migration', '') <> '0055_invite_snapshot_compaction.sql' then
    raise exception 'authenticated read-scope efficiency requires v55/0055';
  end if;

  if not public.release_authenticated_read_scope_contract() then
    raise exception 'authenticated read-scope contract failed after catalog optimization';
  end if;

  select lower(pg_get_functiondef(
    'public.release_authenticated_read_scope_contract()'::regprocedure
  ))
  into v_definition;

  if position('information_schema.role_table_grants' in v_definition) > 0
     or position('information_schema.column_privileges' in v_definition) > 0
     or position('pg_catalog.pg_attribute' in v_definition) = 0
     or position('has_table_privilege' in v_definition) = 0
     or position('has_column_privilege' in v_definition) = 0 then
    raise exception 'authenticated read-scope catalog optimization missing';
  end if;

  if not has_function_privilege(
      'service_role',
      'public.release_authenticated_read_scope_contract()',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.release_authenticated_read_scope_contract()',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.release_authenticated_read_scope_contract()',
      'EXECUTE'
    ) then
    raise exception 'authenticated read-scope execution authority drifted';
  end if;

  select public.release_runtime_contract_snapshot()
  into v_runtime;

  if coalesce((v_runtime->>'authenticated_read_scope')::boolean, false) is not true
     or coalesce((v_runtime->>'snapshot_authority')::boolean, false) is not true then
    raise exception 'release runtime contract failed after authenticated read-scope optimization';
  end if;
end
$$;
