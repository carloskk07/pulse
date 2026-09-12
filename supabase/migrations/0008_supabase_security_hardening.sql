-- Supabase v8 launch hardening.
-- Explicit Data API grants for the 2026 exposure model, tighter RLS targets,
-- and removal of unnecessary SECURITY DEFINER authority from server-only RPCs.

grant usage on schema public to authenticated, service_role;
revoke create on schema public from public, anon, authenticated;

-- New Supabase projects no longer expose new public tables automatically.
-- Keep anonymous users away from the application data plane entirely.
revoke all on table public.profiles from anon;
revoke all on table public.ledger_entries from anon;
revoke all on table public.claims from anon;
revoke all on table public.monetization_events from anon;
revoke all on table public.provider_callbacks from anon;
revoke all on table public.withdrawals from anon;
revoke all on table public.risk_events from anon;
revoke all on table public.app_config from anon;
revoke all on table public.referrals from anon;
revoke all on table public.user_balances from anon;

-- Authenticated product reads are deliberately narrow. Financial writes remain
-- server-only through the service role and database RPCs.
revoke all on table public.profiles from authenticated;
revoke all on table public.ledger_entries from authenticated;
revoke all on table public.claims from authenticated;
revoke all on table public.monetization_events from authenticated;
revoke all on table public.provider_callbacks from authenticated;
revoke all on table public.withdrawals from authenticated;
revoke all on table public.risk_events from authenticated;
revoke all on table public.app_config from authenticated;
revoke all on table public.referrals from authenticated;
revoke all on table public.user_balances from authenticated;

grant select (id, handle, trust_level, referral_code) on table public.profiles to authenticated;
grant select (id, user_id, entry_type, state, credits, created_at) on table public.ledger_entries to authenticated;
grant select (user_id, claim_day, reward_credits) on table public.claims to authenticated;
grant select (inviter_id, invitee_id, status, created_at, rewarded_at, reversed_at) on table public.referrals to authenticated;
grant select on table public.user_balances to authenticated;

-- The service role is the server-side financial authority. Make its Data API
-- privileges explicit so the app is independent of project-level default grants.
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.ledger_entries to service_role;
grant select, insert, update, delete on table public.claims to service_role;
grant select, insert, update, delete on table public.monetization_events to service_role;
grant select, insert, update, delete on table public.provider_callbacks to service_role;
grant select, insert, update, delete on table public.withdrawals to service_role;
grant select, insert, update, delete on table public.risk_events to service_role;
grant select, insert, update, delete on table public.app_config to service_role;
grant select, insert, update, delete on table public.referrals to service_role;
grant select on table public.user_balances to service_role;

-- Make the ownership predicate explicit to authenticated callers. `(select
-- auth.uid())` also avoids re-evaluating the helper for every candidate row.
drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own" on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "ledger_read_own" on public.ledger_entries;
create policy "ledger_read_own" on public.ledger_entries
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "claims_read_own" on public.claims;
create policy "claims_read_own" on public.claims
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "events_read_own" on public.monetization_events;
create policy "events_read_own" on public.monetization_events
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "withdrawals_read_own" on public.withdrawals;
create policy "withdrawals_read_own" on public.withdrawals
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "risk_read_own" on public.risk_events;
create policy "risk_read_own" on public.risk_events
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "referrals_read_participant" on public.referrals;
create policy "referrals_read_participant" on public.referrals
for select to authenticated
using ((select auth.uid()) = inviter_id or (select auth.uid()) = invitee_id);

-- These functions are only invoked by trusted server code using service_role.
-- service_role already bypasses RLS, so SECURITY DEFINER adds authority without
-- adding capability for functions that touch only the application schema.
alter function public.claim_daily_pulse(uuid) security invoker;
alter function public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint) security invoker;
alter function public.finalize_withdrawal(uuid,text,text,text) security invoker;
alter function public.admin_economics_snapshot(timestamptz,timestamptz) security invoker;
alter function public.bind_referral(uuid,text) security invoker;
alter function public.reward_referral_on_conversion() security invoker;
alter function public.reverse_referral_on_chargeback() security invoker;
alter function public.record_release_evidence(text,text) security invoker;

-- The monetization callback verifies existence in auth.users. Keep this one
-- privileged, but expose it only to service_role and pin every lookup schema.
alter function public.apply_monetization_callback(text,text,text,uuid,text,bigint,bigint,timestamptz,jsonb) security definer;
alter function public.apply_monetization_callback(text,text,text,uuid,text,bigint,bigint,timestamptz,jsonb) set search_path = pg_catalog, public, extensions;

-- The auth trigger must cross from auth.users into public.profiles. Its execute
-- permission remains revoked from client roles and its lookup path is pinned.
alter function public.handle_new_user() security definer;
alter function public.handle_new_user() set search_path = '';
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Reassert RPC access after the security-mode changes.
revoke all on function public.claim_daily_pulse(uuid) from public, anon, authenticated;
grant execute on function public.claim_daily_pulse(uuid) to service_role;
revoke all on function public.apply_monetization_callback(text,text,text,uuid,text,bigint,bigint,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.apply_monetization_callback(text,text,text,uuid,text,bigint,bigint,timestamptz,jsonb) to service_role;
revoke all on function public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint) from public, anon, authenticated;
grant execute on function public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint) to service_role;
revoke all on function public.finalize_withdrawal(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.finalize_withdrawal(uuid,text,text,text) to service_role;
revoke all on function public.admin_economics_snapshot(timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.admin_economics_snapshot(timestamptz,timestamptz) to service_role;
revoke all on function public.bind_referral(uuid,text) from public, anon, authenticated;
grant execute on function public.bind_referral(uuid,text) to service_role;
revoke all on function public.record_release_evidence(text,text) from public, anon, authenticated;
grant execute on function public.record_release_evidence(text,text) to service_role;
revoke all on function public.reward_referral_on_conversion() from public, anon, authenticated;
revoke all on function public.reverse_referral_on_chargeback() from public, anon, authenticated;

-- Controlled-launch marker. The application release gate must prove v8 or later.
insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  '{"version":8,"name":"supabase-security-hardening"}'::jsonb,
  8,
  'Explicit Data API grants, RLS target hardening and least-privilege RPC execution'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
