-- Bind FaucetPay read-only unit proof to release configuration without granting payout authority.

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
  if p_kind not in ('turnstile', 'ayet_transport', 'ayet_callback', 'faucetpay_read', 'faucetpay_payout')
     or length(trim(coalesce(p_fingerprint, ''))) <> 64 then
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

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 23, 'migration', '0023_faucetpay_read_evidence.sql'),
  23,
  'FaucetPay read-only unit proof is fingerprint-bound before payout authority can be considered ready'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
