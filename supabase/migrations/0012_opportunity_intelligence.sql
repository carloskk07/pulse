-- Opportunity Intelligence foundation
-- Adds evidence, health and freshness authority to normalized rewards without changing ledger settlement.

alter table public.reward_opportunities
  add column if not exists source_type text not null default 'partner'
    check (source_type in ('partner','direct','affiliate','research')),
  add column if not exists evidence_tier text not null default 'new'
    check (evidence_tier in ('proven','strong','limited','new','unknown')),
  add column if not exists health_state text not null default 'unknown'
    check (health_state in ('excellent','good','degraded','unknown','hidden')),
  add column if not exists freshness_ttl_minutes integer not null default 1440
    check (freshness_ttl_minutes between 5 and 10080),
  add column if not exists verified_at timestamptz,
  add column if not exists expires_at timestamptz;

create index if not exists reward_opportunities_intelligence_idx
  on public.reward_opportunities(status, health_state, refreshed_at desc);

create index if not exists reward_opportunities_quick_wins_idx
  on public.reward_opportunities(status, estimated_minutes, refreshed_at desc)
  where estimated_minutes is not null;

create or replace function public.release_opportunity_intelligence_contract()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    to_regclass('public.reward_opportunities') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'reward_opportunities' and column_name = 'source_type'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'reward_opportunities' and column_name = 'evidence_tier'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'reward_opportunities' and column_name = 'health_state'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'reward_opportunities' and column_name = 'freshness_ttl_minutes'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'reward_opportunities' and column_name = 'verified_at'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'reward_opportunities' and column_name = 'expires_at'
    )
    and coalesce((select relrowsecurity from pg_class where oid = 'public.reward_opportunities'::regclass), false);
$$;

revoke all on function public.release_opportunity_intelligence_contract() from public, anon, authenticated;
grant execute on function public.release_opportunity_intelligence_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 12, 'migration', '0012_opportunity_intelligence.sql'),
  12,
  'Opportunity evidence, health and freshness authority'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
