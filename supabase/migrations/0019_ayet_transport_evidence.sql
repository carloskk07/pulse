-- Separate non-financial ayeT transport proof from authoritative earning proof.
-- Sandbox callbacks may prove HMAC/adslot wiring but can never satisfy the
-- financial PRODUCT_READY gate.

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
  if p_kind not in ('turnstile', 'ayet_transport', 'ayet_callback', 'faucetpay_payout')
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
  jsonb_build_object('version', 19, 'migration', '0019_ayet_transport_evidence.sql'),
  19,
  'Non-financial ayeT transport evidence separated from authoritative earning proof'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
