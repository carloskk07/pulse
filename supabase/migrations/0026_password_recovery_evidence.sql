-- Prove the real hosted password-recovery loop without a manual checkbox.
-- A short-lived server-only challenge is armed only after a successful password
-- update from an authoritative recovery flow, then consumed by a later successful
-- password sign-in for the same user before external release evidence is recorded.

create table if not exists public.auth_recovery_proof_challenges (
  user_id uuid primary key,
  source text not null check (source in ('otp', 'pkce')),
  armed_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.auth_recovery_proof_challenges enable row level security;
revoke all on table public.auth_recovery_proof_challenges from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_recovery_proof_challenges to service_role;

create or replace function public.record_release_evidence(
  p_kind text,
  p_fingerprint text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_kind not in (
       'turnstile',
       'ayet_transport',
       'ayet_callback',
       'faucetpay_read',
       'faucetpay_payout',
       'supabase_auth_hardening',
       'password_recovery'
     )
     or length(trim(coalesce(p_fingerprint, ''))) <> 64 then
    return false;
  end if;

  insert into public.app_config(key, value, version, reason)
  values (
    'release_external_proof',
    jsonb_build_object(p_kind, jsonb_build_object('verified_at', now(), 'fingerprint', p_fingerprint)),
    1,
    'Controlled external release evidence recorded'
  )
  on conflict (key) do update
  set value = public.app_config.value || jsonb_build_object(p_kind, jsonb_build_object('verified_at', now(), 'fingerprint', p_fingerprint)),
      version = public.app_config.version + 1,
      reason = 'Controlled external release evidence recorded',
      updated_at = now();

  return true;
end;
$$;

revoke all on function public.record_release_evidence(text,text) from public, anon, authenticated;
grant execute on function public.record_release_evidence(text,text) to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 26, 'migration', '0026_password_recovery_evidence.sql'),
  26,
  'Release readiness requires a real hosted password recovery followed by a successful new-password sign-in'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
