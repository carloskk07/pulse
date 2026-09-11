-- Explicit release schema marker and fingerprint-bound external evidence.

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  '{"version":7,"name":"release-readiness"}'::jsonb,
  7,
  'Minimum schema required by the controlled launch gate'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();

insert into public.app_config(key, value, version, reason)
values (
  'release_external_proof',
  '{}'::jsonb,
  1,
  'External smoke evidence is recorded automatically and bound to configuration fingerprints'
)
on conflict (key) do nothing;

create or replace function public.record_release_evidence(
  p_kind text,
  p_fingerprint text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('turnstile', 'ayet_callback', 'faucetpay_payout') or length(trim(coalesce(p_fingerprint, ''))) <> 64 then
    return false;
  end if;

  insert into public.app_config(key, value, version, reason)
  values (
    'release_external_proof',
    jsonb_build_object(p_kind, jsonb_build_object('verified_at', now(), 'fingerprint', p_fingerprint)),
    1,
    'Controlled external smoke evidence recorded automatically'
  )
  on conflict (key) do update
  set value = public.app_config.value || jsonb_build_object(p_kind, jsonb_build_object('verified_at', now(), 'fingerprint', p_fingerprint)),
      version = public.app_config.version + 1,
      reason = 'Controlled external smoke evidence recorded automatically',
      updated_at = now();

  return true;
end;
$$;

revoke all on function public.record_release_evidence(text,text) from public, anon, authenticated;
grant execute on function public.record_release_evidence(text,text) to service_role;
