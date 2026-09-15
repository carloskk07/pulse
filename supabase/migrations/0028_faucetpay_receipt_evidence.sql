-- Separate provider-side payout success from operator-confirmed receipt at the
-- actual destination. This evidence remains service-role-only and is bound in
-- application code to one paid FaucetPay withdrawal plus the current payout pack.

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
       'faucetpay_receipt',
       'supabase_auth_hardening',
       'password_recovery',
       'legal_policy_review',
       'international_transfer_review'
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
  jsonb_build_object('version', 28, 'migration', '0028_faucetpay_receipt_evidence.sql'),
  28,
  'Provider payout success and actual destination receipt are separate fail-closed launch proofs'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
