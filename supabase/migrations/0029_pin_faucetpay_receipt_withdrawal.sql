-- Pin actual-destination receipt evidence to one exact paid FaucetPay withdrawal.
-- Generic release evidence cannot mint this proof: the specialized recorder verifies
-- the referenced withdrawal row and persists its id alongside the fingerprint.

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

create or replace function public.record_faucetpay_receipt_evidence(
  p_withdrawal_id uuid,
  p_fingerprint text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_exists boolean;
begin
  if p_withdrawal_id is null
     or length(trim(coalesce(p_fingerprint, ''))) <> 64 then
    return false;
  end if;

  select exists (
    select 1
    from public.withdrawals w
    where w.id = p_withdrawal_id
      and lower(trim(w.payout_provider)) = 'faucetpay'
      and w.status = 'paid'
      and w.amount_credits > 0
      and coalesce(w.payout_amount_units, 0) > 0
      and length(trim(coalesce(w.external_id, ''))) > 0
      and length(trim(coalesce(w.destination, ''))) > 0
  ) into v_exists;

  if not v_exists then
    return false;
  end if;

  insert into public.app_config(key, value, version, reason)
  values (
    'release_external_proof',
    jsonb_build_object(
      'faucetpay_receipt',
      jsonb_build_object(
        'verified_at', now(),
        'fingerprint', p_fingerprint,
        'withdrawal_id', p_withdrawal_id::text
      )
    ),
    1,
    'Actual FaucetPay destination receipt attested for one exact paid withdrawal'
  )
  on conflict (key) do update
  set value = public.app_config.value || jsonb_build_object(
        'faucetpay_receipt',
        jsonb_build_object(
          'verified_at', now(),
          'fingerprint', p_fingerprint,
          'withdrawal_id', p_withdrawal_id::text
        )
      ),
      version = public.app_config.version + 1,
      reason = 'Actual FaucetPay destination receipt attested for one exact paid withdrawal',
      updated_at = now();

  return true;
end;
$$;

revoke all on function public.record_faucetpay_receipt_evidence(uuid,text) from public, anon, authenticated;
grant execute on function public.record_faucetpay_receipt_evidence(uuid,text) to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 29, 'migration', '0029_pin_faucetpay_receipt_withdrawal.sql'),
  29,
  'Actual FaucetPay receipt proof is pinned to one exact paid withdrawal and cannot be minted by the generic evidence recorder'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
