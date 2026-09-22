-- V13.5 execute the final variable faucet model during pilot.
-- Pilot testing may exercise the real variable draw without public-launch
-- Treasury readiness. Public execution remains fail-closed behind the
-- public-open authority.
-- Canonical release schema remains v55/0055.

create or replace function public.resolve_hourly_pulse_reward(p_default_credits integer)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_config jsonb := '{}'::jsonb;
  v_pulse jsonb := '{}'::jsonb;
  v_bands jsonb := '[]'::jsonb;
  v_band jsonb;
  v_enabled boolean := false;
  v_review_required boolean := true;
  v_pilot_mode boolean := true;
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

  select coalesce(value,'{}'::jsonb)
  into v_pulse
  from public.app_config
  where key='hourly_pulse';

  v_enabled := lower(coalesce(v_config->>'variable_reward_enabled','false'))
    in ('true','1','yes','on');
  v_review_required := lower(coalesce(v_config->>'variable_reward_review_required','true'))
    in ('true','1','yes','on');
  v_pilot_mode := lower(coalesce(v_pulse->>'pilot_mode','true'))
    in ('true','1','yes','on');

  if not v_enabled or v_review_required then
    return p_default_credits;
  end if;

  -- Product preparation and public opening are separate authorities.
  -- Pilot may exercise the real launch model once its bands are valid.
  -- Public mode requires the full public-open authority.
  if v_pilot_mode then
    if not public.variable_reward_model_valid(v_config) then
      return p_default_credits;
    end if;
  else
    if not public.variable_reward_public_open_ready(v_pulse,v_config) then
      return p_default_credits;
    end if;
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

    if v_bps <= 0 or v_bps > 10000
       or v_credits < p_default_credits or v_credits > 1000000 then
      return p_default_credits;
    end if;

    v_total_bps := v_total_bps + v_bps;
  end loop;

  if v_total_bps <> 10000 then
    return p_default_credits;
  end if;

  -- Rejection sampling avoids modulo bias while keeping the draw entirely
  -- inside Postgres and outside client control.
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

create or replace function public.release_variable_reward_execution_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
with fn as (
  select lower(pg_get_functiondef('public.resolve_hourly_pulse_reward(integer)'::regprocedure)) as src
)
select
  position('variable_reward_model_valid' in (select src from fn)) > 0
  and position('variable_reward_public_open_ready' in (select src from fn)) > 0
  and position('v_pilot_mode' in (select src from fn)) > 0
  and position('extensions.gen_random_bytes' in (select src from fn)) > 0
  and position('v_sample < 60000' in (select src from fn)) > 0
  and has_function_privilege('service_role','public.resolve_hourly_pulse_reward(integer)','EXECUTE')
  and not has_function_privilege('anon','public.resolve_hourly_pulse_reward(integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.resolve_hourly_pulse_reward(integer)','EXECUTE');
$$;

revoke all on function public.release_variable_reward_execution_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_variable_reward_execution_contract()
  to service_role;

do $$
begin
  if not public.release_variable_reward_execution_contract() then
    raise exception 'variable reward execution contract failed';
  end if;

  if not coalesce((
    select lower(value->>'pilot_mode') in ('true','1','yes','on')
    from public.app_config
    where key='hourly_pulse'
  ),false) then
    raise exception 'variable reward pilot execution migration requires current pilot isolation';
  end if;

  if not public.variable_reward_model_valid(null) then
    raise exception 'variable reward pilot execution requires a valid launch model';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'variable reward execution requires canonical release schema v55';
  end if;
end
$$;
