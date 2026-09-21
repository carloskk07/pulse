-- V13 withdrawal-pass anchor authority.
-- Paid extra withdrawals must never postpone the next fee-free withdrawal.
-- A dedicated immutable anchor is set only when a fee-free withdrawal settles.
-- Canonical release schema remains v55/0055.

alter table public.withdrawals
  add column if not exists free_pass_anchor_at timestamptz;

-- Existing paid fee-free withdrawals become historical free-pass anchors.
update public.withdrawals
set free_pass_anchor_at = coalesce(free_pass_anchor_at, updated_at, created_at)
where status='paid'
  and coalesce(service_fee_credits,0)=0
  and free_pass_anchor_at is null;

-- Fee-bearing or non-paid rows can never become free-pass anchors.
alter table public.withdrawals
  drop constraint if exists withdrawals_free_pass_anchor_integrity_chk;
alter table public.withdrawals
  add constraint withdrawals_free_pass_anchor_integrity_chk
  check (
    free_pass_anchor_at is null
    or (status='paid' and coalesce(service_fee_credits,0)=0)
  );

create index if not exists withdrawals_free_pass_anchor_idx
  on public.withdrawals(user_id, free_pass_anchor_at desc)
  where free_pass_anchor_at is not null;

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
begin
  if p_user_id is null then
    return jsonb_build_object('status','invalid_user');
  end if;

  if p_amount_credits <= 0
     or p_payout_amount_units <= 0
     or length(trim(p_destination)) = 0 then
    return jsonb_build_object('status','invalid');
  end if;

  if not public.withdrawal_pilot_allowed(p_user_id) then
    return jsonb_build_object('status','pilot_restricted');
  end if;

  -- Serializes reserve decisions per user. Along with the unique active index,
  -- concurrent requests can never create two reservations or two fee debits.
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
      'service_fee_credits',coalesce(v_existing.service_fee_credits,0)
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

  -- Only the last PAID FEE-FREE withdrawal owns the 24-hour clock.
  -- Paid extra withdrawals deliberately have free_pass_anchor_at = NULL.
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
      'withdrawal_id',v_withdrawal_id
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
    service_fee_credits,service_fee_ledger_entry_id,free_pass_anchor_at
  ) values (
    v_withdrawal_id,p_user_id,p_idempotency_key,p_provider,upper(p_asset),
    trim(p_destination),p_amount_credits,p_payout_amount_units,v_status,
    v_ledger_id,v_fee_credits,v_fee_ledger_id,null
  );

  return jsonb_build_object(
    'status',v_status,
    'withdrawal_id',v_withdrawal_id,
    'idempotency_key',p_idempotency_key,
    'destination',trim(p_destination),
    'asset',upper(p_asset),
    'amount_credits',p_amount_credits,
    'payout_amount_units',p_payout_amount_units,
    'service_fee_credits',v_fee_credits,
    'free_pass_used',v_fee_credits=0,
    'free_pass_anchor_at',v_last_free_paid_at
  );
end;
$$;

revoke all on function public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)
  to service_role;

