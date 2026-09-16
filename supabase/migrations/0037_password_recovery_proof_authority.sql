-- Bind password-recovery release evidence to a server-observed recovery callback.
-- v26 armed the proof challenge only after the password update, which allowed a
-- client-supplied recovery-context cookie to carry too much authority. v37 turns
-- the existing challenge into a two-stage server-side record:
--   verified recovery callback -> password updated -> later password sign-in.

alter table public.auth_recovery_proof_challenges
  add column if not exists password_updated_at timestamptz;

-- No pre-v37 challenge is authoritative under the new contract. This also makes
-- the migration safe if an old challenge was left behind during rollout.
delete from public.auth_recovery_proof_challenges;

alter table public.auth_recovery_proof_challenges
  drop constraint if exists auth_recovery_proof_password_update_order;

alter table public.auth_recovery_proof_challenges
  add constraint auth_recovery_proof_password_update_order
  check (password_updated_at is null or password_updated_at >= armed_at);

comment on column public.auth_recovery_proof_challenges.armed_at is
  'Timestamp of the server-verified recovery callback that established the proof challenge.';

comment on column public.auth_recovery_proof_challenges.password_updated_at is
  'Timestamp of the successful password update performed while the verified recovery challenge was still current.';

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 37, 'migration', '0037_password_recovery_proof_authority.sql'),
  37,
  'Password recovery proof is bound to a server-verified recovery callback before password update and later sign-in'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
