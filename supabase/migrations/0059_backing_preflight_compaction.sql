-- Performance-only migration: compact Treasury backing preflight into one service-role RPC.
-- Compatible with release schema v55 / 0055. No reward, budget, Treasury funding,
-- payout, RLS or financial authority changes are made.
--
-- The caller must present the fingerprint and payout-pack values derived from its
-- live environment. The database compares them to canonical release evidence and
-- payout authority before consulting the backing guard. A refresh lease is acquired
-- only when the guard proves that the backing observation is stale.

create or replace function public.treasury_backing_preflight(
  p_treasury_code text,
  p_expected_read_proof_fingerprint text,
  p_expected_asset text,
  p_expected_credits bigint,
  p_expected_units bigint,
  p_lease_token uuid,
  p_lease_seconds integer default 10
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_stored_fingerprint text;
  v_asset text;
  v_credits bigint;
  v_units bigint;
  v_guard jsonb;
  v_guard_status text;
  v_lease jsonb;
  v_lease_status text;
begin
  if coalesce(trim(p_treasury_code), '') = ''
     or coalesce(trim(p_expected_read_proof_fingerprint), '') = ''
     or p_expected_read_proof_fingerprint !~ '^[0-9a-f]{64}$'
     or coalesce(trim(p_expected_asset), '') = ''
     or p_expected_credits is null or p_expected_credits <= 0
     or p_expected_units is null or p_expected_units <= 0
     or p_lease_token is null
     or p_lease_seconds is null
     or p_lease_seconds < 1 or p_lease_seconds > 30 then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select value->'faucetpay_read'->>'fingerprint'
  into v_stored_fingerprint
  from public.app_config
  where key = 'release_external_proof';

  if coalesce(trim(v_stored_fingerprint), '') = ''
     or trim(v_stored_fingerprint) <> trim(p_expected_read_proof_fingerprint) then
    return jsonb_build_object('status', 'read_proof_required');
  end if;

  select upper(trim(asset)), credits, units
  into v_asset, v_credits, v_units
  from public.faucetpay_payout_pack_authority
  where singleton is true;

  if not found
     or v_asset <> upper(trim(p_expected_asset))
     or v_credits <> p_expected_credits
     or v_units <> p_expected_units then
    return jsonb_build_object('status', 'pack_authority_mismatch');
  end if;

  v_guard := public.treasury_backing_guard(trim(p_treasury_code));
  v_guard_status := coalesce(v_guard->>'status', '');

  if v_guard_status in ('backing_ready', 'backing_insufficient') then
    return v_guard;
  end if;

  if v_guard_status <> 'backing_refresh_required' then
    return jsonb_build_object('status', 'backing_unavailable');
  end if;

  v_lease := public.claim_treasury_backing_refresh_lease(
    trim(p_treasury_code),
    p_lease_token,
    p_lease_seconds
  );
  v_lease_status := coalesce(v_lease->>'status', '');

  if v_lease_status = 'acquired' then
    return jsonb_build_object(
      'status', 'backing_refresh_acquired',
      'leased_until_epoch', v_lease->'leased_until_epoch'
    );
  end if;

  if v_lease_status = 'busy' then
    return jsonb_build_object(
      'status', 'backing_refresh_busy',
      'leased_until_epoch', v_lease->'leased_until_epoch'
    );
  end if;

  return jsonb_build_object('status', 'backing_unavailable');
end;
$$;

revoke all on function public.treasury_backing_preflight(text,text,text,bigint,bigint,uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.treasury_backing_preflight(text,text,text,bigint,bigint,uuid,integer)
  to service_role;

do $$
declare
  v_schema jsonb;
begin
  select value
  into v_schema
  from public.app_config
  where key = 'release_schema';

  if coalesce((v_schema->>'version')::integer, 0) <> 55
     or coalesce(v_schema->>'migration', '') <> '0055_invite_snapshot_compaction.sql' then
    raise exception 'backing preflight compaction requires v55 authority';
  end if;

  if (
    select p.prosecdef
    from pg_catalog.pg_proc p
    where p.oid = 'public.treasury_backing_preflight(text,text,text,bigint,bigint,uuid,integer)'::regprocedure
  ) then
    raise exception 'backing preflight must remain SECURITY INVOKER';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.treasury_backing_preflight(text,text,text,bigint,bigint,uuid,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.treasury_backing_preflight(text,text,text,bigint,bigint,uuid,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.treasury_backing_preflight(text,text,text,bigint,bigint,uuid,integer)',
       'EXECUTE'
     ) then
    raise exception 'backing preflight execution scope changed';
  end if;
end
$$;
