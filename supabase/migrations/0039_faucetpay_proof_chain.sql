-- Supabase v39: bind provider payout evidence and actual receipt evidence to the
-- same exact paid FaucetPay withdrawal. Generic configuration evidence can no
-- longer mint payout proof, and any legacy unbound payout/receipt proof is
-- invalidated during the migration.

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

create or replace function public.record_faucetpay_payout_evidence(
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
      and length(trim(coalesce(w.idempotency_key, ''))) > 0
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
      'faucetpay_payout',
      jsonb_build_object(
        'verified_at', now(),
        'fingerprint', p_fingerprint,
        'withdrawal_id', p_withdrawal_id::text
      )
    ),
    1,
    'Provider-side FaucetPay payout proven for one exact paid withdrawal'
  )
  on conflict (key) do update
  set value = (public.app_config.value - 'faucetpay_receipt') || jsonb_build_object(
        'faucetpay_payout',
        jsonb_build_object(
          'verified_at', now(),
          'fingerprint', p_fingerprint,
          'withdrawal_id', p_withdrawal_id::text
        )
      ),
      version = public.app_config.version + 1,
      reason = 'Provider-side FaucetPay payout proven for one exact paid withdrawal; prior receipt binding invalidated',
      updated_at = now();

  return true;
end;
$$;

revoke all on function public.record_faucetpay_payout_evidence(uuid,text) from public, anon, authenticated;
grant execute on function public.record_faucetpay_payout_evidence(uuid,text) to service_role;

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
  v_bound_payout_withdrawal_id text;
begin
  if p_withdrawal_id is null
     or length(trim(coalesce(p_fingerprint, ''))) <> 64 then
    return false;
  end if;

  select value #>> '{faucetpay_payout,withdrawal_id}'
  into v_bound_payout_withdrawal_id
  from public.app_config
  where key = 'release_external_proof';

  if nullif(trim(coalesce(v_bound_payout_withdrawal_id, '')), '') is null
     or v_bound_payout_withdrawal_id <> p_withdrawal_id::text then
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
      and length(trim(coalesce(w.idempotency_key, ''))) > 0
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
    'Actual FaucetPay destination receipt attested for the same exact payout-bound withdrawal'
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
      reason = 'Actual FaucetPay destination receipt attested for the same exact payout-bound withdrawal',
      updated_at = now();

  return true;
end;
$$;

revoke all on function public.record_faucetpay_receipt_evidence(uuid,text) from public, anon, authenticated;
grant execute on function public.record_faucetpay_receipt_evidence(uuid,text) to service_role;

-- Old payout evidence was configuration-bound only, not withdrawal-bound. Fail
-- closed during the authority transition. Production currently has no payout or
-- receipt evidence, but this also makes upgrades safe for any future environment.
update public.app_config
set value = value - 'faucetpay_payout' - 'faucetpay_receipt',
    version = version + 1,
    reason = 'Legacy unbound FaucetPay payout/receipt evidence invalidated for v39 proof-chain authority',
    updated_at = now()
where key = 'release_external_proof'
  and (value ? 'faucetpay_payout' or value ? 'faucetpay_receipt');

create or replace function public.release_faucetpay_proof_chain_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select
    to_regprocedure('public.record_faucetpay_payout_evidence(uuid,text)') is not null
    and to_regprocedure('public.record_faucetpay_receipt_evidence(uuid,text)') is not null
    and has_function_privilege('service_role', 'public.record_faucetpay_payout_evidence(uuid,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.record_faucetpay_receipt_evidence(uuid,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.record_faucetpay_payout_evidence(uuid,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.record_faucetpay_payout_evidence(uuid,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.record_faucetpay_receipt_evidence(uuid,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.record_faucetpay_receipt_evidence(uuid,text)', 'EXECUTE')
    and position('faucetpay_payout' in pg_catalog.pg_get_functiondef('public.record_release_evidence(text,text)'::regprocedure)) = 0
    and position('idempotency_key' in pg_catalog.pg_get_functiondef('public.record_faucetpay_payout_evidence(uuid,text)'::regprocedure)) > 0
    and position('withdrawal_id' in pg_catalog.pg_get_functiondef('public.record_faucetpay_payout_evidence(uuid,text)'::regprocedure)) > 0
    and position('faucetpay_payout,withdrawal_id' in pg_catalog.pg_get_functiondef('public.record_faucetpay_receipt_evidence(uuid,text)'::regprocedure)) > 0;
$$;

revoke all on function public.release_faucetpay_proof_chain_contract() from public, anon, authenticated;
grant execute on function public.release_faucetpay_proof_chain_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 39, 'migration', '0039_faucetpay_proof_chain.sql'),
  39,
  'FaucetPay provider payout and actual receipt proofs must bind to the same exact paid withdrawal and idempotency authority'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();