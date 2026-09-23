-- V13.11 extra-rewards public-launch guard.
-- Pilot may run with zero reward opportunities while integrations are prepared.
-- PUBLIC requires at least one canonical, fresh and actually actionable route:
-- a prefunded Pulse Direct campaign or a valid affiliate cashback opportunity.
-- Canonical release schema remains v55/0055.

create or replace function public.extra_rewards_public_launch_requirements_ready(
  p_economy jsonb default null
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_economy jsonb := p_economy;
  v_cashback_enabled boolean := false;
begin
  if v_economy is null then
    select coalesce(value,'{}'::jsonb)
    into v_economy
    from public.app_config
    where key='pulse_economy_v13';
  end if;

  v_cashback_enabled := lower(coalesce(v_economy->>'cashback_enabled','false'))
    in ('true','1','yes','on');

  return exists (
    select 1
    from public.reward_opportunities ro
    join public.direct_campaigns dc
      on dc.opportunity_id = ro.id
    where ro.source_type='direct'
      and ro.provider='pulse_direct'
      and ro.status='active'
      and ro.health_state <> 'hidden'
      and (ro.expires_at is null or ro.expires_at > now())
      and ro.refreshed_at + make_interval(mins => ro.freshness_ttl_minutes) > now()
      and dc.status='active'
      and dc.destination_url ~ '^https://'
      and dc.funded_usd_micros - dc.reserved_usd_micros - dc.spent_usd_micros
          >= dc.price_per_action_usd_micros
      and dc.completion_count < dc.max_completions
      and (dc.starts_at is null or dc.starts_at <= now())
      and (dc.ends_at is null or dc.ends_at > now())
      and dc.reward_credits = ro.base_reward_credits
      and dc.price_per_action_usd_micros = ro.payout_usd_micros
  )
  or (
    v_cashback_enabled
    and public.cashback_public_launch_requirements_ready(v_economy)
  );
end;
$$;

revoke all on function public.extra_rewards_public_launch_requirements_ready(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.extra_rewards_public_launch_requirements_ready(jsonb)
  to service_role;

create or replace function public.extra_rewards_public_launch_ready(
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

  return public.extra_rewards_public_launch_requirements_ready(p_economy);
end;
$$;

revoke all on function public.extra_rewards_public_launch_ready(jsonb,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.extra_rewards_public_launch_ready(jsonb,jsonb)
  to service_role;

create or replace function public.enforce_extra_rewards_public_launch_guard()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_economy jsonb := '{}'::jsonb;
begin
  if new.key <> 'hourly_pulse' then
    return new;
  end if;

  if lower(coalesce(new.value->>'pilot_mode','true')) in ('true','1','yes','on') then
    return new;
  end if;

  select coalesce(value,'{}'::jsonb)
  into v_economy
  from public.app_config
  where key='pulse_economy_v13';

  if not public.extra_rewards_public_launch_requirements_ready(v_economy) then
    raise exception 'extra_rewards_public_launch_not_ready' using errcode='23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_extra_rewards_public_launch_guard()
  from public, anon, authenticated, service_role;

drop trigger if exists extra_rewards_public_launch_guard on public.app_config;
create trigger extra_rewards_public_launch_guard
before update of value on public.app_config
for each row
when (new.key='hourly_pulse')
execute function public.enforce_extra_rewards_public_launch_guard();

create or replace function public.release_extra_rewards_public_launch_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  public.release_opportunity_intelligence_contract()
  and exists (
    select 1
    from pg_trigger
    where tgrelid='public.app_config'::regclass
      and tgname='extra_rewards_public_launch_guard'
      and tgenabled <> 'D'
  )
  and position(
    'extra_rewards_public_launch_requirements_ready'
    in pg_get_functiondef('public.enforce_extra_rewards_public_launch_guard()'::regprocedure)
  ) > 0
  and position(
    'direct_campaigns'
    in pg_get_functiondef('public.extra_rewards_public_launch_requirements_ready(jsonb)'::regprocedure)
  ) > 0
  and position(
    'cashback_public_launch_requirements_ready'
    in pg_get_functiondef('public.extra_rewards_public_launch_requirements_ready(jsonb)'::regprocedure)
  ) > 0
  and not has_function_privilege(
    'anon','public.extra_rewards_public_launch_requirements_ready(jsonb)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.extra_rewards_public_launch_requirements_ready(jsonb)','EXECUTE'
  )
  and not has_function_privilege(
    'anon','public.extra_rewards_public_launch_ready(jsonb,jsonb)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.extra_rewards_public_launch_ready(jsonb,jsonb)','EXECUTE'
  )
  and public.extra_rewards_public_launch_ready(null,null);
$$;

revoke all on function public.release_extra_rewards_public_launch_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_extra_rewards_public_launch_contract()
  to service_role;

do $$
begin
  if not public.release_extra_rewards_public_launch_contract() then
    raise exception 'extra rewards public-launch contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'extra rewards public-launch guard requires canonical release schema v55';
  end if;
end
$$;
