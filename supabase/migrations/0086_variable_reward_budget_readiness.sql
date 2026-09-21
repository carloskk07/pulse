-- V13 variable-reward activation budget authority.
-- Variable rewards remain OFF. This migration prevents config-only activation
-- unless the natural 24-window ceiling and Treasury can support the largest band.
-- Canonical release schema remains v55/0055.

create or replace function public.variable_reward_budget_ready(p_economy jsonb default null)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_economy jsonb := p_economy;
  v_pulse jsonb := '{}'::jsonb;
  v_policy jsonb := '{}'::jsonb;
  v_bands jsonb := '[]'::jsonb;
  v_band jsonb;
  v_treasury public.reward_treasuries%rowtype;
  v_base integer := 1;
  v_interval integer := 60;
  v_windows integer := 24;
  v_declared_windows integer := 24;
  v_max_band integer := 0;
  v_bps integer := 0;
  v_credits integer := 0;
  v_total_bps integer := 0;
  v_required_user_ceiling bigint := 0;
  v_policy_ceiling bigint := 0;
  v_treasury_code text := 'launch';
  v_pilot_mode boolean := true;
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
  v_pilot_mode := lower(coalesce(v_pulse->>'pilot_mode','false')) in ('true','1','yes','on');

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

  if v_treasury.max_user_daily_credits < v_required_user_ceiling then
    return false;
  end if;

  if v_pilot_mode then
    if v_treasury.daily_budget_credits < v_required_user_ceiling then
      return false;
    end if;
  else
    if v_treasury.daily_budget_credits < v_required_user_ceiling * 2 then
      return false;
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.variable_reward_budget_ready(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.variable_reward_budget_ready(jsonb)
  to service_role;

create or replace function public.resolve_hourly_pulse_reward(p_default_credits integer)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_config jsonb := '{}'::jsonb;
  v_bands jsonb := '[]'::jsonb;
  v_band jsonb;
  v_enabled boolean := false;
  v_review_required boolean := true;
  v_total_bps integer := 0;
  v_cursor integer := 0;
  v_bps integer;
  v_credits integer;
  v_entropy bytea;
  v_sample integer;
  v_roll integer;
begin
  p_default_credits := greatest(1, least(coalesce(p_default_credits,1),1000000));

  select coalesce(value,'{}'::jsonb)
  into v_config
  from public.app_config
  where key='pulse_economy_v13';

  v_enabled := lower(coalesce(v_config->>'variable_reward_enabled','false'))
    in ('true','1','yes','on');
  v_review_required := lower(coalesce(v_config->>'variable_reward_review_required','true'))
    in ('true','1','yes','on');

  if not v_enabled or v_review_required then
    return p_default_credits;
  end if;

  -- Config-only activation is insufficient. The natural ceiling must preserve
  -- all 24 hourly windows even if every draw lands on the largest band.
  if not public.variable_reward_budget_ready(v_config) then
    return p_default_credits;
  end if;

  v_bands := case
    when jsonb_typeof(v_config->'reward_bands')='array'
      then v_config->'reward_bands'
    else '[]'::jsonb
  end;

  if jsonb_array_length(v_bands) < 1 or jsonb_array_length(v_bands) > 32 then
    return p_default_credits;
  end if;

  for v_band in select value from jsonb_array_elements(v_bands)
  loop
    v_bps := coalesce((v_band->>'probability_bps')::integer,0);
    v_credits := coalesce((v_band->>'credits')::integer,0);
    if v_bps <= 0 or v_bps > 10000 or v_credits < p_default_credits or v_credits > 1000000 then
      return p_default_credits;
    end if;
    v_total_bps := v_total_bps + v_bps;
  end loop;

  if v_total_bps <> 10000 then
    return p_default_credits;
  end if;

  loop
    v_entropy := extensions.gen_random_bytes(2);
    v_sample := get_byte(v_entropy,0) * 256 + get_byte(v_entropy,1);
    exit when v_sample < 60000;
  end loop;
  v_roll := v_sample % 10000;

  for v_band in select value from jsonb_array_elements(v_bands)
  loop
    v_bps := (v_band->>'probability_bps')::integer;
    v_credits := (v_band->>'credits')::integer;
    v_cursor := v_cursor + v_bps;
    if v_roll < v_cursor then
      return v_credits;
    end if;
  end loop;

  return p_default_credits;
end;
$$;

revoke all on function public.resolve_hourly_pulse_reward(integer)
  from public, anon, authenticated;
grant execute on function public.resolve_hourly_pulse_reward(integer)
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
begin
  if new.key <> 'pulse_economy_v13' then
    return new;
  end if;

  v_enabled := lower(coalesce(new.value->>'variable_reward_enabled','false'))
    in ('true','1','yes','on');
  v_review_required := lower(coalesce(new.value->>'variable_reward_review_required','true'))
    in ('true','1','yes','on');

  if v_enabled and not v_review_required
     and not public.variable_reward_budget_ready(new.value) then
    raise exception 'variable_reward_budget_not_ready' using errcode='23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_variable_reward_activation_guard()
  from public, anon, authenticated, service_role;

drop trigger if exists variable_reward_activation_guard on public.app_config;
create trigger variable_reward_activation_guard
before insert or update of value
on public.app_config
for each row execute function public.enforce_variable_reward_activation_guard();

create or replace function public.release_variable_reward_budget_contract()
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
  and not has_function_privilege(
    'anon','public.variable_reward_budget_ready(jsonb)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.variable_reward_budget_ready(jsonb)','EXECUTE'
  )
  and (
    not coalesce((
      select
        lower(value->>'variable_reward_enabled') in ('true','1','yes','on')
        and not (lower(coalesce(value->>'variable_reward_review_required','true')) in ('true','1','yes','on'))
      from public.app_config
      where key='pulse_economy_v13'
    ),false)
    or public.variable_reward_budget_ready(null)
  );
$$;

revoke all on function public.release_variable_reward_budget_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_variable_reward_budget_contract()
  to service_role;

do $$
begin
  if not public.release_variable_reward_budget_contract() then
    raise exception 'variable reward budget contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'variable reward budget authority requires canonical release schema v55';
  end if;
end
$$;
