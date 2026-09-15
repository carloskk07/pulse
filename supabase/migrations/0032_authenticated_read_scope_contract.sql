-- Supabase v32: prove authenticated read scopes and view/RLS semantics.
--
-- Release checks must fail if a future change broadens an own-row policy, turns
-- user_balances into a definer view, exposes sensitive profile/ledger columns,
-- or grants direct client writes to public tables.

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
      from information_schema.role_table_grants g
      where g.table_schema = 'public'
        and g.grantee in ('anon', 'authenticated')
        and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
    )
    and not exists (
      select 1
      from information_schema.column_privileges g
      where g.table_schema = 'public'
        and g.grantee in ('anon', 'authenticated')
        and g.privilege_type in ('INSERT', 'UPDATE', 'REFERENCES')
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'profiles'
        and p.policyname = 'profiles_read_own'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g')) = '((selectauth.uid()asuid)=id)'
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'ledger_entries'
        and p.policyname = 'ledger_read_own'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g')) = '((selectauth.uid()asuid)=user_id)'
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'claims'
        and p.policyname = 'claims_read_own'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g')) = '((selectauth.uid()asuid)=user_id)'
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'pulse_claims'
        and p.policyname = 'pulse_claims_read_own'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g')) = '((selectauth.uid()asuid)=user_id)'
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'referrals'
        and p.policyname = 'referrals_read_participant'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g')) = '(((selectauth.uid()asuid)=inviter_id)or((selectauth.uid()asuid)=invitee_id))'
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'support_cases'
        and p.policyname = 'support_cases_read_own'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g')) = '((selectauth.uid()asuid)=user_id)'
    )
    and (
      select count(*) = 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'withdrawals'
        and p.policyname = 'withdrawals_read_own'
        and p.cmd = 'SELECT'
        and p.roles = array['authenticated'::name]
        and lower(regexp_replace(coalesce(p.qual, ''), '[[:space:]]+', '', 'g')) = '((selectauth.uid()asuid)=user_id)'
    );
$$;

revoke all on function public.release_authenticated_read_scope_contract() from public, anon, authenticated;
grant execute on function public.release_authenticated_read_scope_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 32, 'migration', '0032_authenticated_read_scope_contract.sql'),
  32,
  'Release readiness proves own-row RLS scopes, invoker balance view, sensitive-column isolation and no direct client writes'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
