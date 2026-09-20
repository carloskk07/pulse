-- Performance-only migration: make generic release evidence recording idempotent.
-- Keeps release schema authority at v55 / 0055 and preserves the public function
-- signature, SECURITY INVOKER behavior, allowlist and service_role-only execution.
--
-- The hot-path goal is narrow: when a successful external verification proves the
-- exact fingerprint that is already authoritative, return true without rewriting
-- the singleton release_external_proof row. This removes a global row-lock/write
-- amplifier from concurrent claims while preserving the write path for new proof.

create or replace function public.record_release_evidence(
  p_kind text,
  p_fingerprint text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing_fingerprint text;
  v_existing_verified_at text;
begin
  if p_kind not in (
       'turnstile',
       'ayet_transport',
       'ayet_callback',
       'faucetpay_read',
       'faucetpay_send_scope',
       'supabase_auth_hardening',
       'password_recovery',
       'legal_policy_review',
       'international_transfer_review'
     )
     or length(trim(coalesce(p_fingerprint, ''))) <> 64 then
    return false;
  end if;

  select
    value -> p_kind ->> 'fingerprint',
    value -> p_kind ->> 'verified_at'
  into v_existing_fingerprint, v_existing_verified_at
  from public.app_config
  where key = 'release_external_proof';

  if v_existing_fingerprint = p_fingerprint
     and coalesce(v_existing_verified_at, '') <> '' then
    return true;
  end if;

  insert into public.app_config(key, value, version, reason)
  values (
    'release_external_proof',
    jsonb_build_object(
      p_kind,
      jsonb_build_object('verified_at', now(), 'fingerprint', p_fingerprint)
    ),
    1,
    'Controlled external release evidence recorded'
  )
  on conflict (key) do update
  set value = public.app_config.value || jsonb_build_object(
        p_kind,
        jsonb_build_object('verified_at', now(), 'fingerprint', p_fingerprint)
      ),
      version = public.app_config.version + 1,
      reason = 'Controlled external release evidence recorded',
      updated_at = now();

  return true;
end;
$$;

revoke all on function public.record_release_evidence(text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_release_evidence(text,text)
  to service_role;

do $$
declare
  v_schema jsonb;
  v_before_value jsonb;
  v_after_value jsonb;
  v_before_version integer;
  v_after_version integer;
  v_before_updated_at timestamptz;
  v_after_updated_at timestamptz;
  v_turnstile_fingerprint text;
begin
  select value
  into v_schema
  from public.app_config
  where key = 'release_schema';

  if coalesce((v_schema->>'version')::integer, 0) <> 55
     or coalesce(v_schema->>'migration', '') <> '0055_invite_snapshot_compaction.sql' then
    raise exception 'release evidence idempotency migration requires v55 authority';
  end if;

  if (
    select p.prosecdef
    from pg_catalog.pg_proc p
    where p.oid = 'public.record_release_evidence(text,text)'::regprocedure
  ) then
    raise exception 'record_release_evidence must remain SECURITY INVOKER';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.record_release_evidence(text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.record_release_evidence(text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.record_release_evidence(text,text)',
       'EXECUTE'
     ) then
    raise exception 'record_release_evidence execution scope changed';
  end if;

  select
    value,
    version,
    updated_at,
    value -> 'turnstile' ->> 'fingerprint'
  into
    v_before_value,
    v_before_version,
    v_before_updated_at,
    v_turnstile_fingerprint
  from public.app_config
  where key = 'release_external_proof';

  if coalesce(v_turnstile_fingerprint, '') <> '' then
    if public.record_release_evidence(
         'turnstile',
         v_turnstile_fingerprint
       ) is not true then
      raise exception 'unchanged release evidence was not accepted';
    end if;

    select value, version, updated_at
    into v_after_value, v_after_version, v_after_updated_at
    from public.app_config
    where key = 'release_external_proof';

    if v_after_value is distinct from v_before_value
       or v_after_version is distinct from v_before_version
       or v_after_updated_at is distinct from v_before_updated_at then
      raise exception 'unchanged release evidence must not write';
    end if;
  end if;
end
$$;
