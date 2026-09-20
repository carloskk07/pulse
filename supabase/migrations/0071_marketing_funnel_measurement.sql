-- First-party acquisition measurement.
-- This migration is intentionally outside the canonical v55 release marker.
-- It does not change reward, Treasury, payout, referral, risk, or eligibility authority.

create table if not exists public.marketing_funnel_events (
  id uuid primary key default gen_random_uuid(),
  session_hash text not null,
  event_type text not null,
  event_day date not null default ((now() at time zone 'utc')::date),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now(),
  constraint marketing_funnel_events_session_hash_check
    check (session_hash ~ '^[0-9a-f]{64}$'),
  constraint marketing_funnel_events_event_type_check
    check (event_type = any (array[
      'home_view'::text,
      'proof_view'::text,
      'signup_view'::text,
      'signup_created'::text
    ])),
  constraint marketing_funnel_events_utm_source_check
    check (utm_source is null or char_length(utm_source) <= 120),
  constraint marketing_funnel_events_utm_medium_check
    check (utm_medium is null or char_length(utm_medium) <= 120),
  constraint marketing_funnel_events_utm_campaign_check
    check (utm_campaign is null or char_length(utm_campaign) <= 160),
  constraint marketing_funnel_events_session_event_day_key
    unique (session_hash, event_type, event_day)
);

create index if not exists marketing_funnel_events_day_type_idx
  on public.marketing_funnel_events (event_day desc, event_type);

create index if not exists marketing_funnel_events_session_created_idx
  on public.marketing_funnel_events (session_hash, created_at);

alter table public.marketing_funnel_events enable row level security;

revoke all on table public.marketing_funnel_events from public, anon, authenticated;
grant select, insert on table public.marketing_funnel_events to service_role;

create or replace function public.admin_marketing_funnel_snapshot(p_days integer default 30)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
with params as (
  select greatest(1, least(90, coalesce(p_days, 30)))::integer as days
),
bounds as (
  select
    days,
    ((now() at time zone 'utc')::date - (days - 1))::date as from_day
  from params
),
events as (
  select e.*
  from public.marketing_funnel_events e
  cross join bounds b
  where e.event_day >= b.from_day
),
acquisition as (
  select
    count(distinct session_hash) filter (where event_type = 'home_view') as home_sessions,
    count(distinct session_hash) filter (where event_type = 'proof_view') as proof_sessions,
    count(distinct session_hash) filter (where event_type = 'signup_view') as signup_sessions,
    count(distinct session_hash) filter (where event_type = 'signup_created') as signup_created_sessions,
    min(created_at) as tracking_started_at
  from events
),
first_touch as (
  select distinct on (session_hash)
    session_hash,
    coalesce(nullif(utm_source, ''), 'direct') as source
  from events
  order by session_hash, created_at asc
),
session_state as (
  select
    session_hash,
    bool_or(event_type = 'signup_created') as signup_created
  from events
  group by session_hash
),
source_rows as (
  select
    f.source,
    count(*)::bigint as sessions,
    count(*) filter (where s.signup_created)::bigint as signups
  from first_touch f
  join session_state s using (session_hash)
  group by f.source
  order by sessions desc, f.source
  limit 8
),
sources as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source', source,
        'sessions', sessions,
        'signups', signups
      )
      order by sessions desc, source
    ),
    '[]'::jsonb
  ) as value
  from source_rows
),
cohort as (
  select p.id
  from public.profiles p
  cross join bounds b
  where p.created_at >= (b.from_day::timestamp at time zone 'UTC')
),
claim_counts as (
  select pc.user_id, count(*)::bigint as claims
  from public.pulse_claims pc
  join cohort c on c.id = pc.user_id
  group by pc.user_id
),
paid_users as (
  select distinct w.user_id
  from public.withdrawals w
  join cohort c on c.id = w.user_id
  where w.status = 'paid'
),
activation as (
  select
    count(*)::bigint as new_users,
    count(*) filter (where coalesce(cc.claims, 0) >= 1)::bigint as first_pulse_users,
    count(*) filter (where coalesce(cc.claims, 0) >= 2)::bigint as repeat_pulse_users,
    count(*) filter (where pu.user_id is not null)::bigint as paid_users
  from cohort c
  left join claim_counts cc on cc.user_id = c.id
  left join paid_users pu on pu.user_id = c.id
)
select jsonb_build_object(
  'status', 'ok',
  'days', b.days,
  'from_day', b.from_day,
  'tracking_started_at', a.tracking_started_at,
  'home_sessions', coalesce(a.home_sessions, 0),
  'proof_sessions', coalesce(a.proof_sessions, 0),
  'signup_sessions', coalesce(a.signup_sessions, 0),
  'signup_created_sessions', coalesce(a.signup_created_sessions, 0),
  'new_users', coalesce(x.new_users, 0),
  'first_pulse_users', coalesce(x.first_pulse_users, 0),
  'repeat_pulse_users', coalesce(x.repeat_pulse_users, 0),
  'paid_users', coalesce(x.paid_users, 0),
  'sources', s.value
)
from bounds b
cross join acquisition a
cross join activation x
cross join sources s;
$$;

revoke all on function public.admin_marketing_funnel_snapshot(integer) from public, anon, authenticated;
grant execute on function public.admin_marketing_funnel_snapshot(integer) to service_role;

comment on table public.marketing_funnel_events is
  'Privacy-minimized first-party acquisition events. Stores only a SHA-256 hash of a random browser session plus sanitized UTM fields; no IP, user-agent, email, balance, payout destination, or fingerprint.';

comment on function public.admin_marketing_funnel_snapshot(integer) is
  'Service-role-only aggregate acquisition + activation snapshot. Activation is derived from authoritative profiles, pulse_claims, and paid withdrawals.';
