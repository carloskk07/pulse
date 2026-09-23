-- V13.12 guarded public-launch switch.
-- Preparing the product and opening it are separate operations. This migration
-- adds one service-only preflight + transition boundary. It does not open PUBLIC.
-- Canonical release schema remains v55/0055.

create or replace function public.public_launch_preflight()
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_pulse jsonb := '{}'::jsonb;
  v_economy jsonb := '{}'::jsonb;
  v_blockers text[] := array[]::text[];
  v_pilot boolean := true;
  v_schema integer := 0;
begin
  select coalesce(value,'{}'::jsonb)
  into v_pulse
  from public.app_config
  where key='hourly_pulse';

  select coalesce(value,'{}'::jsonb)
  into v_economy
  from public.app_config
  where key='pulse_economy_v13';

  select coalesce((value->>'version')::integer,0)
  into v_schema
  from public.app_config
  where key='release_schema';

  v_pilot := lower(coalesce(v_pulse->>'pilot_mode','true'))
    in ('true','1','yes','on');

  if v_schema <> 55 then
    v_blockers := array_append(v_blockers,'schema');
  end if;

  if not public.variable_reward_model_valid(v_economy) then
    v_blockers := array_append(v_blockers,'variable-reward-model');
  end if;

  if not public.variable_reward_public_open_ready(v_pulse,v_economy) then
    v_blockers := array_append(v_blockers,'variable-reward-public-open');
  end if;

  if not public.release_variable_reward_execution_contract() then
    v_blockers := array_append(v_blockers,'variable-reward-execution');
  end if;

  if not public.release_variable_reward_cadence_policy_contract() then
    v_blockers := array_append(v_blockers,'variable-reward-cadence');
  end if;

  if not public.release_referral_network_integrity_contract()
     or not public.release_stacked_incentive_budget_contract()
     or not public.release_network_commission_launch_contract() then
    v_blockers := array_append(v_blockers,'referral-network');
  end if;

  if not public.release_withdrawal_pass_integrity_contract()
     or not public.release_extra_withdrawal_launch_contract()
     or not public.release_withdrawal_recovery_authority_contract()
     or not public.release_withdrawal_retry_backoff_contract() then
    v_blockers := array_append(v_blockers,'withdrawals');
  end if;

  if not public.release_cashback_budget_contract()
     or not public.release_cashback_ingestion_contract()
     or not public.release_cashback_pilot_preparation_contract() then
    v_blockers := array_append(v_blockers,'cashback-engine');
  end if;

  if not public.cashback_public_launch_requirements_ready(v_economy) then
    v_blockers := array_append(v_blockers,'cashback-supply');
  end if;

  if not public.extra_rewards_public_launch_requirements_ready(v_economy) then
    v_blockers := array_append(v_blockers,'extra-rewards-supply');
  end if;

  if not public.release_faucetpay_webhook_reconciliation_contract() then
    v_blockers := array_append(v_blockers,'faucetpay-reconciliation');
  end if;

  return jsonb_build_object(
    'ready', cardinality(v_blockers)=0,
    'pilot_mode', v_pilot,
    'already_public', not v_pilot,
    'blockers', to_jsonb(v_blockers)
  );
end;
$$;

revoke all on function public.public_launch_preflight()
  from public, anon, authenticated, service_role;
grant execute on function public.public_launch_preflight()
  to service_role;

create or replace function public.open_public_launch()
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row public.app_config%rowtype;
  v_preflight jsonb := '{}'::jsonb;
  v_blockers jsonb := '[]'::jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('pulsercuit-public-launch',0));

  select *
  into v_row
  from public.app_config
  where key='hourly_pulse'
  for update;

  if not found then
    return jsonb_build_object('status','config_missing');
  end if;

  if lower(coalesce(v_row.value->>'pilot_mode','true'))
     not in ('true','1','yes','on') then
    return jsonb_build_object('status','already_public');
  end if;

  v_preflight := public.public_launch_preflight();
  v_blockers := coalesce(v_preflight->'blockers','[]'::jsonb);

  if coalesce((v_preflight->>'ready')::boolean,false) is not true then
    return jsonb_build_object(
      'status','blocked',
      'blockers',v_blockers
    );
  end if;

  update public.app_config
  set value=jsonb_set(value,'{pilot_mode}','false'::jsonb,true),
      version=greatest(version,18),
      reason='Public access opened through guarded release switch',
      updated_at=now()
  where key='hourly_pulse';

  if coalesce((
    select lower(value->>'pilot_mode') in ('true','1','yes','on')
    from public.app_config
    where key='hourly_pulse'
  ),true) then
    raise exception 'public_launch_transition_failed';
  end if;

  return jsonb_build_object('status','opened');
end;
$$;

revoke all on function public.open_public_launch()
  from public, anon, authenticated, service_role;
grant execute on function public.open_public_launch()
  to service_role;

create or replace function public.close_public_launch()
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row public.app_config%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('pulsercuit-public-launch',0));

  select *
  into v_row
  from public.app_config
  where key='hourly_pulse'
  for update;

  if not found then
    return jsonb_build_object('status','config_missing');
  end if;

  if lower(coalesce(v_row.value->>'pilot_mode','true'))
     in ('true','1','yes','on') then
    return jsonb_build_object('status','already_pilot');
  end if;

  update public.app_config
  set value=jsonb_set(value,'{pilot_mode}','true'::jsonb,true),
      version=greatest(version,18),
      reason='Public access closed through guarded release switch',
      updated_at=now()
  where key='hourly_pulse';

  return jsonb_build_object('status','closed');
end;
$$;

revoke all on function public.close_public_launch()
  from public, anon, authenticated, service_role;
grant execute on function public.close_public_launch()
  to service_role;

create or replace function public.release_public_launch_switch_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
with open_src as (
  select lower(pg_get_functiondef('public.open_public_launch()'::regprocedure)) as src
),
close_src as (
  select lower(pg_get_functiondef('public.close_public_launch()'::regprocedure)) as src
),
preflight_src as (
  select lower(pg_get_functiondef('public.public_launch_preflight()'::regprocedure)) as src
)
select
  position('public_launch_preflight' in (select src from open_src)) > 0
  and position('pilot_mode' in (select src from open_src)) > 0
  and position('pilot_mode' in (select src from close_src)) > 0
  and position('variable_reward_public_open_ready' in (select src from preflight_src)) > 0
  and position('cashback_public_launch_requirements_ready' in (select src from preflight_src)) > 0
  and position('extra_rewards_public_launch_requirements_ready' in (select src from preflight_src)) > 0
  and has_function_privilege('service_role','public.public_launch_preflight()','EXECUTE')
  and has_function_privilege('service_role','public.open_public_launch()','EXECUTE')
  and has_function_privilege('service_role','public.close_public_launch()','EXECUTE')
  and not has_function_privilege('anon','public.open_public_launch()','EXECUTE')
  and not has_function_privilege('authenticated','public.open_public_launch()','EXECUTE')
  and not has_function_privilege('anon','public.close_public_launch()','EXECUTE')
  and not has_function_privilege('authenticated','public.close_public_launch()','EXECUTE');
$$;

revoke all on function public.release_public_launch_switch_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_public_launch_switch_contract()
  to service_role;

do $$
begin
  if not public.release_public_launch_switch_contract() then
    raise exception 'public launch switch contract failed';
  end if;

  if not coalesce((
    select lower(value->>'pilot_mode') in ('true','1','yes','on')
    from public.app_config
    where key='hourly_pulse'
  ),false) then
    raise exception 'public launch switch installation requires pilot isolation';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'public launch switch requires canonical release schema v55';
  end if;
end
$$;
