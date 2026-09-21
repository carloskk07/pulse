-- PulseCircuit V13: continuous reward ecosystem foundation.
-- Keeps the hourly faucet free and cadence-bound while preparing XP, network,
-- cashback and premium-withdrawal economics behind explicit feature flags.
-- The canonical release schema remains v55/0055; this migration is additive.

alter table public.ledger_entries
  drop constraint if exists ledger_entries_entry_type_check;

alter table public.ledger_entries
  add constraint ledger_entries_entry_type_check
  check (entry_type in (
    'daily_reward','pulse_reward','offer','survey','referral','withdrawal',
    'chargeback','adjustment','cashback','network_commission'
  ));

insert into public.app_config(key, value, version, reason)
values (
  'pulse_economy_v13',
  jsonb_build_object(
    'version', 13,
    'hourly_windows_per_day', 24,
    'user_daily_cap_mode', 'natural_hourly_ceiling',
    'user_daily_cap_enabled', true,
    'variable_reward_enabled', false,
    'variable_reward_review_required', true,
    'reward_bands', jsonb_build_array(
      jsonb_build_object('credits', 1, 'probability_bps', 7000),
      jsonb_build_object('credits', 2, 'probability_bps', 2000),
      jsonb_build_object('credits', 3, 'probability_bps', 700),
      jsonb_build_object('credits', 5, 'probability_bps', 200),
      jsonb_build_object('credits', 10, 'probability_bps', 90),
      jsonb_build_object('credits', 50, 'probability_bps', 10)
    ),
    'free_withdrawal_window_hours', 24,
    'extra_withdrawal_fee_credits', 1,
    'extra_withdrawals_enabled', false,
    'network_commission_enabled', false,
    'network_commission_bps', jsonb_build_object('1', 1000, '2', 300, '3', 100),
    'cashback_enabled', false,
    'cashback_user_share_bps', 7500
  ),
  13,
  'Continuous hourly reward ecosystem; monetary chance, cashback, network commission and paid extra withdrawals remain feature-gated'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();

create table if not exists public.cashback_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (length(trim(provider)) between 1 and 80),
  external_id text not null check (length(trim(external_id)) between 1 and 200),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending','confirmed','reversed')),
  commission_usd_micros bigint not null check (commission_usd_micros >= 0),
  user_reward_credits bigint not null check (user_reward_credits >= 0),
  ledger_entry_id uuid unique references public.ledger_entries(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  confirmed_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_id)
);

create index if not exists cashback_events_user_status_idx
  on public.cashback_events(user_id, status, created_at desc);

alter table public.cashback_events enable row level security;

drop policy if exists "cashback_events_read_own" on public.cashback_events;
create policy "cashback_events_read_own"
on public.cashback_events
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.cashback_events from public, anon, authenticated, service_role;
grant select on table public.cashback_events to authenticated, service_role;
grant insert, update, delete on table public.cashback_events to service_role;

