-- Advertiser outbound prospect pipeline
-- Company-level public prospecting only; no public client access.

create table if not exists public.advertiser_prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  domain text not null,
  website text not null,
  segment text not null default 'other' check (segment in ('mobile_game','consumer_app','saas','research','other')),
  country text,
  public_contact_email text,
  source_url text not null,
  fit_score smallint not null default 0 check (fit_score between 0 and 100),
  live_product boolean not null default false,
  measurable_event boolean not null default false,
  public_contact boolean not null default false,
  paid_ua_signal boolean not null default false,
  growth_window boolean not null default false,
  suggested_pilot text,
  status text not null default 'new' check (status in ('new','researching','ready','contacted','replied','pilot','rejected','closed')),
  notes text,
  next_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain)
);

create index if not exists advertiser_prospects_status_score_idx
  on public.advertiser_prospects(status, fit_score desc, created_at desc);
create index if not exists advertiser_prospects_next_action_idx
  on public.advertiser_prospects(next_action_at)
  where status not in ('rejected','closed');

alter table public.advertiser_prospects enable row level security;

revoke all on table public.advertiser_prospects from public, anon, authenticated;
grant select, insert, update, delete on table public.advertiser_prospects to service_role;

create or replace function public.release_advertiser_outbound_contract()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    to_regclass('public.advertiser_prospects') is not null
    and coalesce((select relrowsecurity from pg_class where oid = 'public.advertiser_prospects'::regclass), false)
    and not has_table_privilege('anon', 'public.advertiser_prospects', 'SELECT')
    and not has_table_privilege('anon', 'public.advertiser_prospects', 'INSERT')
    and not has_table_privilege('authenticated', 'public.advertiser_prospects', 'SELECT')
    and not has_table_privilege('authenticated', 'public.advertiser_prospects', 'INSERT')
    and has_table_privilege('service_role', 'public.advertiser_prospects', 'SELECT')
    and has_table_privilege('service_role', 'public.advertiser_prospects', 'INSERT')
    and has_table_privilege('service_role', 'public.advertiser_prospects', 'UPDATE');
$$;

revoke all on function public.release_advertiser_outbound_contract() from public, anon, authenticated;
grant execute on function public.release_advertiser_outbound_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 18, 'migration', '0018_advertiser_outbound_pipeline.sql'),
  18,
  'Company-level outbound advertiser prospecting pipeline'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();