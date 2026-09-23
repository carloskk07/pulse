-- V13.8 separate pilot product testing from public backing authority.
-- Pilot claims remain restricted to explicit pilot_user_ids and still obey
-- Treasury availability, daily/user limits, risk controls and kill switch.
-- Public claims continue to require the authoritative FaucetPay backing guard.
-- Canonical release schema remains v55/0055.

create or replace function public.enforce_pulse_claim_backing_guard()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_treasury_code text;
  v_config jsonb := '{}'::jsonb;
  v_pilot_mode boolean := false;
  v_pilot_user boolean := false;
  v_guard jsonb;
  v_status text;
begin
  if coalesce(new.funding_source, '') <> 'pulse' then
    return new;
  end if;

  select code into v_treasury_code
  from public.reward_treasuries
  where id = new.treasury_id;

  if coalesce(v_treasury_code, '') = '' then
    raise exception 'pulse_backing_guard:treasury_missing' using errcode = 'P0001';
  end if;

  select coalesce(value, '{}'::jsonb)
  into v_config
  from public.app_config
  where key = 'hourly_pulse';

  v_pilot_mode := lower(coalesce(v_config->>'pilot_mode', 'false'))
    in ('true','1','yes','on');

  if v_pilot_mode then
    select exists (
      select 1
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(v_config->'pilot_user_ids') = 'array'
            then v_config->'pilot_user_ids'
          else '[]'::jsonb
        end
      ) as pilot(user_id)
      where pilot.user_id = new.user_id::text
    )
    into v_pilot_user;

    -- Only the explicit controlled pilot can exercise the final product flow
    -- before public backing evidence is refreshed. The claim RPC still owns
    -- Treasury availability, daily/user limits, risk and kill-switch checks.
    if v_pilot_user then
      return new;
    end if;
  end if;

  v_guard := public.treasury_backing_guard(v_treasury_code);
  v_status := coalesce(v_guard->>'status', 'backing_refresh_required');

  if v_status <> 'backing_ready' then
    raise exception 'pulse_backing_guard:%', v_status using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_pulse_claim_backing_guard()
  from public, anon, authenticated, service_role;
grant execute on function public.enforce_pulse_claim_backing_guard()
  to service_role;

create or replace function public.release_pilot_backing_separation_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
with src as (
  select lower(pg_get_functiondef(
    'public.enforce_pulse_claim_backing_guard()'::regprocedure
  )) as body
)
select
  public.release_treasury_backing_guard_contract()
  and exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.pulse_claims'::regclass
      and tgname = 'pulse_claim_backing_guard'
      and tgenabled <> 'D'
  )
  and position('pilot_mode' in (select body from src)) > 0
  and position('pilot_user_ids' in (select body from src)) > 0
  and position('new.user_id::text' in (select body from src)) > 0
  and position('if v_pilot_user then' in (select body from src)) > 0
  and position('treasury_backing_guard' in (select body from src)) > 0
  and position('v_status <> ''backing_ready''' in (select body from src)) > 0
  and has_function_privilege(
    'service_role',
    'public.enforce_pulse_claim_backing_guard()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.enforce_pulse_claim_backing_guard()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.enforce_pulse_claim_backing_guard()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.release_pilot_backing_separation_contract()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.release_pilot_backing_separation_contract()',
    'EXECUTE'
  );
$$;

revoke all on function public.release_pilot_backing_separation_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_pilot_backing_separation_contract()
  to service_role;

do $$
begin
  if not public.release_pilot_backing_separation_contract() then
    raise exception 'pilot backing separation contract failed';
  end if;

  if not coalesce((
    select lower(value->>'pilot_mode') in ('true','1','yes','on')
    from public.app_config
    where key='hourly_pulse'
  ),false) then
    raise exception 'pilot backing separation requires current pilot isolation';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'pilot backing separation requires canonical release schema v55';
  end if;
end
$$;
