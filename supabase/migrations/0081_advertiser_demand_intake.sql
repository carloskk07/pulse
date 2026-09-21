-- Pulse V13.2: advertiser demand intake.
-- Reduce the first-contact barrier without creating campaigns, funding, traffic
-- promises or revenue. All submissions remain private and operator-reviewed.

alter table public.business_leads enable row level security;

alter table public.business_leads
  add column if not exists product_interest text not null default 'pulse_direct',
  add column if not exists next_action_at timestamptz,
  add column if not exists operator_note text;

alter table public.business_leads
  drop constraint if exists business_leads_objective_check;

alter table public.business_leads
  add constraint business_leads_objective_check
  check (objective in (
    'website_traffic','app_install','registration','trial','purchase','survey','custom'
  ));

alter table public.business_leads
  drop constraint if exists business_leads_budget_range_check;

alter table public.business_leads
  add constraint business_leads_budget_range_check
  check (budget_range in (
    'traffic_5_25','traffic_25_100',
    'pilot_100_500','growth_500_2500','scale_2500_10000',
    'enterprise_10000_plus','not_sure'
  ));

alter table public.business_leads
  drop constraint if exists business_leads_product_interest_check;

alter table public.business_leads
  add constraint business_leads_product_interest_check
  check (product_interest in ('pulse_ads','pulse_direct','not_sure'));

alter table public.business_leads
  drop constraint if exists business_leads_operator_note_check;

alter table public.business_leads
  add constraint business_leads_operator_note_check
  check (operator_note is null or char_length(operator_note) <= 2000);

create index if not exists business_leads_source_status_created_idx
  on public.business_leads(source,status,created_at desc);

create index if not exists business_leads_next_action_idx
  on public.business_leads(next_action_at)
  where status not in ('rejected','closed');

create or replace function public.release_advertiser_demand_intake_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  to_regclass('public.business_leads') is not null
  and coalesce((
    select relrowsecurity
    from pg_class
    where oid='public.business_leads'::regclass
  ),false)
  and exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='business_leads'
      and column_name='product_interest'
      and data_type='text'
  )
  and exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='business_leads'
      and column_name='next_action_at'
      and data_type='timestamp with time zone'
  )
  and not has_table_privilege('anon','public.business_leads','SELECT')
  and not has_table_privilege('anon','public.business_leads','INSERT')
  and not has_table_privilege('authenticated','public.business_leads','SELECT')
  and not has_table_privilege('authenticated','public.business_leads','INSERT')
  and has_table_privilege('service_role','public.business_leads','SELECT')
  and has_table_privilege('service_role','public.business_leads','INSERT')
  and coalesce((
    select (value->>'version')::integer=55
    from public.app_config
    where key='release_schema'
  ),false);
$$;

revoke all on function public.release_advertiser_demand_intake_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_advertiser_demand_intake_contract()
  to service_role;

do $$
begin
  if not public.release_advertiser_demand_intake_contract() then
    raise exception 'advertiser demand intake contract failed';
  end if;
end
$$;
