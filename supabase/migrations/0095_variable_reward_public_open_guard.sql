-- V13.4 fail-closed public opening guard for variable faucet rewards.
-- Preparing the product in pilot is allowed without launch Treasury.
-- Transitioning out of pilot is rejected at the database boundary unless
-- the public worst-case reward ceiling is configured safely.
-- Canonical release schema remains v55/0055.

create or replace function public.variable_reward_public_open_ready(
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
  v_economy jsonb := p_economy;
  v_policy jsonb := '{}'::jsonb;
  v_bands jsonb := '[]'::jsonb;
  v_band jsonb;
  v_treasury public.reward_treasuries%rowtype;
  v_base integer := 1;
  v_interval integer := 60;
  v_windows integer := 24;
  v_declared_windows integer := 24;
  v_total_bps integer := 0;
  v_bps integer := 0;
  v_credits integer := 0;
  v_max_band integer := 0;
  v_required_user_ceiling bigint := 0;
  v_policy_ceiling bigint := 0;
  v_treasury_code text := 'launch';
begin
  if v_pulse is null then
    select coalesce(value,'{}'::jsonb)
    into v_pulse
    from public.app_config
    where key='hourly_pulse';
  end if;

  if v_economy is null then
    select coalesce(value,'{}'::jsonb)
    into v_economy
    from public.app_config
    where key='pulse_economy_v13';
  end if;

  select coalesce(value,'{}'::jsonb)
  into v_policy
  from public.app_config
  where key='faucet_continuous_launch_policy';

  v_base := greatest(1,least(coalesce((v_pulse->>'credits')::integer,1),1000000));
  v_interval := greatest(15,least(coalesce((v_pulse->>'interval_minutes')::integer,60),1440));
  v_windows := floor(1440::numeric / v_interval::numeric)::integer;
  v_declared_windows := greatest(1,least(
    coalesce((v_economy->>'hourly_windows_per_day')::integer,v_windows),
    96
  ));
  v_treasury_code := coalesce(nullif(trim(v_pulse->>'treasury_code'),''),'launch');

  if v_windows <> v_declared_windows or v_windows <> 24 then
    return false;
  end if;

  v_bands := case
    when jsonb_typeof(v_economy->'reward_bands')='array'
      then v_economy->'reward_bands'
    else '[]'::jsonb
  end;

  if jsonb_array_length(v_bands) < 1 or jsonb_array_length(v_bands) > 32 then
    return false;
  end if;

  for v_band in select value from jsonb_array_elements(v_bands)
  loop
    v_bps := coalesce((v_band->>'probability_bps')::integer,0);
    v_credits := coalesce((v_band->>'credits')::integer,0);

    if v_bps <= 0 or v_bps > 10000
       or v_credits < v_base or v_credits > 1000000 then
      return false;
    end if;

    v_total_bps := v_total_bps + v_bps;
    v_max_band := greatest(v_max_band,v_credits);
  end loop;

  if v_total_bps <> 10000 or v_max_band < v_base then
    return false;
  end if;

  v_required_user_ceiling := v_windows::bigint * v_max_band::bigint;
  v_policy_ceiling := greatest(0,coalesce(
    (v_policy->>'user_daily_ceiling_credits')::bigint,
    0
  ));

  if lower(coalesce(v_policy->>'arbitrary_user_quota_enabled','true')) in ('true','1','yes','on')
     or coalesce((v_policy->>'windows_per_day')::integer,0) <> v_windows
     or v_policy_ceiling < v_required_user_ceiling then
    return false;
  end if;

  select * into v_treasury
  from public.reward_treasuries
  where code=v_treasury_code;

  if not found or not v_treasury.enabled or v_treasury.kill_switch then
    return false;
  end if;

  return
    v_treasury.max_user_daily_credits >= v_required_user_ceiling
    and v_treasury.daily_budget_credits >= v_required_user_ceiling * 2;
end;
$$;

revoke all on function public.variable_reward_public_open_ready(jsonb,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.variable_reward_public_open_ready(jsonb,jsonb)
  to service_role;

create or replace function public.enforce_variable_reward_activation_guard()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_enabled boolean := false;
  v_review_required boolean := true;
  v_pilot_mode boolean := true;
  v_economy jsonb := '{}'::jsonb;
begin
  if new.key = 'pulse_economy_v13' then
    v_enabled := lower(coalesce(new.value->>'variable_reward_enabled','false'))
      in ('true','1','yes','on');
    v_review_required := lower(coalesce(new.value->>'variable_reward_review_required','true'))
      in ('true','1','yes','on');

    if not v_enabled or v_review_required then
      return new;
    end if;

    if not public.variable_reward_model_valid(new.value) then
      raise exception 'variable_reward_model_invalid' using errcode='23514';
    end if;

    select lower(coalesce(value->>'pilot_mode','true')) in ('true','1','yes','on')
    into v_pilot_mode
    from public.app_config
    where key='hourly_pulse';

    v_pilot_mode := coalesce(v_pilot_mode,true);

    if not v_pilot_mode and not public.variable_reward_budget_ready(new.value) then
      raise exception 'variable_reward_budget_not_ready' using errcode='23514';
    end if;

    return new;
  end if;

  if new.key = 'hourly_pulse' then
    v_pilot_mode := lower(coalesce(new.value->>'pilot_mode','true'))
      in ('true','1','yes','on');

    if v_pilot_mode then
      return new;
    end if;

    select coalesce(value,'{}'::jsonb)
    into v_economy
    from public.app_config
    where key='pulse_economy_v13';

    v_enabled := lower(coalesce(v_economy->>'variable_reward_enabled','false'))
      in ('true','1','yes','on');
    v_review_required := lower(coalesce(v_economy->>'variable_reward_review_required','true'))
      in ('true','1','yes','on');

    if v_enabled and not v_review_required
       and not public.variable_reward_public_open_ready(new.value,v_economy) then
      raise exception 'variable_reward_public_open_not_ready' using errcode='23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_variable_reward_activation_guard()
  from public, anon, authenticated, service_role;

create or replace function public.release_variable_reward_budget_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
with state as (
  select
    coalesce((
      select lower(value->>'variable_reward_enabled') in ('true','1','yes','on')
        and not (lower(coalesce(value->>'variable_reward_review_required','true')) in ('true','1','yes','on'))
      from public.app_config
      where key='pulse_economy_v13'
    ),false) as variable_active,
    coalesce((
      select lower(coalesce(value->>'pilot_mode','true')) in ('true','1','yes','on')
      from public.app_config
      where key='hourly_pulse'
    ),true) as pilot_mode
)
select
  exists (
    select 1
    from pg_trigger
    where tgrelid='public.app_config'::regclass
      and tgname='variable_reward_activation_guard'
      and tgenabled <> 'D'
  )
  and position(
    'variable_reward_public_open_ready'
    in pg_get_functiondef('public.enforce_variable_reward_activation_guard()'::regprocedure)
  ) > 0
  and position(
    'variable_reward_budget_ready'
    in pg_get_functiondef('public.resolve_hourly_pulse_reward(integer)'::regprocedure)
  ) > 0
  and not has_function_privilege(
    'anon','public.variable_reward_public_open_ready(jsonb,jsonb)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.variable_reward_public_open_ready(jsonb,jsonb)','EXECUTE'
  )
  and (
    not state.variable_active
    or (
      state.pilot_mode
      and public.variable_reward_model_valid(null)
    )
    or (
      not state.pilot_mode
      and public.variable_reward_public_open_ready(null,null)
    )
  )
from state;
$$;

revoke all on function public.release_variable_reward_budget_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_variable_reward_budget_contract()
  to service_role;

do $$
declare
  v_guarded boolean := false;
begin
  if not public.release_variable_reward_budget_contract() then
    raise exception 'variable reward public-open contract failed';
  end if;

  if not coalesce((
    select lower(value->>'pilot_mode') in ('true','1','yes','on')
    from public.app_config
    where key='hourly_pulse'
  ),false) then
    raise exception 'public-open guard installation requires current pilot isolation';
  end if;

  begin
    update public.app_config
    set value = jsonb_set(value,'{pilot_mode}','false'::jsonb,true)
    where key='hourly_pulse';

    raise exception 'public-open guard failed to reject unsafe transition';
  exception
    when check_violation then
      if sqlerrm = 'variable_reward_public_open_not_ready' then
        v_guarded := true;
      else
        raise;
      end if;
  end;

  if not v_guarded then
    raise exception 'unsafe public-open transition was not guarded';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'variable reward public-open guard requires canonical release schema v55';
  end if;
end
$$;