create or replace function public.apply_cashback_event(
  p_provider text,
  p_external_id text,
  p_user_id uuid,
  p_status text,
  p_commission_usd_micros bigint,
  p_user_reward_credits bigint,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_provider text := trim(coalesce(p_provider, ''));
  v_external_id text := trim(coalesce(p_external_id, ''));
  v_existing public.cashback_events%rowtype;
  v_ledger_id uuid;
  v_event_id uuid;
  v_state text;
begin
  if p_user_id is null
     or length(v_provider) = 0
     or length(v_external_id) = 0
     or p_status not in ('pending','confirmed','reversed')
     or p_commission_usd_micros is null
     or p_commission_usd_micros < 0
     or p_user_reward_credits is null
     or p_user_reward_credits < 0 then
    return jsonb_build_object('status','invalid');
  end if;

  if p_user_reward_credits * 1000 > p_commission_usd_micros then
    return jsonb_build_object('status','reward_exceeds_confirmed_commission');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'cashback:' || lower(v_provider) || ':' || v_external_id, 0
  ));

  select * into v_existing
  from public.cashback_events
  where provider = v_provider and external_id = v_external_id
  for update;

  if found then
    if v_existing.user_id <> p_user_id then
      return jsonb_build_object('status','identity_mismatch');
    end if;

    if v_existing.status = 'reversed' then
      return jsonb_build_object('status','reversed');
    end if;

    if p_status = v_existing.status then
      return jsonb_build_object('status','idempotent','event_id',v_existing.id);
    end if;

    if p_status = 'confirmed' and v_existing.status = 'pending' then
      if v_existing.ledger_entry_id is not null then
        update public.ledger_entries
        set state = 'available'
        where id = v_existing.ledger_entry_id
          and user_id = p_user_id
          and entry_type = 'cashback';
      end if;

      update public.cashback_events
      set status='confirmed',
          commission_usd_micros=p_commission_usd_micros,
          user_reward_credits=p_user_reward_credits,
          payload=coalesce(p_payload,'{}'::jsonb),
          confirmed_at=now(),
          updated_at=now()
      where id=v_existing.id;

      return jsonb_build_object('status','confirmed','event_id',v_existing.id);
    end if;

    if p_status = 'reversed' then
      if v_existing.ledger_entry_id is not null then
        update public.ledger_entries
        set state = 'reversed'
        where id = v_existing.ledger_entry_id
          and user_id = p_user_id
          and entry_type = 'cashback';
      end if;

      update public.cashback_events
      set status='reversed',
          payload=coalesce(p_payload,'{}'::jsonb),
          reversed_at=now(),
          updated_at=now()
      where id=v_existing.id;

      return jsonb_build_object('status','reversed','event_id',v_existing.id);
    end if;

    return jsonb_build_object('status','invalid_transition');
  end if;

  if p_status = 'reversed' then
    return jsonb_build_object('status','orphan_reversal');
  end if;

  if not exists(select 1 from public.profiles where id=p_user_id) then
    return jsonb_build_object('status','unknown_user');
  end if;

  v_event_id := gen_random_uuid();
  v_ledger_id := case when p_user_reward_credits > 0 then gen_random_uuid() else null end;
  v_state := case when p_status='confirmed' then 'available' else 'pending' end;

  if v_ledger_id is not null then
    insert into public.ledger_entries(
      id,user_id,event_key,entry_type,state,credits,usd_micros,metadata
    ) values (
      v_ledger_id,
      p_user_id,
      'cashback:' || lower(v_provider) || ':' || v_external_id,
      'cashback',
      v_state,
      p_user_reward_credits,
      p_commission_usd_micros,
      jsonb_build_object('cashback_event_id',v_event_id,'provider',v_provider)
    );
  end if;

  insert into public.cashback_events(
    id,provider,external_id,user_id,status,commission_usd_micros,
    user_reward_credits,ledger_entry_id,payload,occurred_at,confirmed_at
  ) values (
    v_event_id,v_provider,v_external_id,p_user_id,p_status,p_commission_usd_micros,
    p_user_reward_credits,v_ledger_id,coalesce(p_payload,'{}'::jsonb),now(),
    case when p_status='confirmed' then now() else null end
  );

  return jsonb_build_object('status',p_status,'event_id',v_event_id);
end;
$$;

