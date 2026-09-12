-- Supabase v9: restore the narrow authenticated read path required by Wallet.
-- Migration 0008 intentionally revoked broad table access, but Wallet needs to
-- discover the signed-in user's active withdrawal so a reserved payout can be
-- recovered safely. RLS still limits rows to auth.uid() = user_id.

grant select (id, user_id, status, destination, asset, amount_credits, created_at)
on table public.withdrawals
to authenticated;

-- Runtime proof for the exact UI contract. Service-role only so public clients
-- do not receive privilege diagnostics.
create or replace function public.release_withdrawal_read_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select
    has_column_privilege('authenticated', 'public.withdrawals', 'id', 'SELECT')
    and has_column_privilege('authenticated', 'public.withdrawals', 'user_id', 'SELECT')
    and has_column_privilege('authenticated', 'public.withdrawals', 'status', 'SELECT')
    and has_column_privilege('authenticated', 'public.withdrawals', 'destination', 'SELECT')
    and has_column_privilege('authenticated', 'public.withdrawals', 'asset', 'SELECT')
    and has_column_privilege('authenticated', 'public.withdrawals', 'amount_credits', 'SELECT')
    and has_column_privilege('authenticated', 'public.withdrawals', 'created_at', 'SELECT')
    and (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.withdrawals'::regclass)
    and exists (
      select 1
      from pg_catalog.pg_policy p
      where p.polrelid = 'public.withdrawals'::regclass
        and p.polname = 'withdrawals_read_own'
    );
$$;

revoke all on function public.release_withdrawal_read_contract() from public, anon, authenticated;
grant execute on function public.release_withdrawal_read_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  '{"version":9,"name":"withdrawal-read-contract"}'::jsonb,
  9,
  'RLS-scoped authenticated withdrawal read required for safe payout recovery UI'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