create or replace function public.finalize_withdrawal(
  p_withdrawal_id uuid,
  p_status text,
  p_external_id text,
  p_message text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row public.withdrawals%rowtype;
  v_external_id text := nullif(trim(p_external_id),'');
  v_paid_at timestamptz := now();
begin
  if p_status not in ('submitted','paid','failed') then
    return jsonb_build_object('status','invalid');
  end if;

  if p_status='paid' and v_external_id is null then
    return jsonb_build_object('status','invalid_external_id');
  end if;

  select * into v_row
  from public.withdrawals
  where id=p_withdrawal_id
  for update;

  if not found then return jsonb_build_object('status','not_found'); end if;
  if v_row.status='paid' then
    return jsonb_build_object(
      'status','paid',
      'external_id',v_row.external_id,
      'service_fee_credits',coalesce(v_row.service_fee_credits,0),
      'free_pass_anchor_at',v_row.free_pass_anchor_at
    );
  end if;
  if v_row.status in ('failed','cancelled') then
    return jsonb_build_object('status',v_row.status);
  end if;
  if v_row.status='held' then return jsonb_build_object('status','held'); end if;

  if p_status='submitted' then
    update public.withdrawals
    set status='submitted',provider_message=p_message,updated_at=now()
    where id=p_withdrawal_id;
    return jsonb_build_object('status','submitted');
  end if;

  if p_status='paid' then
    update public.withdrawals
    set status='paid',
        external_id=v_external_id,
        provider_message=p_message,
        free_pass_anchor_at=case
          when coalesce(v_row.service_fee_credits,0)=0
            then coalesce(v_row.free_pass_anchor_at,v_paid_at)
          else null
        end,
        updated_at=v_paid_at
    where id=p_withdrawal_id;

    update public.ledger_entries
    set state='withdrawn'
    where id in (v_row.ledger_entry_id,v_row.service_fee_ledger_entry_id);

    return jsonb_build_object(
      'status','paid',
      'external_id',v_external_id,
      'service_fee_credits',coalesce(v_row.service_fee_credits,0),
      'free_pass_anchor_at',case
        when coalesce(v_row.service_fee_credits,0)=0 then v_paid_at
        else null
      end
    );
  end if;

  update public.withdrawals
  set status='failed',provider_message=p_message,updated_at=now()
  where id=p_withdrawal_id;

  update public.ledger_entries
  set state='reversed'
  where id in (v_row.ledger_entry_id,v_row.service_fee_ledger_entry_id);

  return jsonb_build_object(
    'status','failed',
    'service_fee_credits',coalesce(v_row.service_fee_credits,0)
  );
end;
$$;

revoke all on function public.finalize_withdrawal(uuid,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_withdrawal(uuid,text,text,text)
  to service_role;

create or replace function public.current_ecosystem_snapshot(p_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
with
cfg as (
  select coalesce((select value from public.app_config where key='pulse_economy_v13'),'{}'::jsonb) as value
),
utc as (
  select date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' as day_start
),
claims as (
  select
    count(*)::integer as total,
    count(*) filter(where pc.created_at >= (select day_start from utc))::integer as today
  from public.pulse_claims pc
  where pc.user_id=p_user_id
),
mon as (
  select
    count(*) filter(where me.event_type='conversion' and me.status='confirmed')::integer as confirmed,
    count(*) filter(
      where me.event_type='conversion'
        and me.status='confirmed'
        and me.created_at >= (select day_start from utc)
    )::integer as today
  from public.monetization_events me
  where me.user_id=p_user_id
),
wd as (
  select
    count(*) filter(where w.status='paid')::integer as paid,
    max(w.free_pass_anchor_at) as last_free_paid_at
  from public.withdrawals w
  where w.user_id=p_user_id
),
refs as (
  select count(*) filter(where r.status='rewarded')::integer as rewarded
  from public.referrals r
  where r.inviter_id=p_user_id
),
l1 as (
  select r.invitee_id as user_id,r.status
  from public.referrals r
  where r.inviter_id=p_user_id and r.status <> 'rejected'
),
l2 as (
  select r.invitee_id as user_id,r.status
  from public.referrals r
  join l1 on l1.user_id=r.inviter_id
  where r.status <> 'rejected'
),
l3 as (
  select r.invitee_id as user_id,r.status
  from public.referrals r
  join l2 on l2.user_id=r.inviter_id
  where r.status <> 'rejected'
),
network as (
  select 1::integer as level,count(*)::integer as members,
         count(*) filter(where status='rewarded')::integer as active from l1
  union all
  select 2,count(*)::integer,count(*) filter(where status='rewarded')::integer from l2
  union all
  select 3,count(*)::integer,count(*) filter(where status='rewarded')::integer from l3
),
cash as (
  select
    coalesce(sum(ce.user_reward_credits) filter(where ce.status='pending'),0)::bigint as pending_credits,
    coalesce(sum(ce.user_reward_credits) filter(where ce.status='confirmed'),0)::bigint as confirmed_credits
  from public.cashback_events ce
  where ce.user_id=p_user_id
),
offers as (
  select count(*)::integer as active_offers
  from public.reward_opportunities ro
  where ro.status='active'
    and ro.source_type='affiliate'
    and ro.health_state <> 'hidden'
),
pass as (
  select
    (select last_free_paid_at from wd) as last_free_paid_at,
    greatest(1,least(
      coalesce(((select value from cfg)->>'free_withdrawal_window_hours')::integer,24),
      168
    )) as window_hours
)
select jsonb_build_object(
  'config',(select value from cfg),
  'claims',jsonb_build_object(
    'total',(select total from claims),
    'today',(select today from claims)
  ),
  'monetization',jsonb_build_object(
    'confirmed',(select confirmed from mon),
    'today',(select today from mon)
  ),
  'withdrawals',jsonb_build_object(
    'paid',(select paid from wd),
    'free_pass_available',
      ((select last_free_paid_at from pass) is null
       or (select last_free_paid_at from pass) + make_interval(hours => (select window_hours from pass)) <= now()),
    'next_free_at',
      case
        when (select last_free_paid_at from pass) is null then null
        when (select last_free_paid_at from pass) + make_interval(hours => (select window_hours from pass)) <= now() then null
        else (select last_free_paid_at from pass) + make_interval(hours => (select window_hours from pass))
      end
  ),
  'referrals',jsonb_build_object('rewarded',(select rewarded from refs)),
  'network',coalesce((
    select jsonb_agg(jsonb_build_object(
      'level',level,'members',members,'active',active
    ) order by level)
    from network
  ),'[]'::jsonb),
  'cashback',jsonb_build_object(
    'active_offers',(select active_offers from offers),
    'pending_credits',(select pending_credits from cash),
    'confirmed_credits',(select confirmed_credits from cash)
  )
);
$$;

revoke all on function public.current_ecosystem_snapshot(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.current_ecosystem_snapshot(uuid)
  to service_role;

create or replace function public.release_withdrawal_pass_integrity_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='withdrawals'
      and column_name='free_pass_anchor_at'
  )
  and exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='withdrawals'
      and indexname='withdrawals_one_active_per_user_idx'
      and indexdef ilike 'create unique index%'
  )
  and exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='withdrawals'
      and indexname='withdrawals_idempotency_key_key'
      and indexdef ilike 'create unique index%'
  )
  and position(
    'max(free_pass_anchor_at)'
    in lower(pg_get_functiondef('public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)'::regprocedure))
  ) > 0
  and position(
    'coalesce(v_row.service_fee_credits,0)=0'
    in replace(lower(pg_get_functiondef('public.finalize_withdrawal(uuid,text,text,text)'::regprocedure)),' ','')
  ) > 0
  and position(
    'max(w.free_pass_anchor_at)'
    in lower(pg_get_functiondef('public.current_ecosystem_snapshot(uuid)'::regprocedure))
  ) > 0
  and position(
    'v_row.ledger_entry_id,v_row.service_fee_ledger_entry_id'
    in replace(lower(pg_get_functiondef('public.finalize_withdrawal(uuid,text,text,text)'::regprocedure)),' ','')
  ) > 0
  and not has_function_privilege(
    'anon','public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)','EXECUTE'
  )
  and has_function_privilege(
    'service_role','public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)','EXECUTE'
  )
  and not has_function_privilege(
    'anon','public.finalize_withdrawal(uuid,text,text,text)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.finalize_withdrawal(uuid,text,text,text)','EXECUTE'
  )
  and has_function_privilege(
    'service_role','public.finalize_withdrawal(uuid,text,text,text)','EXECUTE'
  )
  and coalesce((
    select (value->>'free_withdrawal_window_hours')::integer between 1 and 168
      and (value->>'extra_withdrawal_fee_credits')::bigint >= 1
    from public.app_config
    where key='pulse_economy_v13'
  ),false);
$$;

revoke all on function public.release_withdrawal_pass_integrity_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_withdrawal_pass_integrity_contract()
  to service_role;

do $$
begin
  if not public.release_withdrawal_pass_integrity_contract() then
    raise exception 'withdrawal pass integrity contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'withdrawal pass integrity requires canonical release schema v55';
  end if;
end
$$;
