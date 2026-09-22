-- V13.6 align the variable reward readiness contract with pilot execution.
-- The resolver now delegates public-mode authority to
-- variable_reward_public_open_ready rather than the older budget-only check.
-- Canonical release schema remains v55/0055.

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
),
sources as (
  select
    lower(pg_get_functiondef('public.enforce_variable_reward_activation_guard()'::regprocedure)) as guard_src,
    lower(pg_get_functiondef('public.resolve_hourly_pulse_reward(integer)'::regprocedure)) as resolver_src
)
select
  exists (
    select 1
    from pg_trigger
    where tgrelid='public.app_config'::regclass
      and tgname='variable_reward_activation_guard'
      and tgenabled <> 'D'
  )
  and position('variable_reward_public_open_ready' in (select guard_src from sources)) > 0
  and position('variable_reward_public_open_ready' in (select resolver_src from sources)) > 0
  and position('variable_reward_model_valid' in (select resolver_src from sources)) > 0
  and not has_function_privilege(
    'anon','public.variable_reward_public_open_ready(jsonb,jsonb)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.variable_reward_public_open_ready(jsonb,jsonb)','EXECUTE'
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
begin
  if not public.release_variable_reward_budget_contract() then
    raise exception 'aligned variable reward readiness contract failed';
  end if;

  if not public.release_variable_reward_execution_contract() then
    raise exception 'variable reward execution contract failed after readiness alignment';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'variable reward readiness alignment requires canonical release schema v55';
  end if;
end
$$;
