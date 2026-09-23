-- V13.9 align continuous-faucet policy with the variable reward ceiling.
-- Product cadence authority is prepared now; Treasury capacity remains unchanged
-- until the actual public opening is funded.
-- Canonical release schema remains v55/0055.

create or replace function public.variable_reward_cadence_policy_ready(
  p_pulse jsonb default null,
  p_economy jsonb default null,
  p_policy jsonb default null
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_pulse jsonb := p_pulse;
  v_economy jsonb := p_economy;
  v_policy jsonb := p_policy;
  v_interval integer := 60;
  v_windows integer := 24;
  v_base integer := 1;
  v_max_band integer := 0;
  v_band jsonb;
  v_required_ceiling bigint := 0;
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

  if v_policy is null then
    select coalesce(value,'{}'::jsonb)
    into v_policy
    from public.app_config
    where key='faucet_continuous_launch_policy';
  end if;

  if not public.variable_reward_model_valid(v_economy) then
    return false;
  end if;

  v_interval := greatest(15,least(coalesce((v_pulse->>'interval_minutes')::integer,60),1440));
  v_windows := floor(1440::numeric / v_interval::numeric)::integer;
  v_base := greatest(1,least(coalesce((v_pulse->>'credits')::integer,1),1000000));

  for v_band in
    select value
    from jsonb_array_elements(
      case
        when jsonb_typeof(v_economy->'reward_bands')='array'
          then v_economy->'reward_bands'
        else '[]'::jsonb
      end
    )
  loop
    v_max_band := greatest(v_max_band,coalesce((v_band->>'credits')::integer,0));
  end loop;

  if v_max_band < v_base or v_windows <> 24 then
    return false;
  end if;

  v_required_ceiling := v_windows::bigint * v_max_band::bigint;

  return
    coalesce((v_policy->>'windows_per_day')::integer,0) = v_windows
    and coalesce((v_policy->>'interval_minutes')::integer,0) = v_interval
    and coalesce((v_policy->>'base_reward_credits')::integer,0) = v_base
    and coalesce((v_policy->>'user_daily_ceiling_credits')::bigint,0) >= v_required_ceiling
    and not (
      lower(coalesce(v_policy->>'arbitrary_user_quota_enabled','true'))
      in ('true','1','yes','on')
    );
end;
$$;

revoke all on function public.variable_reward_cadence_policy_ready(jsonb,jsonb,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.variable_reward_cadence_policy_ready(jsonb,jsonb,jsonb)
  to service_role;

do $$
declare
  v_pulse jsonb := '{}'::jsonb;
  v_economy jsonb := '{}'::jsonb;
  v_policy jsonb := '{}'::jsonb;
  v_interval integer := 60;
  v_windows integer := 24;
  v_max_band integer := 0;
  v_band jsonb;
  v_required_ceiling bigint := 0;
begin
  select coalesce(value,'{}'::jsonb)
  into v_pulse
  from public.app_config
  where key='hourly_pulse';

  select coalesce(value,'{}'::jsonb)
  into v_economy
  from public.app_config
  where key='pulse_economy_v13';

  select coalesce(value,'{}'::jsonb)
  into v_policy
  from public.app_config
  where key='faucet_continuous_launch_policy';

  if not public.variable_reward_model_valid(v_economy) then
    raise exception 'variable reward cadence policy requires a valid reward model';
  end if;

  v_interval := greatest(15,least(coalesce((v_pulse->>'interval_minutes')::integer,60),1440));
  v_windows := floor(1440::numeric / v_interval::numeric)::integer;

  for v_band in
    select value
    from jsonb_array_elements(v_economy->'reward_bands')
  loop
    v_max_band := greatest(v_max_band,coalesce((v_band->>'credits')::integer,0));
  end loop;

  v_required_ceiling := v_windows::bigint * v_max_band::bigint;

  if v_windows <> 24 or v_max_band <= 0 or v_required_ceiling <> 1200 then
    raise exception 'unexpected variable faucet cadence ceiling: % windows / max % / ceiling %',
      v_windows,v_max_band,v_required_ceiling;
  end if;

  v_policy := jsonb_set(v_policy,'{version}','14'::jsonb,true);
  v_policy := jsonb_set(v_policy,'{interval_minutes}',to_jsonb(v_interval),true);
  v_policy := jsonb_set(v_policy,'{windows_per_day}',to_jsonb(v_windows),true);
  v_policy := jsonb_set(
    v_policy,
    '{base_reward_credits}',
    to_jsonb(greatest(1,coalesce((v_pulse->>'credits')::integer,1))),
    true
  );
  v_policy := jsonb_set(v_policy,'{user_daily_ceiling_credits}',to_jsonb(v_required_ceiling),true);
  v_policy := jsonb_set(v_policy,'{quota_mode}','"natural_variable_hourly_ceiling"'::jsonb,true);
  v_policy := jsonb_set(v_policy,'{arbitrary_user_quota_enabled}','false'::jsonb,true);
  v_policy := jsonb_set(v_policy,'{pilot_preserved}','true'::jsonb,true);

  update public.app_config
  set value=v_policy,
      version=greatest(version,14),
      reason='Variable faucet cadence authority: every hourly window remains available even when each draw lands on the maximum configured reward band',
      updated_at=now()
  where key='faucet_continuous_launch_policy';

  if not public.variable_reward_cadence_policy_ready(null,null,null) then
    raise exception 'variable reward cadence policy contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'variable reward cadence policy requires canonical release schema v55';
  end if;
end
$$;

create or replace function public.release_variable_reward_cadence_policy_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  public.variable_reward_cadence_policy_ready(null,null,null)
  and not has_function_privilege(
    'anon',
    'public.variable_reward_cadence_policy_ready(jsonb,jsonb,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.variable_reward_cadence_policy_ready(jsonb,jsonb,jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.variable_reward_cadence_policy_ready(jsonb,jsonb,jsonb)',
    'EXECUTE'
  );
$$;

revoke all on function public.release_variable_reward_cadence_policy_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_variable_reward_cadence_policy_contract()
  to service_role;
