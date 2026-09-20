-- Performance-only migration: materialize global Treasury liability totals.
-- Compatible with release schema v55 / 0055. No reward, budget, Treasury funding,
-- payout, RLS or release-authority changes are made.
--
-- treasury_backing_guard previously summed all user balances, active withdrawals,
-- and active reservations on every fresh backing decision. This migration keeps
-- those exact totals transactionally materialized in a private singleton so the
-- guard remains exact while its liability lookup becomes O(1).

create schema private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to service_role;

create table private.treasury_liability_state (
  singleton boolean primary key default true check (singleton),
  user_balance_liability_credits bigint not null default 0
    check (user_balance_liability_credits >= 0),
  active_withdrawal_liability_credits bigint not null default 0
    check (active_withdrawal_liability_credits >= 0),
  active_reservation_liability_credits bigint not null default 0
    check (active_reservation_liability_credits >= 0),
  updated_at timestamptz not null default now()
);

revoke all on table private.treasury_liability_state
  from public, anon, authenticated, service_role;
grant select on table private.treasury_liability_state
  to service_role;

create or replace function private.sync_treasury_liability_from_user_balance_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_old bigint := 0;
  v_new bigint := 0;
begin
  if tg_op <> 'INSERT' then
    v_old := greatest(old.available_credits, 0) + greatest(old.pending_credits, 0);
  end if;

  if tg_op <> 'DELETE' then
    v_new := greatest(new.available_credits, 0) + greatest(new.pending_credits, 0);
  end if;

  update private.treasury_liability_state
  set user_balance_liability_credits =
        user_balance_liability_credits + v_new - v_old,
      updated_at = now()
  where singleton is true;

  if not found then
    raise exception 'treasury_liability_state_missing' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.sync_treasury_liability_from_withdrawals()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_old bigint := 0;
  v_new bigint := 0;
begin
  if tg_op <> 'INSERT'
     and old.status in ('requested', 'held', 'submitted') then
    v_old := old.amount_credits;
  end if;

  if tg_op <> 'DELETE'
     and new.status in ('requested', 'held', 'submitted') then
    v_new := new.amount_credits;
  end if;

  update private.treasury_liability_state
  set active_withdrawal_liability_credits =
        active_withdrawal_liability_credits + v_new - v_old,
      updated_at = now()
  where singleton is true;

  if not found then
    raise exception 'treasury_liability_state_missing' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.sync_treasury_liability_from_reservations()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_old bigint := 0;
  v_new bigint := 0;
begin
  if tg_op <> 'INSERT' and old.status = 'reserved' then
    v_old := old.amount_credits;
  end if;

  if tg_op <> 'DELETE' and new.status = 'reserved' then
    v_new := new.amount_credits;
  end if;

  update private.treasury_liability_state
  set active_reservation_liability_credits =
        active_reservation_liability_credits + v_new - v_old,
      updated_at = now()
  where singleton is true;

  if not found then
    raise exception 'treasury_liability_state_missing' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_treasury_liability_from_user_balance_state()
  from public, anon, authenticated, service_role;
revoke all on function private.sync_treasury_liability_from_withdrawals()
  from public, anon, authenticated, service_role;
revoke all on function private.sync_treasury_liability_from_reservations()
  from public, anon, authenticated, service_role;

-- Freeze all three authoritative sources while taking the exact baseline and
-- attaching their delta triggers. Locks are held until this migration commits.
lock table public.user_balance_state in share row exclusive mode;
lock table public.withdrawals in share row exclusive mode;
lock table public.treasury_reservations in share row exclusive mode;

insert into private.treasury_liability_state(
  singleton,
  user_balance_liability_credits,
  active_withdrawal_liability_credits,
  active_reservation_liability_credits,
  updated_at
)
select
  true,
  (
    select coalesce(
      sum(greatest(available_credits, 0) + greatest(pending_credits, 0)),
      0
    )::bigint
    from public.user_balance_state
  ),
  (
    select coalesce(sum(amount_credits), 0)::bigint
    from public.withdrawals
    where status in ('requested', 'held', 'submitted')
  ),
  (
    select coalesce(sum(amount_credits), 0)::bigint
    from public.treasury_reservations
    where status = 'reserved'
  ),
  now();

create trigger user_balance_treasury_liability_sync
after insert or update or delete on public.user_balance_state
for each row execute function private.sync_treasury_liability_from_user_balance_state();

create trigger withdrawal_treasury_liability_sync
after insert or update or delete on public.withdrawals
for each row execute function private.sync_treasury_liability_from_withdrawals();

create trigger reservation_treasury_liability_sync
after insert or update or delete on public.treasury_reservations
for each row execute function private.sync_treasury_liability_from_reservations();

create or replace function public.treasury_backing_guard(p_treasury_code text)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_treasury public.reward_treasuries%rowtype;
  v_observation public.treasury_backing_observations%rowtype;
  v_read_proof_fingerprint text;
  v_pack_asset text;
  v_pack_credits bigint;
  v_pack_units bigint;
  v_user_balance_liability bigint := 0;
  v_active_withdrawal_liability bigint := 0;
  v_active_reservation_liability bigint := 0;
  v_available bigint := 0;
  v_total_exposure bigint := 0;
  v_required_units bigint := 0;
