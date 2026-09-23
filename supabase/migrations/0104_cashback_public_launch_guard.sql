-- V13.10 cashback public-launch guard.
-- Cashback may remain disabled while the product is in pilot, but PUBLIC cannot
-- open without an enabled cashback model and at least one fresh, valid affiliate
-- opportunity. Runtime readiness separately verifies the callback secret.
-- Canonical release schema remains v55/0055.

create or replace function public.cashback_public_launch_requirements_ready(
  p_economy jsonb default null
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_economy jsonb := p_economy;
  v_enabled boolean := false;
  v_share_bps integer := 0;
begin
  if v_economy is null then
    select coalesce(value,'{}'::jsonb)
    into v_economy
    from public.app_config
    where key='pulse_economy_v13';
  end if;

  v_enabled := lower(coalesce(v_economy->>'cashback_enabled','false'))
    in ('true','1','yes','on');

  v_share_bps := greatest(0,least(
    coalesce((v_economy->>'cashback_user_share_bps')::integer,0),
    10000
  ));

  if not v_enabled or v_share_bps <= 0 or v_share_bps > 7500 then
    return false;
  end if;

  if not public.release_cashback_budget_contract()
     or not public.release_cashback_ingestion_contract() then
    return false;
  end if;

  return exists (
    select 1
    from public.reward_opportunities ro
    where ro.source_type='affiliate'
      and ro.status='active'
      and ro.health_state <> 'hidden'
      and (ro.expires_at is null or ro.expires_at > now())
      and ro.refreshed_at + make_interval(mins => ro.freshness_ttl_minutes) > now()
      and length(trim(coalesce(ro.provider,''))) > 0
      and length(trim(coalesce(ro.metadata->>'destination_url',''))) between 9 and 2000
      and lower(trim(coalesce(ro.metadata->>'destination_url',''))) like 'https://%'
      and trim(coalesce(ro.metadata->>'tracking_param','subid')) ~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'
  );
end;
$$;

revoke all on function public.cashback_public_launch_requirements_ready(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.cashback_public_launch_requirements_ready(jsonb)
  to service_role;

create or replace function public.cashback_public_launch_ready(
  p_pulse jsonb default null,
  p_economy jsonb default null
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_pulse jsonb := p_pulse;
  v_pilot boolean := true;
begin
  if v_pulse is null then
    select coalesce(value,'{}'::jsonb)
    into v_pulse
    from public.app_config
    where key='hourly_pulse';
  end if;

  v_pilot := lower(coalesce(v_pulse->>'pilot_mode','true'))
    in ('true','1','yes','on');

  if v_pilot then
    return true;
  end if;

  return public.cashback_public_launch_requirements_ready(p_economy);
end;
$$;

revoke all on function public.cashback_public_launch_ready(jsonb,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.cashback_public_launch_ready(jsonb,jsonb)
  to service_role;

create or replace function public.enforce_cashback_public_launch_guard()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_pulse jsonb := '{}'::jsonb;
begin
  if new.key = 'hourly_pulse' then
    if lower(coalesce(new.value->>'pilot_mode','true')) in ('true','1','yes','on') then
      return new;
    end if;

    if not public.cashback_public_launch_ready(new.value,null) then
      raise exception 'cashback_public_launch_not_ready' using errcode='23514';
    end if;

    return new;
  end if;

  if new.key = 'pulse_economy_v13' then
    select coalesce(value,'{}'::jsonb)
    into v_pulse
    from public.app_config
    where key='hourly_pulse';

    if lower(coalesce(v_pulse->>'pilot_mode','true')) not in ('true','1','yes','on')
       and not public.cashback_public_launch_ready(v_pulse,new.value) then
      raise exception 'cashback_public_launch_not_ready' using errcode='23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_cashback_public_launch_guard()
  from public, anon, authenticated, service_role;

drop trigger if exists cashback_public_launch_guard on public.app_config;
create trigger cashback_public_launch_guard
before update of value on public.app_config
for each row
when (new.key in ('hourly_pulse','pulse_economy_v13'))
execute function public.enforce_cashback_public_launch_guard();

create or replace function public.release_cashback_public_launch_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  exists (
    select 1
    from pg_trigger
    where tgrelid='public.app_config'::regclass
      and tgname='cashback_public_launch_guard'
      and tgenabled <> 'D'
  )
  and position(
    'cashback_public_launch_ready'
    in pg_get_functiondef('public.enforce_cashback_public_launch_guard()'::regprocedure)
  ) > 0
  and position(
    'cashback_public_launch_requirements_ready'
    in pg_get_functiondef('public.cashback_public_launch_ready(jsonb,jsonb)'::regprocedure)
  ) > 0
  and not has_function_privilege(
    'anon','public.cashback_public_launch_requirements_ready(jsonb)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.cashback_public_launch_requirements_ready(jsonb)','EXECUTE'
  )
  and not has_function_privilege(
    'anon','public.cashback_public_launch_ready(jsonb,jsonb)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.cashback_public_launch_ready(jsonb,jsonb)','EXECUTE'
  )
  and public.cashback_public_launch_ready(null,null);
$$;

revoke all on function public.release_cashback_public_launch_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_cashback_public_launch_contract()
  to service_role;

do $$
begin
  if not public.release_cashback_public_launch_contract() then
    raise exception 'cashback public-launch contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'cashback public-launch guard requires canonical release schema v55';
  end if;
end
$$;
