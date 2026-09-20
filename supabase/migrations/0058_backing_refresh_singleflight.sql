-- Performance-only migration: globally coalesce stale Treasury backing refreshes.
-- Compatible with release schema v55 / 0055. No reward, budget, Treasury funding,
-- payout, RLS or financial authority changes are made.
--
-- A short lease lives under one controlled app_config key per Treasury. Exactly one
-- service_role runtime may refresh the external FaucetPay balance while the lease is
-- live. Other runtimes observe "busy" and reuse the fresh backing observation once
-- it appears, preventing a serverless thundering herd against FaucetPay.

create or replace function public.claim_treasury_backing_refresh_lease(
  p_treasury_code text,
  p_lease_token uuid,
  p_lease_seconds integer default 10
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_key text;
  v_now_epoch bigint := floor(extract(epoch from now()))::bigint;
  v_until_epoch bigint;
  v_value jsonb;
begin
  if coalesce(trim(p_treasury_code), '') = ''
     or p_lease_token is null
     or p_lease_seconds is null
     or p_lease_seconds < 1
     or p_lease_seconds > 30 then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  if not exists (
    select 1
    from public.reward_treasuries
    where code = trim(p_treasury_code)
  ) then
    return jsonb_build_object('status', 'unknown_treasury');
  end if;

  v_key := 'treasury_backing_refresh_lease:' || trim(p_treasury_code);
  v_until_epoch := v_now_epoch + p_lease_seconds;

  update public.app_config
  set value = jsonb_build_object(
        'token', p_lease_token::text,
        'leased_until_epoch', v_until_epoch
      ),
      version = version + 1,
      reason = 'Treasury backing refresh lease',
      updated_at = now()
  where key = v_key
    and (
      case
        when coalesce(value->>'leased_until_epoch', '') ~ '^[0-9]+$'
          then (value->>'leased_until_epoch')::bigint
        else 0
      end
    ) <= v_now_epoch
  returning value into v_value;

  if found then
    return jsonb_build_object(
      'status', 'acquired',
      'lease_token', p_lease_token,
      'leased_until_epoch', v_until_epoch
    );
  end if;

  insert into public.app_config(key, value, version, reason)
  values (
    v_key,
    jsonb_build_object(
      'token', p_lease_token::text,
      'leased_until_epoch', v_until_epoch
    ),
    1,
    'Treasury backing refresh lease'
  )
  on conflict (key) do nothing
  returning value into v_value;

  if found then
    return jsonb_build_object(
      'status', 'acquired',
      'lease_token', p_lease_token,
      'leased_until_epoch', v_until_epoch
    );
  end if;

  select value
  into v_value
  from public.app_config
  where key = v_key;

  return jsonb_build_object(
    'status', 'busy',
    'leased_until_epoch',
    case
      when coalesce(v_value->>'leased_until_epoch', '') ~ '^[0-9]+$'
        then (v_value->>'leased_until_epoch')::bigint
      else 0
    end
  );
end;
$$;

revoke all on function public.claim_treasury_backing_refresh_lease(text,uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_treasury_backing_refresh_lease(text,uuid,integer)
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
    raise exception 'backing refresh single-flight migration requires v55 authority';
  end if;

  if (
    select p.prosecdef
    from pg_catalog.pg_proc p
    where p.oid = 'public.claim_treasury_backing_refresh_lease(text,uuid,integer)'::regprocedure
  ) then
    raise exception 'backing refresh lease must remain SECURITY INVOKER';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.claim_treasury_backing_refresh_lease(text,uuid,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.claim_treasury_backing_refresh_lease(text,uuid,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.claim_treasury_backing_refresh_lease(text,uuid,integer)',
       'EXECUTE'
     ) then
    raise exception 'backing refresh lease execution scope changed';
  end if;
end
$$;