begin
  if coalesce(trim(p_treasury_code), '') = '' then
    return jsonb_build_object('status', 'backing_refresh_required');
  end if;

  select * into v_treasury
  from public.reward_treasuries
  where code = trim(p_treasury_code);

  if not found then
    return jsonb_build_object('status', 'backing_refresh_required');
  end if;

  select value->'faucetpay_read'->>'fingerprint'
  into v_read_proof_fingerprint
  from public.app_config
  where key = 'release_external_proof';

  if coalesce(trim(v_read_proof_fingerprint), '') = '' then
    return jsonb_build_object('status', 'backing_refresh_required');
  end if;

  select upper(trim(asset)), credits, units
  into v_pack_asset, v_pack_credits, v_pack_units
  from public.faucetpay_payout_pack_authority
  where singleton is true;

  if not found
     or coalesce(trim(v_pack_asset), '') = ''
     or v_pack_credits is null or v_pack_credits <= 0
     or v_pack_units is null or v_pack_units <= 0 then
    return jsonb_build_object('status', 'backing_refresh_required');
  end if;

  select * into v_observation
  from public.treasury_backing_observations
  where treasury_id = v_treasury.id
  order by observed_at desc
  limit 1;

  if not found
     or v_observation.expires_at <= now()
     or v_observation.read_proof_fingerprint <> trim(v_read_proof_fingerprint)
     or upper(trim(v_observation.backing_asset)) <> v_pack_asset
     or v_observation.payout_pack_credits <> v_pack_credits
     or v_observation.payout_pack_units <> v_pack_units then
    return jsonb_build_object('status', 'backing_refresh_required');
  end if;

  select
    user_balance_liability_credits,
    active_withdrawal_liability_credits,
    active_reservation_liability_credits
  into
    v_user_balance_liability,
    v_active_withdrawal_liability,
    v_active_reservation_liability
  from private.treasury_liability_state
  where singleton is true;

  if not found then
    return jsonb_build_object('status', 'backing_refresh_required');
  end if;

  v_available := greatest(
    v_treasury.funded_credits - v_treasury.reserved_credits - v_treasury.spent_credits,
    0
  );

  v_total_exposure :=
    v_user_balance_liability
    + v_active_withdrawal_liability
    + v_active_reservation_liability
    + v_available;

  v_required_units := ceil(
    (v_total_exposure::numeric * v_pack_units::numeric)
    / v_pack_credits::numeric
  )::bigint;

  if not v_observation.sufficient
     or v_observation.observed_balance_units < v_required_units then
    return jsonb_build_object(
      'status', 'backing_insufficient',
      'observation_id', v_observation.id,
      'required_units', v_required_units,
      'expires_at', v_observation.expires_at
    );
  end if;

  return jsonb_build_object(
    'status', 'backing_ready',
    'observation_id', v_observation.id,
    'required_units', v_required_units,
    'expires_at', v_observation.expires_at
  );
end;
$$;

revoke all on function public.treasury_backing_guard(text)
  from public, anon, authenticated, service_role;
grant execute on function public.treasury_backing_guard(text)
  to service_role;

do $$
declare
  v_schema jsonb;
  v_state private.treasury_liability_state%rowtype;
begin
  select value
  into v_schema
  from public.app_config
  where key = 'release_schema';

  if coalesce((v_schema->>'version')::integer, 0) <> 55
     or coalesce(v_schema->>'migration', '') <> '0055_invite_snapshot_compaction.sql' then
    raise exception 'liability materialization requires v55 authority';
  end if;

  select * into v_state
  from private.treasury_liability_state
  where singleton is true;

  if not found then
    raise exception 'liability materialization singleton missing';
  end if;

  if v_state.user_balance_liability_credits <> (
       select coalesce(
         sum(greatest(available_credits, 0) + greatest(pending_credits, 0)),
         0
       )::bigint
       from public.user_balance_state
     )
     or v_state.active_withdrawal_liability_credits <> (
       select coalesce(sum(amount_credits), 0)::bigint
       from public.withdrawals
       where status in ('requested', 'held', 'submitted')
     )
     or v_state.active_reservation_liability_credits <> (
       select coalesce(sum(amount_credits), 0)::bigint
       from public.treasury_reservations
       where status = 'reserved'
     ) then
    raise exception 'liability materialization baseline mismatch';
  end if;

  if not has_schema_privilege('service_role', 'private', 'USAGE')
     or not has_table_privilege(
       'service_role',
       'private.treasury_liability_state',
       'SELECT'
     )
     or has_table_privilege(
       'service_role',
       'private.treasury_liability_state',
       'INSERT'
     )
     or has_table_privilege(
       'service_role',
       'private.treasury_liability_state',
       'UPDATE'
     )
     or has_table_privilege(
       'service_role',
       'private.treasury_liability_state',
       'DELETE'
     )
     or has_table_privilege(
       'anon',
       'private.treasury_liability_state',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'private.treasury_liability_state',
       'SELECT'
     ) then
    raise exception 'liability materialization privilege contract changed';
  end if;

  if (
    select p.prosecdef
    from pg_catalog.pg_proc p
    where p.oid = 'public.treasury_backing_guard(text)'::regprocedure
  ) then
    raise exception 'treasury backing guard must remain SECURITY INVOKER';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.treasury_backing_guard(text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.treasury_backing_guard(text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.treasury_backing_guard(text)',
       'EXECUTE'
     ) then
    raise exception 'treasury backing guard execution scope changed';
  end if;
end
$$;
