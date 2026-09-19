-- Performance-only migration: reduce authenticated reward snapshot CPU work.
-- This is backward-compatible and intentionally does not advance release_schema v55:
-- function signature, returned fields, grants, RLS behavior and release contract remain unchanged.

create or replace function public.current_user_reward_snapshot()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
with
current_identity as (
  select auth.uid() as user_id
),
recent_claims as (
  select c.created_at
  from public.pulse_claims c, current_identity i
  where c.user_id = i.user_id
  order by c.created_at desc
  limit 200
),
claim_days as (
  select distinct (created_at at time zone 'UTC')::date as claim_day
  from recent_claims
),
anchor_day as (
  select case
    when exists (
      select 1
      from claim_days
      where claim_day = (now() at time zone 'UTC')::date
    )
      then (now() at time zone 'UTC')::date
    else (now() at time zone 'UTC')::date - 1
  end as day
),
ranked_days as (
  select
    d.claim_day,
    a.day,
    row_number() over (order by d.claim_day desc) - 1 as offset_day
  from claim_days d
  cross join anchor_day a
  where d.claim_day <= a.day
),
streak as (
  select coalesce(count(*) filter (
    where claim_day = day - (offset_day::integer)
  ), 0)::integer as days
  from ranked_days
)
select jsonb_build_object(
  'user_id', i.user_id,
  'available_credits', coalesce(b.available_credits, 0),
  'pending_credits', coalesce(b.pending_credits, 0),
  'handle', p.handle,
  'trust_level', coalesce(p.trust_level, 0),
  'last_claim_at', (select max(created_at) from recent_claims),
  'hourly_claim_count', (select count(*)::integer from recent_claims),
  'streak_days', (select days from streak)
)
from current_identity i
left join public.user_balances b on b.user_id = i.user_id
left join public.profiles p on p.id = i.user_id
where i.user_id is not null;
$$;

revoke all on function public.current_user_reward_snapshot()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_reward_snapshot()
  to authenticated;

do $$
begin
  if public.release_reward_snapshot_contract() is not true then
    raise exception 'reward snapshot efficiency migration violated the v55 access contract';
  end if;

  if (
    select pg_get_functiondef('public.current_user_reward_snapshot()'::regprocedure)
  ) like '%generate_series%' then
    raise exception 'reward snapshot efficiency migration still contains fixed 366-day scan';
  end if;
end
$$;
