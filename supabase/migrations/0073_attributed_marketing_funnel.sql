-- Attribute acquisition to real product activation and measure CTA intent.
-- No reward, Treasury, claim, payout, risk, or eligibility authority changes.

alter table public.marketing_funnel_events
  add column if not exists event_label text,
  add column if not exists user_id uuid;

alter table public.marketing_funnel_events
  drop constraint if exists marketing_funnel_events_event_type_check;

alter table public.marketing_funnel_events
  add constraint marketing_funnel_events_event_type_check
  check (event_type = any (array[
    'home_view'::text,
    'proof_view'::text,
    'signup_view'::text,
    'signup_created'::text,
    'cta_click'::text
  ]));

alter table public.marketing_funnel_events
  add constraint marketing_funnel_events_event_label_check
  check (
    (event_type = 'cta_click' and event_label is not null and event_label ~ '^[a-z0-9_]{1,48}$')
    or
    (event_type <> 'cta_click' and event_label is null)
  );

alter table public.marketing_funnel_events
  add constraint marketing_funnel_events_user_attribution_check
  check (
    (event_type = 'signup_created' and user_id is not null)
    or
    (event_type <> 'signup_created' and user_id is null)
  );

alter table public.marketing_funnel_events
  drop constraint if exists marketing_funnel_events_session_event_day_version_key;

drop index if exists public.marketing_funnel_events_dedupe_idx;

create unique index marketing_funnel_events_dedupe_idx
  on public.marketing_funnel_events (
    session_hash,
    event_type,
    event_day,
    experience_version,
    coalesce(event_label, '')
  );

create index if not exists marketing_funnel_events_user_attribution_idx
  on public.marketing_funnel_events (experience_version, user_id)
  where user_id is not null;

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
  where event_type <> 'cta_click'
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
cta_rows as (
  select
    event_label as label,
    count(distinct session_hash)::bigint as clicks
  from events
  where event_type = 'cta_click'
    and event_label is not null
  group by event_label
),
cta_surfaces as (
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object('label', label, 'clicks', clicks)
        order by clicks desc, label
      ),
      '[]'::jsonb
    ) as value,
    coalesce(sum(clicks), 0)::bigint as total_clicks
  from cta_rows
),
attributed_users as (
  select distinct user_id
  from events
  where event_type = 'signup_created'
    and user_id is not null
),
claim_counts as (
  select pc.user_id, count(*)::bigint as claims
  from public.pulse_claims pc
  join attributed_users a on a.user_id = pc.user_id
  group by pc.user_id
),
paid_users as (
  select distinct w.user_id
  from public.withdrawals w
  join attributed_users a on a.user_id = w.user_id
  where w.status = 'paid'
),
activation as (
  select
    count(*)::bigint as new_users,
    count(*) filter (where coalesce(cc.claims, 0) >= 1)::bigint as first_pulse_users,
    count(*) filter (where coalesce(cc.claims, 0) >= 2)::bigint as repeat_pulse_users,
    count(*) filter (where pu.user_id is not null)::bigint as paid_users
  from attributed_users a
  left join claim_counts cc on cc.user_id = a.user_id
  left join paid_users pu on pu.user_id = a.user_id
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
  'cta_clicks', c.total_clicks,
  'cta_surfaces', c.value,
  'sources', s.value
)
from bounds b
cross join acquisition a
cross join activation x
cross join cta_surfaces c
cross join sources s;
$$;

revoke all on function public.admin_marketing_funnel_snapshot_by_version(integer, text) from public, anon, authenticated;
grant execute on function public.admin_marketing_funnel_snapshot_by_version(integer, text) to service_role;

comment on column public.marketing_funnel_events.event_label is
  'Allowlisted CTA surface label for privacy-minimized conversion intent measurement.';

comment on column public.marketing_funnel_events.user_id is
  'Internal user UUID attached only to successful signup events so acquisition can be joined to authoritative activation outcomes.';

comment on function public.admin_marketing_funnel_snapshot_by_version(integer, text) is
  'Service-role-only acquisition + attributed activation snapshot filtered by public experience version.';