revoke all on function public.apply_cashback_event(text,text,uuid,text,bigint,bigint,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_cashback_event(text,text,uuid,text,bigint,bigint,jsonb)
  to service_role;

create table if not exists public.network_commission_events (
  id uuid primary key default gen_random_uuid(),
  source_monetization_event_id uuid not null references public.monetization_events(id) on delete restrict,
  source_user_id uuid not null references public.profiles(id) on delete cascade,
  beneficiary_user_id uuid not null references public.profiles(id) on delete cascade,
  network_level smallint not null check (network_level between 1 and 3),
  basis_margin_usd_micros bigint not null check (basis_margin_usd_micros >= 0),
  commission_bps integer not null check (commission_bps between 0 and 10000),
  reward_credits bigint not null check (reward_credits > 0),
  ledger_entry_id uuid not null unique references public.ledger_entries(id) on delete restrict,
  reversal_ledger_entry_id uuid unique references public.ledger_entries(id) on delete restrict,
  status text not null default 'confirmed' check (status in ('confirmed','reversed')),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  unique(source_monetization_event_id, beneficiary_user_id, network_level)
);

create index if not exists network_commission_beneficiary_idx
  on public.network_commission_events(beneficiary_user_id, created_at desc);

alter table public.network_commission_events enable row level security;

drop policy if exists "network_commission_read_own" on public.network_commission_events;
create policy "network_commission_read_own"
on public.network_commission_events
for select
to authenticated
using ((select auth.uid()) = beneficiary_user_id);

revoke all on table public.network_commission_events from public, anon, authenticated, service_role;
grant select on table public.network_commission_events to authenticated, service_role;
grant insert, update, delete on table public.network_commission_events to service_role;

create or replace function public.apply_network_commission_on_monetization()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_config jsonb := '{}'::jsonb;
  v_enabled boolean := false;
  v_source_user uuid;
  v_beneficiary uuid;
  v_level integer;
  v_bps integer;
  v_margin bigint;
  v_credits bigint;
  v_ledger_id uuid;
  v_event public.network_commission_events%rowtype;
  v_reversal_id uuid;
begin
  select coalesce(value,'{}'::jsonb)
  into v_config
  from public.app_config
  where key='pulse_economy_v13';

  v_enabled := lower(coalesce(v_config->>'network_commission_enabled','false'))
    in ('true','1','yes','on');

  if new.event_type='conversion' and new.status='confirmed' then
    if not v_enabled then return new; end if;

    v_margin := greatest(0, coalesce(new.payout_usd_micros,0) - greatest(0,coalesce(new.reward_credits,0)) * 1000);
    if v_margin <= 0 then return new; end if;

    v_source_user := new.user_id;

    for v_level in 1..3 loop
      select r.inviter_id into v_beneficiary
      from public.referrals r
      where r.invitee_id = v_source_user
        and r.status = 'rewarded'
      limit 1;

      if not found then exit; end if;

      v_bps := greatest(0,least(
        coalesce((v_config->'network_commission_bps'->>v_level::text)::integer,0),
        10000
      ));
      v_credits := floor((v_margin::numeric * v_bps::numeric) / 10000000::numeric)::bigint;

      if v_credits > 0 then
        v_ledger_id := gen_random_uuid();

        insert into public.ledger_entries(
          id,user_id,event_key,entry_type,state,credits,usd_micros,metadata
        ) values (
          v_ledger_id,
          v_beneficiary,
          'network:' || new.id::text || ':l' || v_level::text,
          'network_commission',
          'available',
          v_credits,
          v_margin,
          jsonb_build_object(
            'source_monetization_event_id',new.id,
            'source_user_id',new.user_id,
            'network_level',v_level,
            'commission_bps',v_bps
          )
        );

        insert into public.network_commission_events(
          source_monetization_event_id,source_user_id,beneficiary_user_id,
          network_level,basis_margin_usd_micros,commission_bps,reward_credits,
          ledger_entry_id
        ) values (
          new.id,new.user_id,v_beneficiary,v_level,v_margin,v_bps,v_credits,
          v_ledger_id
        )
        on conflict (source_monetization_event_id,beneficiary_user_id,network_level)
        do nothing;
      end if;

      v_source_user := v_beneficiary;
    end loop;

    return new;
  end if;

  if new.event_type='chargeback' and new.original_event_id is not null then
    for v_event in
      select *
      from public.network_commission_events
      where source_monetization_event_id = new.original_event_id
        and status='confirmed'
      for update
    loop
      v_reversal_id := gen_random_uuid();

      insert into public.ledger_entries(
        id,user_id,event_key,entry_type,state,credits,usd_micros,metadata
      ) values (
        v_reversal_id,
        v_event.beneficiary_user_id,
        'network:reversal:' || v_event.id::text,
        'network_commission',
        'available',
        -v_event.reward_credits,
        -v_event.basis_margin_usd_micros,
        jsonb_build_object(
          'network_commission_event_id',v_event.id,
          'chargeback_event_id',new.id,
          'network_level',v_event.network_level
        )
      );

      update public.network_commission_events
      set status='reversed',
          reversal_ledger_entry_id=v_reversal_id,
          reversed_at=now()
      where id=v_event.id;
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function public.apply_network_commission_on_monetization()
  from public, anon, authenticated, service_role;

drop trigger if exists zz_network_commission_after_monetization
  on public.monetization_events;
create trigger zz_network_commission_after_monetization
after insert on public.monetization_events
for each row execute function public.apply_network_commission_on_monetization();

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
    max(w.updated_at) filter(where w.status='paid') as last_paid_at
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
    coalesce((select last_paid_at from wd),null) as last_paid_at,
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
      ((select last_paid_at from pass) is null
       or (select last_paid_at from pass) + make_interval(hours => (select window_hours from pass)) <= now()),
    'next_free_at',
      case
        when (select last_paid_at from pass) is null then null
        when (select last_paid_at from pass) + make_interval(hours => (select window_hours from pass)) <= now() then null
        else (select last_paid_at from pass) + make_interval(hours => (select window_hours from pass))
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

create or replace function public.current_pulse_runtime_state()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
with
pulse as (
  select coalesce((
    select value from public.app_config where key='hourly_pulse'
  ),'{}'::jsonb) as value
),
economy as (
  select coalesce((
    select value from public.app_config where key='pulse_economy_v13'
  ),'{}'::jsonb) as value
),
treasury as (
  select t.*
  from public.reward_treasuries t,pulse p
  where t.code=coalesce(nullif(trim(p.value->>'treasury_code'),''),'launch')
  limit 1
)
select jsonb_build_object(
  'hourly_pulse',(select value from pulse),
  'economy',(select value from economy),
  'treasury',(
    select jsonb_build_object(
      'code',code,
      'funded_credits',funded_credits,
      'reserved_credits',reserved_credits,
      'spent_credits',spent_credits,
      'enabled',enabled,
      'kill_switch',kill_switch,
      'daily_budget_credits',daily_budget_credits,
      'max_user_daily_credits',max_user_daily_credits
    ) from treasury
  )
);
$$;

revoke all on function public.current_pulse_runtime_state()
  from public, anon, authenticated, service_role;
grant execute on function public.current_pulse_runtime_state()
  to service_role;

create or replace function public.release_continuous_reward_ecosystem_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  to_regclass('public.cashback_events') is not null
  and to_regclass('public.network_commission_events') is not null
  and coalesce((select relrowsecurity from pg_class where oid='public.cashback_events'::regclass),false)
  and coalesce((select relrowsecurity from pg_class where oid='public.network_commission_events'::regclass),false)
  and to_regprocedure('public.apply_cashback_event(text,text,uuid,text,bigint,bigint,jsonb)') is not null
  and to_regprocedure('public.current_ecosystem_snapshot(uuid)') is not null
  and to_regprocedure('public.current_pulse_runtime_state()') is not null
  and has_function_privilege('service_role','public.apply_cashback_event(text,text,uuid,text,bigint,bigint,jsonb)','EXECUTE')
  and not has_function_privilege('anon','public.apply_cashback_event(text,text,uuid,text,bigint,bigint,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.apply_cashback_event(text,text,uuid,text,bigint,bigint,jsonb)','EXECUTE')
  and has_function_privilege('service_role','public.current_ecosystem_snapshot(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.current_ecosystem_snapshot(uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.current_ecosystem_snapshot(uuid)','EXECUTE')
  and coalesce((
    select not prosecdef
    from pg_proc
    where oid='public.current_ecosystem_snapshot(uuid)'::regprocedure
  ),false)
  and coalesce((
    select not prosecdef
    from pg_proc
    where oid='public.apply_cashback_event(text,text,uuid,text,bigint,bigint,jsonb)'::regprocedure
  ),false)
  and exists(
    select 1 from pg_trigger
    where tgrelid='public.monetization_events'::regclass
      and tgname='zz_network_commission_after_monetization'
      and tgenabled <> 'D'
  )
  and coalesce((
    select value->>'user_daily_cap_mode'='natural_hourly_ceiling'
    from public.app_config where key='pulse_economy_v13'
  ),false)
  and coalesce((
    select lower(value->>'variable_reward_enabled')='false'
    from public.app_config where key='pulse_economy_v13'
  ),false)
  and coalesce((
    select lower(value->>'extra_withdrawals_enabled')='false'
    from public.app_config where key='pulse_economy_v13'
  ),false);
$$;

revoke all on function public.release_continuous_reward_ecosystem_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_continuous_reward_ecosystem_contract()
  to service_role;

do $$
begin
  if not public.release_continuous_reward_ecosystem_contract() then
    raise exception 'continuous reward ecosystem contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config where key='release_schema'
  ),0) <> 55 then
    raise exception 'V13 additive migration requires canonical release schema v55';
  end if;
end
$$;
