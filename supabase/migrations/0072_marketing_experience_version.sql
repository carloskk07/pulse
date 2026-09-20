-- Version acquisition telemetry so design iterations can be compared without
-- mixing distinct public experiences. Does not change financial authority.

alter table public.marketing_funnel_events
  add column if not exists experience_version text not null default 'conversion-v10';

alter table public.marketing_funnel_events
  drop constraint if exists marketing_funnel_events_experience_version_check;

alter table public.marketing_funnel_events
  add constraint marketing_funnel_events_experience_version_check
  check (char_length(experience_version) between 1 and 40);

alter table public.marketing_funnel_events
  drop constraint if exists marketing_funnel_events_session_event_day_key;

alter table public.marketing_funnel_events
  add constraint marketing_funnel_events_session_event_day_version_key
  unique (session_hash, event_type, event_day, experience_version);

create index if not exists marketing_funnel_events_version_day_type_idx
  on public.marketing_funnel_events (experience_version, event_day desc, event_type);

create or replace function public.admin_marketing_funnel_snapshot_by_version(
  p_days integer default 30,
  p_experience_version text default 'superior-v11'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
with params as (
  select
    greatest(1, least(90, coalesce(p_days, 30)))::integer as days,
    left(coalesce(nullif(trim(p_experience_version), ''), 'superior-v11'), 40) as experience_version
),
bounds as (
  select
    days,
    experience_version,
    ((now() at time zone 'utc')::date - (days - 1))::date as from_day
  from params
),
events as (
  select e.*
  from public.marketing_funnel_events e
  cross join bounds b
  where e.event_day >= b.from_day
    and e.experience_version = b.experience_version
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
  'experience_version', b.experience_version,
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

revoke all on function public.admin_marketing_funnel_snapshot_by_version(integer, text) from public, anon, authenticated;
grant execute on function public.admin_marketing_funnel_snapshot_by_version(integer, text) to service_role;

comment on column public.marketing_funnel_events.experience_version is
  'Public conversion experience label used to compare design/copy iterations without storing additional identity data.';

comment on function public.admin_marketing_funnel_snapshot_by_version(integer, text) is
  'Service-role-only acquisition snapshot filtered by public experience version. Product activation remains derived from authoritative product tables.';
