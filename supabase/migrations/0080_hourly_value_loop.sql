-- Pulse V13.1: hourly value loop.
-- Makes every real Pulse claim an auditable economic session without changing
-- claim eligibility, reward amount, Treasury funding, payout or public access.

create table if not exists public.pulse_value_sessions (
  pulse_claim_id uuid primary key references public.pulse_claims(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  claim_reward_credits bigint not null check (claim_reward_credits > 0),
  claimed_at timestamptz not null,
  sponsored_served_at timestamptz,
  sponsored_clicked_at timestamptz,
  sponsored_revenue_usd_micros bigint not null default 0 check (sponsored_revenue_usd_micros >= 0),
  direct_started_at timestamptz,
  direct_confirmed_at timestamptz,
  direct_revenue_usd_micros bigint not null default 0 check (direct_revenue_usd_micros >= 0),
  direct_reward_credits bigint not null default 0 check (direct_reward_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pulse_value_sessions_claimed_idx
  on public.pulse_value_sessions(claimed_at desc);

create index if not exists pulse_value_sessions_user_claimed_idx
  on public.pulse_value_sessions(user_id, claimed_at desc);

alter table public.pulse_value_sessions enable row level security;

revoke all on table public.pulse_value_sessions from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.pulse_value_sessions to service_role;

insert into public.pulse_value_sessions(
  pulse_claim_id,user_id,claim_reward_credits,claimed_at,created_at,updated_at
)
select pc.id,pc.user_id,pc.reward_credits,pc.created_at,pc.created_at,now()
from public.pulse_claims pc
on conflict (pulse_claim_id) do nothing;

create or replace function public.sync_pulse_value_session_claim()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  insert into public.pulse_value_sessions(
    pulse_claim_id,user_id,claim_reward_credits,claimed_at,created_at,updated_at
  ) values (
    new.id,new.user_id,new.reward_credits,new.created_at,new.created_at,now()
  )
  on conflict (pulse_claim_id) do nothing;

  return new;
end;
$$;

revoke all on function public.sync_pulse_value_session_claim()
  from public, anon, authenticated, service_role;

drop trigger if exists zz_pulse_value_session_claim
  on public.pulse_claims;
create trigger zz_pulse_value_session_claim
after insert on public.pulse_claims
for each row execute function public.sync_pulse_value_session_claim();

create or replace function public.sync_pulse_value_session_ads()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_claim_id uuid := coalesce(new.pulse_claim_id, old.pulse_claim_id);
begin
  if v_claim_id is null then
    return coalesce(new,old);
  end if;

  update public.pulse_value_sessions pvs
  set sponsored_served_at = (
        select min(e.created_at)
        from public.pulse_ads_events e
        where e.pulse_claim_id=v_claim_id and e.event_type='served'
      ),
      sponsored_clicked_at = (
        select min(e.created_at)
        from public.pulse_ads_events e
        where e.pulse_claim_id=v_claim_id and e.event_type='click'
      ),
      sponsored_revenue_usd_micros = coalesce((
        select sum(greatest(0,e.billable_usd_micros))
        from public.pulse_ads_events e
        where e.pulse_claim_id=v_claim_id and e.event_type='click'
      ),0),
      updated_at=now()
  where pvs.pulse_claim_id=v_claim_id;

  return coalesce(new,old);
end;
$$;

revoke all on function public.sync_pulse_value_session_ads()
  from public, anon, authenticated, service_role;

drop trigger if exists zz_pulse_value_session_ads
  on public.pulse_ads_events;
create trigger zz_pulse_value_session_ads
after insert or update or delete on public.pulse_ads_events
for each row execute function public.sync_pulse_value_session_ads();

alter table public.direct_campaign_sessions
  add column if not exists source_pulse_claim_id uuid
  references public.pulse_claims(id) on delete restrict;

create index if not exists direct_campaign_sessions_source_claim_idx
  on public.direct_campaign_sessions(source_pulse_claim_id, created_at desc)
  where source_pulse_claim_id is not null;

create or replace function public.attach_direct_session_to_pulse_claim(
  p_session_id uuid,
  p_user_id uuid,
  p_pulse_claim_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_session public.direct_campaign_sessions%rowtype;
  v_claim public.pulse_claims%rowtype;
begin
  if p_session_id is null or p_user_id is null or p_pulse_claim_id is null then
    return jsonb_build_object('status','invalid');
  end if;

  select * into v_session
  from public.direct_campaign_sessions
  where id=p_session_id and user_id=p_user_id
  for update;

  if not found then
    return jsonb_build_object('status','unknown_session');
  end if;

  if v_session.status not in ('reserved','confirmed') then
    return jsonb_build_object('status','session_not_attributable');
  end if;

  select * into v_claim
  from public.pulse_claims
  where id=p_pulse_claim_id
    and user_id=p_user_id
    and created_at >= now() - interval '2 hours'
    and created_at <= now() + interval '30 seconds';

  if not found then
    return jsonb_build_object('status','claim_not_attributable');
  end if;

  if v_session.source_pulse_claim_id is not null
     and v_session.source_pulse_claim_id <> p_pulse_claim_id then
    return jsonb_build_object(
      'status','already_attributed',
      'pulse_claim_id',v_session.source_pulse_claim_id
    );
  end if;

  update public.direct_campaign_sessions
  set source_pulse_claim_id=p_pulse_claim_id,
      updated_at=now()
  where id=p_session_id;

  update public.pulse_value_sessions
  set direct_started_at=coalesce(direct_started_at,v_session.created_at),
      direct_confirmed_at=(
        select min(e.occurred_at)
        from public.direct_campaign_events e
        where e.session_id=p_session_id and e.status='confirmed'
      ),
      direct_revenue_usd_micros=coalesce((
        select sum(e.payout_usd_micros)
        from public.direct_campaign_events e
        where e.session_id=p_session_id and e.status='confirmed'
      ),0),
      direct_reward_credits=coalesce((
        select sum(e.reward_credits)
        from public.direct_campaign_events e
        where e.session_id=p_session_id and e.status='confirmed'
      ),0),
      updated_at=now()
  where pulse_claim_id=p_pulse_claim_id;

  return jsonb_build_object(
    'status','attached',
    'session_id',p_session_id,
    'pulse_claim_id',p_pulse_claim_id
  );
end;
$$;

revoke all on function public.attach_direct_session_to_pulse_claim(uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.attach_direct_session_to_pulse_claim(uuid,uuid,uuid)
  to service_role;

create or replace function public.sync_pulse_value_session_direct()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_session_id uuid := coalesce(new.session_id,old.session_id);
  v_claim_id uuid;
begin
  select source_pulse_claim_id
  into v_claim_id
  from public.direct_campaign_sessions
  where id=v_session_id;

  if v_claim_id is null then
    return coalesce(new,old);
  end if;

  update public.pulse_value_sessions pvs
  set direct_started_at=coalesce(
        direct_started_at,
        (select s.created_at from public.direct_campaign_sessions s where s.id=v_session_id)
      ),
      direct_confirmed_at=(
        select min(e.occurred_at)
        from public.direct_campaign_events e
        join public.direct_campaign_sessions s on s.id=e.session_id
        where s.source_pulse_claim_id=v_claim_id
          and e.status='confirmed'
      ),
      direct_revenue_usd_micros=coalesce((
        select sum(e.payout_usd_micros)
        from public.direct_campaign_events e
        join public.direct_campaign_sessions s on s.id=e.session_id
        where s.source_pulse_claim_id=v_claim_id
          and e.status='confirmed'
      ),0),
      direct_reward_credits=coalesce((
        select sum(e.reward_credits)
        from public.direct_campaign_events e
        join public.direct_campaign_sessions s on s.id=e.session_id
        where s.source_pulse_claim_id=v_claim_id
          and e.status='confirmed'
      ),0),
      updated_at=now()
  where pvs.pulse_claim_id=v_claim_id;

  return coalesce(new,old);
end;
$$;

revoke all on function public.sync_pulse_value_session_direct()
  from public, anon, authenticated, service_role;

drop trigger if exists zz_pulse_value_session_direct
  on public.direct_campaign_events;
create trigger zz_pulse_value_session_direct
after insert or update or delete on public.direct_campaign_events
for each row execute function public.sync_pulse_value_session_direct();

create or replace function public.admin_hourly_value_snapshot(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
with scoped as (
  select *
  from public.pulse_value_sessions
  where claimed_at >= p_from and claimed_at < p_to
),
agg as (
  select
    count(*)::bigint as claims,
    coalesce(sum(claim_reward_credits),0)::bigint as claim_reward_credits,
    count(*) filter(where sponsored_served_at is not null)::bigint as sponsored_serves,
    count(*) filter(where sponsored_clicked_at is not null)::bigint as sponsored_clicks,
    coalesce(sum(sponsored_revenue_usd_micros),0)::bigint as sponsored_revenue_usd_micros,
    count(*) filter(where direct_started_at is not null)::bigint as direct_starts,
    count(*) filter(where direct_confirmed_at is not null)::bigint as direct_completions,
    coalesce(sum(direct_revenue_usd_micros),0)::bigint as direct_revenue_usd_micros,
    coalesce(sum(direct_reward_credits),0)::bigint as direct_reward_credits,
    count(*) filter(
      where sponsored_revenue_usd_micros > 0
         or direct_revenue_usd_micros > 0
    )::bigint as monetized_claims
  from scoped
),
calc as (
  select *,
    claim_reward_credits * 1000 as base_pulse_cost_usd_micros,
    direct_reward_credits * 1000 as direct_reward_cost_usd_micros,
    sponsored_revenue_usd_micros
      + direct_revenue_usd_micros
      - (direct_reward_credits * 1000) as pulse_support_usd_micros,
    sponsored_revenue_usd_micros
      + direct_revenue_usd_micros
      - ((claim_reward_credits + direct_reward_credits) * 1000) as gross_contribution_usd_micros
  from agg
)
select jsonb_build_object(
  'status',case when p_from is null or p_to is null or p_from >= p_to then 'invalid_range' else 'ok' end,
  'from',p_from,
  'to',p_to,
  'claims',claims,
  'claim_reward_credits',claim_reward_credits,
  'base_pulse_cost_usd_micros',base_pulse_cost_usd_micros,
  'sponsored_serves',sponsored_serves,
  'sponsored_clicks',sponsored_clicks,
  'sponsored_fill_rate',case when claims>0 then sponsored_serves::numeric/claims else 0 end,
  'sponsored_ctr',case when sponsored_serves>0 then sponsored_clicks::numeric/sponsored_serves else 0 end,
  'sponsored_revenue_usd_micros',sponsored_revenue_usd_micros,
  'direct_starts',direct_starts,
  'direct_completions',direct_completions,
  'direct_revenue_usd_micros',direct_revenue_usd_micros,
  'direct_reward_credits',direct_reward_credits,
  'monetized_claims',monetized_claims,
  'monetized_claim_rate',case when claims>0 then monetized_claims::numeric/claims else 0 end,
  'pulse_support_usd_micros',pulse_support_usd_micros,
  'gross_contribution_usd_micros',gross_contribution_usd_micros,
  'support_per_claim_usd_micros',case when claims>0 then pulse_support_usd_micros::numeric/claims else 0 end,
  'base_cost_per_claim_usd_micros',case when claims>0 then base_pulse_cost_usd_micros::numeric/claims else 0 end,
  'self_sufficiency_ratio',case when base_pulse_cost_usd_micros>0 then pulse_support_usd_micros::numeric/base_pulse_cost_usd_micros else 0 end,
  'unfilled_claims',greatest(0,claims-sponsored_serves),
  'unmonetized_claims',greatest(0,claims-monetized_claims)
)
from calc;
$$;

revoke all on function public.admin_hourly_value_snapshot(timestamptz,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_hourly_value_snapshot(timestamptz,timestamptz)
  to service_role;

create or replace function public.release_hourly_value_loop_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  to_regclass('public.pulse_value_sessions') is not null
  and coalesce((
    select relrowsecurity
    from pg_class where oid='public.pulse_value_sessions'::regclass
  ),false)
  and to_regprocedure('public.attach_direct_session_to_pulse_claim(uuid,uuid,uuid)') is not null
  and has_function_privilege(
    'service_role',
    'public.attach_direct_session_to_pulse_claim(uuid,uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.attach_direct_session_to_pulse_claim(uuid,uuid,uuid)',
    'EXECUTE'
  )
  and to_regprocedure('public.admin_hourly_value_snapshot(timestamptz,timestamptz)') is not null
  and has_function_privilege(
    'service_role',
    'public.admin_hourly_value_snapshot(timestamptz,timestamptz)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.admin_hourly_value_snapshot(timestamptz,timestamptz)',
    'EXECUTE'
  )
  and exists(
    select 1 from pg_trigger
    where tgrelid='public.pulse_claims'::regclass
      and tgname='zz_pulse_value_session_claim'
      and tgenabled <> 'D'
  )
  and exists(
    select 1 from pg_trigger
    where tgrelid='public.pulse_ads_events'::regclass
      and tgname='zz_pulse_value_session_ads'
      and tgenabled <> 'D'
  )
  and exists(
    select 1 from pg_trigger
    where tgrelid='public.direct_campaign_events'::regclass
      and tgname='zz_pulse_value_session_direct'
      and tgenabled <> 'D'
  )
  and coalesce((
    select (value->>'version')::integer=55
    from public.app_config where key='release_schema'
  ),false);
$$;

revoke all on function public.release_hourly_value_loop_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_hourly_value_loop_contract()
  to service_role;

do $$
begin
  if not public.release_hourly_value_loop_contract() then
    raise exception 'hourly value loop contract failed';
  end if;
end
$$;
