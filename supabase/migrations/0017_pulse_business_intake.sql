-- Pulse for Business intake
-- Public business interest is accepted only through trusted server code after Turnstile verification.

create table if not exists public.business_leads (
  id uuid primary key default gen_random_uuid(),
  company text not null check (char_length(company) between 2 and 120),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  work_email text not null check (char_length(work_email) between 5 and 254),
  website text,
  objective text not null check (objective in ('app_install','registration','trial','purchase','survey','custom')),
  budget_range text not null check (budget_range in ('pilot_100_500','growth_500_2500','scale_2500_10000','enterprise_10000_plus','not_sure')),
  target_countries text not null default '',
  estimated_actions integer check (estimated_actions is null or (estimated_actions > 0 and estimated_actions <= 10000000)),
  message text not null default '' check (char_length(message) <= 3000),
  status text not null default 'new' check (status in ('new','qualified','contacted','pilot','rejected','closed')),
  source text not null default 'business_page',
  dedupe_key text not null unique,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_leads_status_created_idx
  on public.business_leads(status, created_at desc);
create index if not exists business_leads_email_created_idx
  on public.business_leads(lower(work_email), created_at desc);

alter table public.business_leads enable row level security;
revoke all on table public.business_leads from public, anon, authenticated;
grant select, insert, update, delete on table public.business_leads to service_role;

create or replace function public.release_business_intake_contract()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    to_regclass('public.business_leads') is not null
    and coalesce((select relrowsecurity from pg_class where oid = 'public.business_leads'::regclass), false)
    and not has_table_privilege('anon', 'public.business_leads', 'SELECT')
    and not has_table_privilege('authenticated', 'public.business_leads', 'SELECT')
    and not has_table_privilege('anon', 'public.business_leads', 'INSERT')
    and not has_table_privilege('authenticated', 'public.business_leads', 'INSERT')
    and has_table_privilege('service_role', 'public.business_leads', 'SELECT')
    and has_table_privilege('service_role', 'public.business_leads', 'INSERT');
$$;

revoke all on function public.release_business_intake_contract() from public, anon, authenticated;
grant execute on function public.release_business_intake_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 17, 'migration', '0017_pulse_business_intake.sql'),
  17,
  'Protected Pulse for Business advertiser-intake authority'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
