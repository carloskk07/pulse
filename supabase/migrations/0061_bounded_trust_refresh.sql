-- Performance-only migration: bound per-claim trust refresh work.
-- Compatible with release schema v55 / 0055. No reward, budget, Treasury funding,
-- payout, RLS or release-authority changes are made.
--
-- Trust thresholds only depend on whether bounded milestones have been reached:
-- 72 claims, 7 active days, 1 confirmed conversion, 2 paid withdrawals, and
-- absence of chargebacks. The previous implementation scanned full user history
-- and rewrote profiles on every claim. This version preserves the exact trust
-- classification while limiting the work and avoiding no-op profile writes.

create or replace function public.refresh_pulse_trust(p_user_id uuid)
returns smallint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_risk smallint := 0;
  v_current_level smallint := 0;
  v_claims bigint := 0;
  v_active_days bigint := 0;
  v_has_conversion boolean := false;
  v_paid_withdrawals bigint := 0;
  v_has_reversal boolean := false;
  v_level smallint := 0;
begin
  select risk_score, trust_level
  into v_risk, v_current_level
  from public.profiles
  where id = p_user_id;

  if not found then
    return 0;
  end if;

  select count(*)
  into v_claims
  from (
    select 1
    from public.pulse_claims
    where user_id = p_user_id
    limit 72
  ) bounded_claims;

  -- Walk at most seven distinct UTC claim days. Each recursive step seeks the
  -- latest claim before the current day's UTC boundary using the existing
  -- (user_id, created_at desc) index instead of counting all historical days.
  with recursive claim_days(claim_day, depth) as (
    (
      select (pc.created_at at time zone 'UTC')::date, 1
      from public.pulse_claims pc
      where pc.user_id = p_user_id
      order by pc.created_at desc
      limit 1
    )
    union all
    select previous_day.claim_day, claim_days.depth + 1
    from claim_days
    cross join lateral (
      select (pc.created_at at time zone 'UTC')::date as claim_day
      from public.pulse_claims pc
      where pc.user_id = p_user_id
        and pc.created_at < (claim_days.claim_day::timestamp at time zone 'UTC')
      order by pc.created_at desc
      limit 1
    ) previous_day
    where claim_days.depth < 7
  )
  select count(*)
  into v_active_days
  from claim_days;

  select exists(
    select 1
    from public.monetization_events
    where user_id = p_user_id
      and event_type = 'conversion'
      and status = 'confirmed'
  )
  into v_has_conversion;

  select count(*)
  into v_paid_withdrawals
  from (
    select 1
    from public.withdrawals
    where user_id = p_user_id
      and status = 'paid'
    limit 2
  ) bounded_paid;

  select exists(
    select 1
    from public.monetization_events
    where user_id = p_user_id
      and event_type = 'chargeback'
  )
  into v_has_reversal;

  if v_risk < 80 and v_claims >= 3 then
    v_level := 1;
  end if;

  if v_risk < 60 and v_claims >= 12 and v_active_days >= 2 then
    v_level := 2;
  end if;

  if v_risk < 60 and v_has_conversion and v_claims >= 12 then
    v_level := 3;
  end if;

  if v_risk < 40
     and v_paid_withdrawals >= 1
     and v_claims >= 24
     and v_active_days >= 3 then
    v_level := 4;
  end if;

  if v_risk < 40
     and v_paid_withdrawals >= 2
     and v_claims >= 72
     and v_active_days >= 7
     and not v_has_reversal then
    v_level := 5;
  end if;

  if v_current_level is distinct from v_level then
    update public.profiles
    set trust_level = v_level,
        updated_at = now()
    where id = p_user_id;
  end if;

  return v_level;
end;
$$;

revoke all on function public.refresh_pulse_trust(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.refresh_pulse_trust(uuid)
  to service_role;

do $$
declare
  v_schema jsonb;
  v_def text;
begin
  select value
  into v_schema
  from public.app_config
  where key = 'release_schema';

  if coalesce((v_schema->>'version')::integer, 0) <> 55
     or coalesce(v_schema->>'migration', '') <> '0055_invite_snapshot_compaction.sql' then
    raise exception 'bounded trust refresh requires v55 authority';
  end if;

  select pg_get_functiondef(
    'public.refresh_pulse_trust(uuid)'::regprocedure
  )
  into v_def;

  if position('limit 72' in lower(v_def)) = 0
     or position('with recursive claim_days' in lower(v_def)) = 0
     or position('claim_days.depth < 7' in lower(v_def)) = 0
     or position('limit 2' in lower(v_def)) = 0
     or position('v_current_level is distinct from v_level' in lower(v_def)) = 0
     or position('count(distinct' in lower(v_def)) > 0 then
    raise exception 'bounded trust refresh contract changed';
  end if;

  if not (
    select p.prosecdef
    from pg_catalog.pg_proc p
    where p.oid = 'public.refresh_pulse_trust(uuid)'::regprocedure
  ) then
    raise exception 'refresh_pulse_trust must remain SECURITY DEFINER';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.refresh_pulse_trust(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.refresh_pulse_trust(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.refresh_pulse_trust(uuid)',
       'EXECUTE'
     ) then
    raise exception 'refresh_pulse_trust execution scope changed';
  end if;
end
$$;
