-- V13 withdrawal recovery authority snapshot.
-- Every FaucetPay withdrawal records the payout-pack authority that authorized it.
-- Submitted withdrawals may then be safely retried with their immutable original
-- authority even if the current payout pack later changes.
-- Canonical release schema remains v55/0055.

alter table public.withdrawals
  add column if not exists payout_authority_version integer,
  add column if not exists payout_authority_asset text,
  add column if not exists payout_authority_credits bigint,
  add column if not exists payout_authority_units bigint;

-- Backfill only rows whose economics exactly match the currently proven authority.
update public.withdrawals w
set payout_authority_version = a.authority_version,
    payout_authority_asset = a.asset,
    payout_authority_credits = a.credits,
    payout_authority_units = a.units
from public.faucetpay_payout_pack_authority a
where a.singleton=true
  and lower(w.payout_provider)='faucetpay'
  and upper(w.asset)=upper(a.asset)
  and w.amount_credits=a.credits
  and w.payout_amount_units=a.units
  and w.payout_authority_version is null;

alter table public.withdrawals
  drop constraint if exists withdrawals_payout_authority_snapshot_chk;
alter table public.withdrawals
  add constraint withdrawals_payout_authority_snapshot_chk
  check (
    payout_authority_version is null
    or (
      payout_authority_version > 0
      and payout_authority_asset is not null
      and payout_authority_credits is not null
      and payout_authority_credits > 0
      and payout_authority_units is not null
      and payout_authority_units > 0
      and upper(payout_authority_asset)=upper(asset)
      and payout_authority_credits=amount_credits
      and payout_authority_units=payout_amount_units
    )
  );

create or replace function public.enforce_withdrawal_payout_authority_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op='UPDATE'
     and old.payout_authority_version is not null
     and (
       new.payout_authority_version is distinct from old.payout_authority_version
       or new.payout_authority_asset is distinct from old.payout_authority_asset
       or new.payout_authority_credits is distinct from old.payout_authority_credits
       or new.payout_authority_units is distinct from old.payout_authority_units
     ) then
    raise exception 'withdrawal payout authority snapshot is immutable' using errcode='23514';
  end if;

  if lower(new.payout_provider)='faucetpay'
     and new.status in ('requested','held','submitted','paid')
     and (
       new.payout_authority_version is null
       or new.payout_authority_asset is null
       or new.payout_authority_credits is null
       or new.payout_authority_units is null
       or upper(new.payout_authority_asset) <> upper(new.asset)
       or new.payout_authority_credits <> new.amount_credits
       or new.payout_authority_units <> new.payout_amount_units
     ) then
    raise exception 'faucetpay withdrawal requires an immutable payout authority snapshot' using errcode='23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_withdrawal_payout_authority_snapshot()
  from public, anon, authenticated, service_role;

drop trigger if exists withdrawal_payout_authority_snapshot_guard on public.withdrawals;
create trigger withdrawal_payout_authority_snapshot_guard
before insert or update on public.withdrawals
for each row execute function public.enforce_withdrawal_payout_authority_snapshot();

create or replace function public.withdrawal_payout_authority_snapshot_valid(
  p_withdrawal_id uuid
)
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select coalesce((
  select
    lower(w.payout_provider)='faucetpay'
    and w.payout_authority_version is not null
    and w.payout_authority_version > 0
    and upper(w.payout_authority_asset)=upper(w.asset)
    and w.payout_authority_credits=w.amount_credits
    and w.payout_authority_units=w.payout_amount_units
  from public.withdrawals w
  where w.id=p_withdrawal_id
),false);
$$;

