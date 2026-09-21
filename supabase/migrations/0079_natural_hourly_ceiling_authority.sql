-- V13 cadence-first authority.
-- Replace the legacy 2 P/day per-account micro-launch quota with the natural
-- ceiling implied by a 60-minute cadence and the currently active fixed 1 P
-- reward. Public access remains closed: this migration refuses to run unless
-- pilot_mode is still true. It does not change funding, daily budget, spent,
-- reserved, reward amount, payout pack or pilot allowlist.

do $$
declare
  v_pulse jsonb := '{}'::jsonb;
  v_economy jsonb := '{}'::jsonb;
  v_before record;
  v_after record;
  v_interval integer;
  v_reward integer;
  v_windows integer;
  v_ceiling bigint;
  v_pilot boolean;
  v_variable boolean;
begin
  select coalesce(value,'{}'::jsonb)
  into v_pulse
  from public.app_config
  where key='hourly_pulse';

  select coalesce(value,'{}'::jsonb)
  into v_economy
  from public.app_config
  where key='pulse_economy_v13';

  v_interval := greatest(15,least(coalesce((v_pulse->>'interval_minutes')::integer,60),1440));
  v_reward := greatest(1,least(coalesce((v_pulse->>'credits')::integer,1),1000000));
  v_pilot := lower(coalesce(v_pulse->>'pilot_mode','false')) in ('true','1','yes','on');
  v_variable := lower(coalesce(v_economy->>'variable_reward_enabled','false')) in ('true','1','yes','on');

  if not v_pilot then
    raise exception 'natural hourly ceiling requires pilot_mode=true';
  end if;

  if v_interval <> 60 or v_reward <> 1 then
    raise exception 'natural hourly ceiling expected 60-minute cadence and fixed 1 P reward, got % min / % P',
      v_interval,v_reward;
  end if;

  if v_variable then
    raise exception 'natural hourly ceiling cannot be changed while variable rewards are enabled';
  end if;

  v_windows := floor(1440::numeric / v_interval::numeric)::integer;
  v_ceiling := v_windows::bigint * v_reward::bigint;

  if v_windows <> 24 or v_ceiling <> 24 then
    raise exception 'unexpected natural hourly ceiling: % windows / % P',v_windows,v_ceiling;
  end if;

  select
    funded_credits,
    spent_credits,
    reserved_credits,
    daily_budget_credits,
    max_user_daily_credits,
    enabled,
    kill_switch
  into v_before
  from public.reward_treasuries
  where code='launch'
  for update;

  if not found then
    raise exception 'launch Treasury missing';
  end if;

  update public.reward_treasuries
  set max_user_daily_credits=v_ceiling,
      updated_at=now()
  where code='launch';

  select
    funded_credits,
    spent_credits,
    reserved_credits,
    daily_budget_credits,
    max_user_daily_credits,
    enabled,
    kill_switch
  into v_after
  from public.reward_treasuries
  where code='launch';

  if v_after.max_user_daily_credits <> v_ceiling then
    raise exception 'natural hourly ceiling update failed';
  end if;

  if v_after.funded_credits is distinct from v_before.funded_credits
     or v_after.spent_credits is distinct from v_before.spent_credits
     or v_after.reserved_credits is distinct from v_before.reserved_credits
     or v_after.daily_budget_credits is distinct from v_before.daily_budget_credits
     or v_after.enabled is distinct from v_before.enabled
     or v_after.kill_switch is distinct from v_before.kill_switch then
    raise exception 'cadence migration changed forbidden Treasury authority';
  end if;

  insert into public.app_config(key,value,version,reason)
  values (
    'faucet_continuous_launch_policy',
    jsonb_build_object(
      'version',13,
      'interval_minutes',v_interval,
      'windows_per_day',v_windows,
      'base_reward_credits',v_reward,
      'user_daily_ceiling_credits',v_ceiling,
      'quota_mode','natural_hourly_ceiling',
      'arbitrary_user_quota_enabled',false,
      'pilot_preserved',true
    ),
    13,
    'Cadence-first faucet authority: one eligible fixed reward per rolling hourly window, no smaller arbitrary account quota'
  )
  on conflict (key) do update
  set value=excluded.value,
      version=excluded.version,
      reason=excluded.reason,
      updated_at=now();

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'natural hourly ceiling requires canonical release schema v55';
  end if;
end
$$;
