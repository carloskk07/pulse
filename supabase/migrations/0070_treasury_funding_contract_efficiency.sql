-- Release hardening: collapse repeated information_schema and
-- pg_get_functiondef work in the Treasury funding contract.
--
-- Compatible with release schema v55 / 0055. This changes no Treasury values,
-- funding events, payout authority, reward economics, RLS policy, or release marker.

create or replace function public.release_treasury_funding_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  with target as (
    select
      lower(pg_get_functiondef(
        'public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)'::regprocedure
      )) as src,
      coalesce((
        select not p.prosecdef
        from pg_catalog.pg_proc p
        where p.oid =
          'public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)'::regprocedure
      ), false) as invoker
  ),
  columns_ok as (
    select count(*) = 4 as ok
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.treasury_funding_events'::regclass
      and a.attnum > 0
      and not a.attisdropped
      and a.attname = any(array[
        'available_credits_before',
        'available_credits_after',
        'remaining_daily_budget_credits',
        'total_backed_exposure_credits'
      ]::name[])
  )
  select
    to_regclass('public.treasury_funding_events') is not null
    and to_regclass('public.treasury_funding_events_actor_user_idx') is not null
    and coalesce((
      select c.relrowsecurity
      from pg_catalog.pg_class c
      where c.oid = 'public.treasury_funding_events'::regclass
    ), false)
    and (select ok from columns_ok)
    and to_regprocedure(
      'public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)'
    ) is not null
    and (select invoker from target)
    and position('funding_gap_changed' in (select src from target)) > 0
    and position('remaining_daily_budget' in (select src from target)) > 0
    and position(
      'status in (''reserved'', ''consumed'')'
      in (select src from target)
    ) > 0
    and position(
      'v_total_exposure_credits := v_liability_credits + v_available_after'
      in (select src from target)
    ) > 0
    and position(
      'p_amount_credits <> v_top_up_credits'
      in (select src from target)
    ) > 0
    and has_function_privilege(
      'service_role',
      'public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.fund_reward_treasury(text,bigint,text,text,bigint,bigint,bigint,bigint,uuid,text)',
      'EXECUTE'
    )
    and has_table_privilege(
      'service_role',
      'public.treasury_funding_events',
      'SELECT'
    )
    and has_table_privilege(
      'service_role',
      'public.treasury_funding_events',
      'INSERT'
    )
    and not has_table_privilege(
      'anon',
      'public.treasury_funding_events',
      'SELECT'
    )
    and not has_table_privilege(
      'authenticated',
      'public.treasury_funding_events',
      'SELECT'
    );
$$;

revoke all on function public.release_treasury_funding_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_treasury_funding_contract()
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
    raise exception 'treasury funding contract efficiency requires v55/0055';
  end if;

  if not public.release_treasury_funding_contract() then
    raise exception 'treasury funding contract failed after catalog optimization';
  end if;

  select lower(pg_get_functiondef(
    'public.release_treasury_funding_contract()'::regprocedure
  ))
  into v_definition;

  if position('information_schema.columns' in v_definition) > 0
     or position('pg_catalog.pg_attribute' in v_definition) = 0
     or position('with target as' in v_definition) = 0 then
    raise exception 'treasury funding contract optimization missing';
  end if;

  if coalesce((
      select p.prosecdef
      from pg_catalog.pg_proc p
      where p.oid = 'public.release_treasury_funding_contract()'::regprocedure
    ), true) then
    raise exception 'treasury funding contract must remain security invoker';
  end if;

  if not has_function_privilege(
      'service_role',
      'public.release_treasury_funding_contract()',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.release_treasury_funding_contract()',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.release_treasury_funding_contract()',
      'EXECUTE'
    ) then
    raise exception 'treasury funding contract execution authority drifted';
  end if;

  select public.release_runtime_contract_snapshot()
  into v_runtime;

  if coalesce((v_runtime->>'treasury_funding')::boolean, false) is not true
     or coalesce((v_runtime->>'snapshot_authority')::boolean, false) is not true then
    raise exception 'release runtime contract failed after Treasury funding optimization';
  end if;
end
$$;