revoke all on function public.withdrawal_payout_authority_snapshot_valid(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.withdrawal_payout_authority_snapshot_valid(uuid)
  to service_role;

create or replace function public.reserve_withdrawal(
  p_user_id uuid,
  p_idempotency_key text,
  p_provider text,
  p_asset text,
  p_destination text,
  p_amount_credits bigint,
  p_payout_amount_units bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_existing public.withdrawals%rowtype;
  v_available bigint := 0;
  v_risk_score integer := 0;
  v_hold_score integer := 60;
  v_status text := 'requested';
  v_withdrawal_id uuid := gen_random_uuid();
  v_ledger_id uuid := gen_random_uuid();
  v_fee_ledger_id uuid;
  v_economy jsonb := '{}'::jsonb;
  v_window_hours integer := 24;
  v_extra_enabled boolean := false;
  v_fee_credits bigint := 0;
  v_last_free_paid_at timestamptz;
  v_next_free_at timestamptz;
  v_authority public.faucetpay_payout_pack_authority%rowtype;
begin
  if p_user_id is null then
    return jsonb_build_object('status','invalid_user');
  end if;

  if p_amount_credits <= 0
     or p_payout_amount_units <= 0
     or length(trim(p_destination)) = 0 then
    return jsonb_build_object('status','invalid');
  end if;

  if lower(trim(coalesce(p_provider,''))) <> 'faucetpay' then
    return jsonb_build_object('status','unsupported_provider');
  end if;

  select * into v_authority
  from public.faucetpay_payout_pack_authority
  where singleton=true;

  if not found then
    return jsonb_build_object('status','payout_authority_missing');
  end if;

  if upper(trim(p_asset)) <> upper(v_authority.asset)
     or p_amount_credits <> v_authority.credits
     or p_payout_amount_units <> v_authority.units then
    return jsonb_build_object('status','payout_authority_mismatch');
  end if;

  if not public.withdrawal_pilot_allowed(p_user_id) then
    return jsonb_build_object('status','pilot_restricted');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('withdrawal:' || p_user_id::text,0));

  select * into v_existing
  from public.withdrawals
  where user_id=p_user_id
    and status in ('requested','held','submitted')
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'status',case when v_existing.status='held' then 'held' else 'active' end,
      'withdrawal_id',v_existing.id,
      'idempotency_key',v_existing.idempotency_key,
      'destination',v_existing.destination,
      'asset',v_existing.asset,
      'amount_credits',v_existing.amount_credits,
      'payout_amount_units',v_existing.payout_amount_units,
      'service_fee_credits',coalesce(v_existing.service_fee_credits,0),
      'payout_authority_version',v_existing.payout_authority_version,
      'payout_authority_asset',v_existing.payout_authority_asset,
      'payout_authority_credits',v_existing.payout_authority_credits,
      'payout_authority_units',v_existing.payout_authority_units
    );
  end if;

  select coalesce(value,'{}'::jsonb)
  into v_economy
  from public.app_config
  where key='pulse_economy_v13';

  v_window_hours := greatest(1,least(
    coalesce((v_economy->>'free_withdrawal_window_hours')::integer,24),
    168
  ));
  v_extra_enabled := lower(coalesce(v_economy->>'extra_withdrawals_enabled','false'))
    in ('true','1','yes','on');

  select max(free_pass_anchor_at)
  into v_last_free_paid_at
  from public.withdrawals
  where user_id=p_user_id
    and free_pass_anchor_at is not null;

  if v_last_free_paid_at is not null
     and v_last_free_paid_at + make_interval(hours=>v_window_hours) > now() then
    v_next_free_at := v_last_free_paid_at + make_interval(hours=>v_window_hours);

    if not v_extra_enabled then
      return jsonb_build_object(
        'status','free_window_used',
        'next_free_at',v_next_free_at
      );
    end if;

    v_fee_credits := greatest(1,least(
      coalesce((v_economy->>'extra_withdrawal_fee_credits')::bigint,1),
      greatest(1,p_amount_credits)
    ));
  end if;

  select coalesce(available_credits,0)
  into v_available
  from public.user_balances
  where user_id=p_user_id;
  v_available := coalesce(v_available,0);

  if v_available < p_amount_credits + v_fee_credits then
    return jsonb_build_object(
      'status','insufficient',
      'available_credits',v_available,
      'required_credits',p_amount_credits + v_fee_credits,
      'service_fee_credits',v_fee_credits
    );
  end if;

  select coalesce(risk_score,0)
  into v_risk_score
  from public.profiles
  where id=p_user_id;

  select coalesce((value->>'hold_risk_score')::integer,60)
  into v_hold_score
  from public.app_config
  where key='withdrawal_risk';

  v_hold_score := coalesce(v_hold_score,60);
  if coalesce(v_risk_score,0) >= v_hold_score then
    v_status := 'held';
  end if;

  insert into public.ledger_entries(
    id,user_id,event_key,entry_type,state,credits,metadata
  ) values (
    v_ledger_id,
    p_user_id,
    'withdrawal:reserve:' || v_withdrawal_id::text,
    'withdrawal',
    'available',
    -p_amount_credits,
    jsonb_build_object(
      'provider',p_provider,
      'asset',p_asset,
      'withdrawal_id',v_withdrawal_id,
      'payout_authority_version',v_authority.authority_version
    )
  );

  if v_fee_credits > 0 then
    v_fee_ledger_id := gen_random_uuid();

    insert into public.ledger_entries(
      id,user_id,event_key,entry_type,state,credits,metadata
    ) values (
      v_fee_ledger_id,
      p_user_id,
      'withdrawal:fee:' || v_withdrawal_id::text,
      'withdrawal_fee',
      'available',
      -v_fee_credits,
      jsonb_build_object(
        'withdrawal_id',v_withdrawal_id,
        'fee_kind','extra_withdrawal',
        'free_window_hours',v_window_hours
      )
    );
  end if;

  insert into public.withdrawals(
    id,user_id,idempotency_key,payout_provider,asset,destination,
    amount_credits,payout_amount_units,status,ledger_entry_id,
    service_fee_credits,service_fee_ledger_entry_id,free_pass_anchor_at,
    payout_authority_version,payout_authority_asset,
    payout_authority_credits,payout_authority_units
  ) values (
    v_withdrawal_id,p_user_id,p_idempotency_key,'faucetpay',upper(v_authority.asset),
    trim(p_destination),v_authority.credits,v_authority.units,v_status,
    v_ledger_id,v_fee_credits,v_fee_ledger_id,null,
    v_authority.authority_version,upper(v_authority.asset),
    v_authority.credits,v_authority.units
  );

  return jsonb_build_object(
    'status',v_status,
    'withdrawal_id',v_withdrawal_id,
    'idempotency_key',p_idempotency_key,
    'destination',trim(p_destination),
    'asset',upper(v_authority.asset),
    'amount_credits',v_authority.credits,
    'payout_amount_units',v_authority.units,
    'service_fee_credits',v_fee_credits,
    'free_pass_used',v_fee_credits=0,
    'free_pass_anchor_at',v_last_free_paid_at,
    'payout_authority_version',v_authority.authority_version,
    'payout_authority_asset',upper(v_authority.asset),
    'payout_authority_credits',v_authority.credits,
    'payout_authority_units',v_authority.units
  );
