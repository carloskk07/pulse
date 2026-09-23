-- V13.8 referral-network launch policy.
-- Three-level network rewards are funded only from verified residual margin
-- after the member reward and any first-referral acquisition reward.
-- Public access remains controlled separately by the existing pilot/open gates.
-- Canonical release schema remains v55/0055.

update public.app_config
set value = jsonb_set(
  jsonb_set(
    jsonb_set(
      value,
      '{network_commission_enabled}',
      'true'::jsonb,
      true
    ),
    '{network_commission_bps}',
    '{"1":1000,"2":300,"3":100}'::jsonb,
    true
  ),
  '{network_commission_residual_cap_bps}',
  '3000'::jsonb,
  true
),
version = greatest(version,16),
reason = 'Launch policy: verified three-level referral network rewards at 10%, 3%, and 1% of eligible residual margin',
updated_at = now()
where key='pulse_economy_v13';

create or replace function public.release_network_commission_launch_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
with cfg as (
  select coalesce(value,'{}'::jsonb) as value
  from public.app_config
  where key='pulse_economy_v13'
),
src as (
  select lower(pg_get_functiondef('public.apply_network_commission_on_monetization()'::regprocedure)) as fn
)
select
  lower(coalesce((select value from cfg)->>'network_commission_enabled','false')) in ('true','1','yes','on')
  and coalesce(((select value from cfg)->'network_commission_bps'->>'1')::integer,0) = 1000
  and coalesce(((select value from cfg)->'network_commission_bps'->>'2')::integer,0) = 300
  and coalesce(((select value from cfg)->'network_commission_bps'->>'3')::integer,0) = 100
  and coalesce(((select value from cfg)->>'network_commission_residual_cap_bps')::integer,0) = 3000
  and (
    coalesce(((select value from cfg)->'network_commission_bps'->>'1')::integer,0)
    + coalesce(((select value from cfg)->'network_commission_bps'->>'2')::integer,0)
    + coalesce(((select value from cfg)->'network_commission_bps'->>'3')::integer,0)
  ) <= coalesce(((select value from cfg)->>'network_commission_residual_cap_bps')::integer,0)
  and exists (
    select 1
    from pg_trigger
    where tgrelid='public.monetization_events'::regclass
      and tgname='zz_network_commission_after_monetization'
      and tgenabled <> 'D'
  )
  and public.release_referral_network_integrity_contract()
  and public.release_stacked_incentive_budget_contract()
  and position('v_gross_margin - v_referral_cost' in (select fn from src)) > 0
  and position('qualifying_conversion_id' in (select fn from src)) > 0
  and position('network_level' in (select fn from src)) > 0
  and position('chargeback' in (select fn from src)) > 0;
$$;

revoke all on function public.release_network_commission_launch_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_network_commission_launch_contract()
  to service_role;

do $$
begin
  if not public.release_network_commission_launch_contract() then
    raise exception 'network commission launch contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'network commission launch policy requires canonical release schema v55';
  end if;
end
$$;
