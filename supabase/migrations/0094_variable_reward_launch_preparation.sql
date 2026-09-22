-- V13.3 variable-reward launch preparation.
-- Public opening remains isolated by hourly_pulse.pilot_mode.
-- Variable reward configuration may be finalized during pilot even when
-- launch Treasury is not yet funded for the public worst-case ceiling.
-- Canonical release schema remains v55/0055.

create or replace function public.variable_reward_model_valid(p_economy jsonb default null)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_economy jsonb := p_economy;
  v_pulse jsonb := '{}'::jsonb;
  v_bands jsonb := '[]'::jsonb;
  v_band jsonb;
  v_base integer := 1;
  v_interval integer := 60;
  v_windows integer := 24;
  v_declared_windows integer := 24;
  v_total_bps integer := 0;
  v_bps integer := 0;
  v_credits integer := 0;
  v_max_band integer := 0;
begin
  if v_economy is null then
    select coalesce(value,'{}'::jsonb)
    into v_economy
    from public.app_config
    where key='pulse_economy_v13';
  end if;

  select coalesce(value,'{}'::jsonb)
  into v_pulse
  from public.app_config
  where key='hourly_pulse';

  v_base := greatest(1,least(coalesce((v_pulse->>'credits')::integer,1),1000000));
  v_interval := greatest(15,least(coalesce((v_pulse->>'interval_minutes')::integer,60),1440));
  v_windows := floor(1440::numeric / v_interval::numeric)::integer;
  v_declared_windows := greatest(1,least(
    coalesce((v_economy->>'hourly_windows_per_day')::integer,v_windows),
    96
  ));

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

  return v_total_bps = 10000 and v_max_band >= v_base;
end;
$$;

revoke all on function public.variable_reward_model_valid(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.variable_reward_model_valid(jsonb)
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
begin
  if new.key <> 'pulse_economy_v13' then
    return new;
  end if;

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

  -- During pilot, finalize the intended public product model without coupling
  -- product preparation to today's Treasury. Turning pilot off still requires
  -- the full worst-case public budget authority.
  if not v_pilot_mode and not public.variable_reward_budget_ready(new.value) then
    raise exception 'variable_reward_budget_not_ready' using errcode='23514';
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
    'variable_reward_budget_ready'
    in pg_get_functiondef('public.resolve_hourly_pulse_reward(integer)'::regprocedure)
  ) > 0
  and position(
    'v_required_user_ceiling'
    in pg_get_functiondef('public.variable_reward_budget_ready(jsonb)'::regprocedure)
  ) > 0
  and position(
    'variable_reward_model_valid'
    in pg_get_functiondef('public.enforce_variable_reward_activation_guard()'::regprocedure)
  ) > 0
  and not has_function_privilege(
    'anon','public.variable_reward_budget_ready(jsonb)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.variable_reward_budget_ready(jsonb)','EXECUTE'
  )
  and not has_function_privilege(
    'anon','public.variable_reward_model_valid(jsonb)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.variable_reward_model_valid(jsonb)','EXECUTE'
  )
  and (
    not state.variable_active
    or (
      state.pilot_mode
      and public.variable_reward_model_valid(null)
    )
    or (
      not state.pilot_mode
      and public.variable_reward_budget_ready(null)
    )
  )
from state;
$$;

revoke all on function public.release_variable_reward_budget_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_variable_reward_budget_contract()
  to service_role;

update public.app_config
set value = jsonb_set(
  jsonb_set(value,'{variable_reward_enabled}','true'::jsonb,true),
  '{variable_reward_review_required}','false'::jsonb,true
),
version = greatest(version,14),
reason = 'Variable faucet reward model finalized for launch while public access remains isolated by pilot mode',
updated_at = now()
where key='pulse_economy_v13';

do $$
begin
  if not public.variable_reward_model_valid(null) then
    raise exception 'variable reward launch model validation failed';
  end if;

  if not coalesce((
    select lower(value->>'pilot_mode') in ('true','1','yes','on')
    from public.app_config
    where key='hourly_pulse'
  ),false) then
    raise exception 'variable reward launch preparation requires pilot isolation';
  end if;

  if not coalesce((
    select lower(value->>'variable_reward_enabled') in ('true','1','yes','on')
      and not (lower(coalesce(value->>'variable_reward_review_required','true')) in ('true','1','yes','on'))
    from public.app_config
    where key='pulse_economy_v13'
  ),false) then
    raise exception 'variable reward launch configuration was not activated';
  end if;

  if not public.release_variable_reward_budget_contract() then
    raise exception 'variable reward launch contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'variable reward launch preparation requires canonical release schema v55';
  end if;
end
$$;
