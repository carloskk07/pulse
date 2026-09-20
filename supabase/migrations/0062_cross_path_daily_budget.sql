-- Correctness + scale hardening: unify daily budget authority across claims and reservations.
-- Compatible with release schema v55 / 0055. No reward amount, Treasury funding,
-- payout, RLS or release-authority changes are made.
--
-- Before this migration reserve_treasury_boost() enforced the daily budget using
-- treasury_reservations only, while claim_hourly_pulse() correctly enforced the
-- same budget across pulse_claims + treasury_reservations. That allowed a boost
-- reservation to push combined daily usage above the shared Treasury budget.
--
-- The private snapshot below is read-only and uses the existing covering indexes
-- to scan each source once, returning both global and per-user usage in one pass.

create or replace function private.treasury_daily_usage_snapshot(
  p_treasury_id uuid,
  p_user_id uuid,
  p_day_start timestamptz
)
returns table(
  total_credits bigint,
  user_credits bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    coalesce(sum(u.credits), 0)::bigint as total_credits,
    coalesce(
      sum(u.credits) filter (where u.user_id = p_user_id),
      0
    )::bigint as user_credits
  from (
    select
      pc.reward_credits::bigint as credits,
      pc.user_id
    from public.pulse_claims pc
    where pc.treasury_id = p_treasury_id
      and pc.created_at >= p_day_start

    union all

    select
      tr.amount_credits::bigint as credits,
      tr.user_id
    from public.treasury_reservations tr
    where tr.treasury_id = p_treasury_id
      and tr.created_at >= p_day_start
      and tr.status in ('reserved', 'consumed')
  ) u;
$$;

revoke all on function private.treasury_daily_usage_snapshot(uuid,uuid,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function private.treasury_daily_usage_snapshot(uuid,uuid,timestamptz)
  to service_role;

create or replace function public.reserve_treasury_boost(
  p_treasury_code text,
  p_user_id uuid,
  p_opportunity_key text,
  p_amount_credits bigint,
  p_idempotency_key text,
  p_ttl_minutes integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_treasury public.reward_treasuries%rowtype;
  v_treasury_id uuid;
  v_existing public.treasury_reservations%rowtype;
  v_daily_total bigint := 0;
  v_user_daily_total bigint := 0;
  v_available bigint := 0;
  v_reservation_id uuid;
  v_today_start timestamptz :=
    date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  if p_user_id is null
     or coalesce(trim(p_opportunity_key), '') = ''
     or coalesce(trim(p_idempotency_key), '') = ''
     or p_amount_credits is null
     or p_amount_credits <= 0 then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select * into v_existing
  from public.treasury_reservations
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.status = 'reserved'
       and v_existing.expires_at <= now() then
      perform public.release_expired_treasury_reservations(
        v_existing.treasury_id
      );

      select * into v_existing
      from public.treasury_reservations
      where id = v_existing.id;
    end if;

    return jsonb_build_object(
      'status', 'idempotent',
      'reservation_id', v_existing.id,
      'reservation_status', v_existing.status,
      'amount_credits', v_existing.amount_credits
    );
  end if;

  select id into v_treasury_id
  from public.reward_treasuries
  where code = p_treasury_code;

  if not found then
    return jsonb_build_object('status', 'unknown_treasury');
  end if;

  perform public.release_expired_treasury_reservations(v_treasury_id);

  -- Keep the pre-existing global serialization authority. The shared daily
  -- snapshot is read only after this lock, so claims and reservations cannot
  -- independently admit usage against the same budget.
  select * into v_treasury
  from public.reward_treasuries
  where id = v_treasury_id
  for update;

  if not found then
    return jsonb_build_object('status', 'unknown_treasury');
  end if;

  if not v_treasury.enabled or v_treasury.kill_switch then
    return jsonb_build_object('status', 'treasury_closed');
  end if;

  if v_treasury.daily_budget_credits <= 0
     or v_treasury.max_user_daily_credits <= 0 then
    return jsonb_build_object('status', 'budget_disabled');
  end if;

  v_available :=
    v_treasury.funded_credits
    - v_treasury.reserved_credits
    - v_treasury.spent_credits;

  if p_amount_credits > v_available then
    return jsonb_build_object('status', 'insufficient_treasury');
  end if;

  select total_credits, user_credits
  into v_daily_total, v_user_daily_total
  from private.treasury_daily_usage_snapshot(
    v_treasury.id,
    p_user_id,
    v_today_start
  );

  if v_daily_total + p_amount_credits
       > v_treasury.daily_budget_credits then
    return jsonb_build_object('status', 'daily_budget_exhausted');
  end if;

  if v_user_daily_total + p_amount_credits
       > v_treasury.max_user_daily_credits then
    return jsonb_build_object('status', 'user_daily_limit');
  end if;

  insert into public.treasury_reservations (
    treasury_id,
    user_id,
    opportunity_key,
    amount_credits,
    idempotency_key,
    expires_at
  ) values (
    v_treasury.id,
    p_user_id,
    p_opportunity_key,
    p_amount_credits,
    p_idempotency_key,
    now() + make_interval(
      mins => greatest(
        1,
        least(coalesce(p_ttl_minutes, 60), 1440)
      )
    )
  )
  returning id into v_reservation_id;

  update public.reward_treasuries
  set reserved_credits = reserved_credits + p_amount_credits,
      updated_at = now()
  where id = v_treasury.id;

  return jsonb_build_object(
    'status', 'reserved',
    'reservation_id', v_reservation_id,
    'amount_credits', p_amount_credits
  );
end;
$$;

revoke all on function public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)
  to service_role;

do $$
declare
  v_schema jsonb;
  v_snapshot_def text;
  v_reserve_def text;
begin
  select value
  into v_schema
  from public.app_config
  where key = 'release_schema';

  if coalesce((v_schema->>'version')::integer, 0) <> 55
     or coalesce(v_schema->>'migration', '')
          <> '0055_invite_snapshot_compaction.sql' then
    raise exception 'cross-path daily budget fix requires v55 authority';
  end if;

  select lower(pg_get_functiondef(
    'private.treasury_daily_usage_snapshot(uuid,uuid,timestamptz)'::regprocedure
  ))
  into v_snapshot_def;

  select lower(pg_get_functiondef(
    'public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)'::regprocedure
  ))
  into v_reserve_def;

  if position('from public.pulse_claims' in v_snapshot_def) = 0
     or position('from public.treasury_reservations' in v_snapshot_def) = 0
     or position('union all' in v_snapshot_def) = 0
     or position('status in (''reserved'', ''consumed'')' in v_snapshot_def) = 0
     or position('filter (where u.user_id = p_user_id)' in v_snapshot_def) = 0 then
    raise exception 'daily usage snapshot lost cross-path authority';
  end if;

  if position('private.treasury_daily_usage_snapshot' in v_reserve_def) = 0
     or position('for update' in v_reserve_def) = 0
     or position('daily_budget_exhausted' in v_reserve_def) = 0
     or position('user_daily_limit' in v_reserve_def) = 0
     or position('sum(amount_credits)' in v_reserve_def) > 0 then
    raise exception 'reserve_treasury_boost daily-budget contract changed';
  end if;

  if (
    select p.prosecdef
    from pg_catalog.pg_proc p
    where p.oid =
      'private.treasury_daily_usage_snapshot(uuid,uuid,timestamptz)'::regprocedure
  ) then
    raise exception 'daily usage snapshot must remain SECURITY INVOKER';
  end if;

  if not (
    select p.prosecdef
    from pg_catalog.pg_proc p
    where p.oid =
      'public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)'::regprocedure
  ) then
    raise exception 'reserve_treasury_boost must remain SECURITY DEFINER';
  end if;

  if not has_function_privilege(
       'service_role',
       'private.treasury_daily_usage_snapshot(uuid,uuid,timestamptz)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'private.treasury_daily_usage_snapshot(uuid,uuid,timestamptz)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'private.treasury_daily_usage_snapshot(uuid,uuid,timestamptz)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.reserve_treasury_boost(text,uuid,text,bigint,text,integer)',
       'EXECUTE'
     ) then
    raise exception 'cross-path daily budget execution scope changed';
  end if;

  if exists (
    select 1
    from public.reward_treasuries t
    cross join public.profiles p
    cross join lateral private.treasury_daily_usage_snapshot(
      t.id,
      p.id,
      date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    ) s
    where s.total_credits <> (
      (
        select coalesce(sum(pc.reward_credits), 0)::bigint
        from public.pulse_claims pc
        where pc.treasury_id = t.id
          and pc.created_at >=
            date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
      )
      +
      (
        select coalesce(sum(tr.amount_credits), 0)::bigint
        from public.treasury_reservations tr
        where tr.treasury_id = t.id
          and tr.created_at >=
            date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
          and tr.status in ('reserved', 'consumed')
      )
    )
    or s.user_credits <> (
      (
        select coalesce(sum(pc.reward_credits), 0)::bigint
        from public.pulse_claims pc
        where pc.treasury_id = t.id
          and pc.user_id = p.id
          and pc.created_at >=
            date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
      )
      +
      (
        select coalesce(sum(tr.amount_credits), 0)::bigint
        from public.treasury_reservations tr
        where tr.treasury_id = t.id
          and tr.user_id = p.id
          and tr.created_at >=
            date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
          and tr.status in ('reserved', 'consumed')
      )
    )
  ) then
    raise exception 'daily usage snapshot does not match legacy source sums';
  end if;
end
$$;
