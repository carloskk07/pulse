-- V13.11 cashback pilot preparation.
-- The cashback engine is enabled during pilot so real offers can be tested end-to-end
-- before public launch. Public opening still requires a fresh real affiliate offer
-- through the existing cashback public-launch guard.
-- Canonical release schema remains v55/0055.

do $$
begin
  if not coalesce((
    select lower(value->>'pilot_mode') in ('true','1','yes','on')
    from public.app_config
    where key='hourly_pulse'
  ),false) then
    raise exception 'cashback pilot preparation requires pilot isolation';
  end if;
end
$$;

update public.app_config
set value = jsonb_set(
  value,
  '{cashback_enabled}',
  'true'::jsonb,
  true
),
version = greatest(version,17),
reason = 'Cashback engine prepared during pilot; public launch still requires real fresh affiliate inventory',
updated_at = now()
where key='pulse_economy_v13';

create or replace function public.release_cashback_pilot_preparation_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
with state as (
  select
    coalesce((
      select lower(value->>'pilot_mode') in ('true','1','yes','on')
      from public.app_config
      where key='hourly_pulse'
    ),true) as pilot_mode,
    coalesce((
      select lower(value->>'cashback_enabled') in ('true','1','yes','on')
      from public.app_config
      where key='pulse_economy_v13'
    ),false) as cashback_enabled,
    coalesce((
      select (value->>'cashback_user_share_bps')::integer
      from public.app_config
      where key='pulse_economy_v13'
    ),0) as cashback_user_share_bps
)
select
  state.pilot_mode
  and state.cashback_enabled
  and state.cashback_user_share_bps = 7500
  and public.release_cashback_budget_contract()
  and public.release_cashback_ingestion_contract()
  and public.release_cashback_public_launch_contract()
from state;
$$;

revoke all on function public.release_cashback_pilot_preparation_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_cashback_pilot_preparation_contract()
  to service_role;

do $$
begin
  if not public.release_cashback_pilot_preparation_contract() then
    raise exception 'cashback pilot preparation contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'cashback pilot preparation requires canonical release schema v55';
  end if;
end
$$;
