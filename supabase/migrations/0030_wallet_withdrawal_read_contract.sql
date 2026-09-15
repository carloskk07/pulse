-- Supabase v30: complete the exact authenticated Wallet recovery read contract.
--
-- Migration 0009 restored a narrow RLS-scoped read path for active withdrawals,
-- but the Wallet UI later added payout_amount_units to its SELECT without adding
-- the matching column privilege. PostgREST rejects the whole SELECT when even
-- one requested column is not granted, which can hide a real requested/held/
-- submitted payout from the signed-in user.

grant select (payout_amount_units)
on table public.withdrawals
to authenticated;

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
    and has_column_privilege('authenticated', 'public.withdrawals', 'payout_amount_units', 'SELECT')
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
  jsonb_build_object('version', 30, 'migration', '0030_wallet_withdrawal_read_contract.sql'),
  30,
  'Wallet active-withdrawal read contract includes payout units while remaining RLS-scoped and read-only'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
