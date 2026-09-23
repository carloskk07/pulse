-- V13.10 cashback partner intake.
-- Extends the existing private Business intake so merchants can request
-- direct cashback integration without creating any public offer automatically.
-- Canonical release schema remains v55/0055.

alter table public.business_leads
  drop constraint if exists business_leads_objective_check;

alter table public.business_leads
  add constraint business_leads_objective_check
  check (objective in (
    'website_traffic','app_install','registration','trial',
    'purchase','cashback','survey','custom'
  ));

alter table public.business_leads
  drop constraint if exists business_leads_product_interest_check;

alter table public.business_leads
  add constraint business_leads_product_interest_check
  check (product_interest in (
    'pulse_ads','pulse_direct','cashback_partner','not_sure'
  ));

create or replace function public.release_cashback_partner_intake_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  coalesce((
    select pg_get_constraintdef(c.oid) ilike '%cashback%'
    from pg_constraint c
    where c.conrelid='public.business_leads'::regclass
      and c.conname='business_leads_objective_check'
  ),false)
  and coalesce((
    select pg_get_constraintdef(c.oid) ilike '%cashback_partner%'
    from pg_constraint c
    where c.conrelid='public.business_leads'::regclass
      and c.conname='business_leads_product_interest_check'
  ),false)
  and public.release_advertiser_demand_intake_contract()
  and public.release_cashback_ingestion_contract()
  and not has_table_privilege('anon','public.business_leads','SELECT')
  and not has_table_privilege('authenticated','public.business_leads','SELECT')
  and has_table_privilege('service_role','public.business_leads','INSERT');
$$;

revoke all on function public.release_cashback_partner_intake_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_cashback_partner_intake_contract()
  to service_role;

do $$
begin
  if not public.release_cashback_partner_intake_contract() then
    raise exception 'cashback partner intake contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'cashback partner intake requires canonical release schema v55';
  end if;
end
$$;
