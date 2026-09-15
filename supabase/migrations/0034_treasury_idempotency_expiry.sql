-- Supabase v34: reconcile an expired reservation before returning an idempotent reserve response.
--
-- v33 made Treasury TTL authoritative for new capacity calculations and finalization.
-- A repeated request using the original idempotency key could still return early
-- before cleanup, leaving an overdue reservation reported as reserved until a
-- different Treasury operation occurred.

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
begin
  if p_user_id is null or coalesce(trim(p_opportunity_key), '') = '' or coalesce(trim(p_idempotency_key), '') = ''
     or p_amount_credits is null or p_amount_credits <= 0 then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select * into v_existing
  from public.treasury_reservations
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.status = 'reserved' and v_existing.expires_at <= now() then
      perform public.release_expired_treasury_reservations(v_existing.treasury_id);
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

  if v_treasury.daily_budget_credits <= 0 or v_treasury.max_user_daily_credits <= 0 then
    return jsonb_build_object('status', 'budget_disabled');
  end if;

  v_available := v_treasury.funded_credits - v_treasury.reserved_credits - v_treasury.spent_credits;
  if p_amount_credits > v_available then
    return jsonb_build_object('status', 'insufficient_treasury');
  end if;

  select coalesce(sum(amount_credits), 0)
  into v_daily_total
  from public.treasury_reservations
  where treasury_id = v_treasury.id
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    and status in ('reserved','consumed');

  if v_daily_total + p_amount_credits > v_treasury.daily_budget_credits then
    return jsonb_build_object('status', 'daily_budget_exhausted');
  end if;

  select coalesce(sum(amount_credits), 0)
  into v_user_daily_total
  from public.treasury_reservations
  where treasury_id = v_treasury.id
    and user_id = p_user_id
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    and status in ('reserved','consumed');

  if v_user_daily_total + p_amount_credits > v_treasury.max_user_daily_credits then
    return jsonb_build_object('status', 'user_daily_limit');
  end if;

  insert into public.treasury_reservations (
    treasury_id, user_id, opportunity_key, amount_credits, idempotency_key, expires_at
  ) values (
    v_treasury.id,
    p_user_id,
    p_opportunity_key,
    p_amount_credits,
    p_idempotency_key,
    now() + make_interval(mins => greatest(1, least(coalesce(p_ttl_minutes, 60), 1440)))
  ) returning id into v_reservation_id;

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

revoke all on function public.reserve_treasury_boost(text,uuid,text,bigint,text,integer) from public, anon, authenticated;
grant execute on function public.reserve_treasury_boost(text,uuid,text,bigint,text,integer) to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 34, 'migration', '0034_treasury_idempotency_expiry.sql'),
  34,
  'Repeated Treasury reservation requests reconcile overdue TTL state before returning an idempotent result'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
