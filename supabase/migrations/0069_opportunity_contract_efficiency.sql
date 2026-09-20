-- Release hardening: collapse six information_schema column probes for
-- reward_opportunities into one pg_catalog read and remove unnecessary
-- SECURITY DEFINER authority.
--
-- Compatible with release schema v55 / 0055. This changes no opportunity data,
-- RLS policy, Treasury value, reward amount, payout authority, or release marker.

create or replace function public.release_opportunity_intelligence_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select
    to_regclass('public.reward_opportunities') is not null
    and (
      select count(*) = 6
      from pg_catalog.pg_attribute a
      where a.attrelid = 'public.reward_opportunities'::regclass
        and a.attnum > 0
        and not a.attisdropped
        and a.attname = any(array[
          'source_type',
          'evidence_tier',
          'health_state',
          'freshness_ttl_minutes',
          'verified_at',
          'expires_at'
        ]::name[])
    )
    and coalesce((
      select c.relrowsecurity
      from pg_catalog.pg_class c
      where c.oid = 'public.reward_opportunities'::regclass
    ), false);
$$;

revoke all on function public.release_opportunity_intelligence_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_opportunity_intelligence_contract()
  to service_role;

do $$
declare
  v_schema jsonb;
  v_definition text;
  v_runtime jsonb;
begin
  select value into v_schema
  from public.app_config
  where key = 'release_schema';

  if coalesce((v_schema->>'version')::integer, 0) <> 55
     or coalesce(v_schema->>'migration', '') <> '0055_invite_snapshot_compaction.sql' then
    raise exception 'opportunity contract efficiency requires v55/0055';
  end if;

  if not public.release_opportunity_intelligence_contract() then
    raise exception 'opportunity intelligence contract failed after catalog optimization';
  end if;

  select lower(pg_get_functiondef(
    'public.release_opportunity_intelligence_contract()'::regprocedure
  ))
  into v_definition;

  if position('information_schema.columns' in v_definition) > 0
     or position('pg_catalog.pg_attribute' in v_definition) = 0 then
    raise exception 'opportunity intelligence catalog optimization missing';
  end if;

  if coalesce((
      select p.prosecdef
      from pg_catalog.pg_proc p
      where p.oid = 'public.release_opportunity_intelligence_contract()'::regprocedure
    ), true) then
    raise exception 'opportunity intelligence contract must remain security invoker';
  end if;

  if not has_function_privilege(
      'service_role',
      'public.release_opportunity_intelligence_contract()',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.release_opportunity_intelligence_contract()',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.release_opportunity_intelligence_contract()',
      'EXECUTE'
    ) then
    raise exception 'opportunity intelligence execution authority drifted';
  end if;

  select public.release_runtime_contract_snapshot()
  into v_runtime;

  if coalesce((v_runtime->>'opportunity_intelligence')::boolean, false) is not true
     or coalesce((v_runtime->>'snapshot_authority')::boolean, false) is not true then
    raise exception 'release runtime contract failed after opportunity optimization';
  end if;
end
$$;