end;
$$;

revoke all on function public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)
  to service_role;

create or replace function public.release_withdrawal_recovery_authority_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='withdrawals'
      and column_name='payout_authority_version'
  )
  and exists(
    select 1 from pg_trigger
    where tgrelid='public.withdrawals'::regclass
      and tgname='withdrawal_payout_authority_snapshot_guard'
      and tgenabled <> 'D'
  )
  and position(
    'faucetpay_payout_pack_authority'
    in pg_get_functiondef('public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)'::regprocedure)
  ) > 0
  and position(
    'payout_authority_mismatch'
    in pg_get_functiondef('public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)'::regprocedure)
  ) > 0
  and position(
    'payout_authority_version'
    in pg_get_functiondef('public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)'::regprocedure)
  ) > 0
  and has_function_privilege(
    'service_role','public.withdrawal_payout_authority_snapshot_valid(uuid)','EXECUTE'
  )
  and not has_function_privilege(
    'anon','public.withdrawal_payout_authority_snapshot_valid(uuid)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.withdrawal_payout_authority_snapshot_valid(uuid)','EXECUTE'
  )
  and not has_function_privilege(
    'anon','public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)','EXECUTE'
  )
  and not exists(
    select 1
    from public.withdrawals w
    where lower(w.payout_provider)='faucetpay'
      and w.status in ('requested','held','submitted','paid')
      and not public.withdrawal_payout_authority_snapshot_valid(w.id)
  );
$$;

revoke all on function public.release_withdrawal_recovery_authority_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_withdrawal_recovery_authority_contract()
  to service_role;

do $$
begin
  if not public.release_withdrawal_recovery_authority_contract() then
    raise exception 'withdrawal recovery authority contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'withdrawal recovery authority requires canonical release schema v55';
  end if;
end
$$;
