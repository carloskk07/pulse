-- V13 adversarial hardening: referral graph acyclicity + self-commission defense.
-- Additive only; canonical release schema remains v55/0055.

create or replace function public.enforce_referral_graph_acyclic()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_cycle boolean := false;
begin
  if new.status = 'rejected' then
    return new;
  end if;

  if new.inviter_id is null or new.invitee_id is null or new.inviter_id = new.invitee_id then
    raise exception 'referral_cycle_rejected' using errcode = '23514';
  end if;

  -- Referral binding is rare. A single graph lock makes cycle prevention
  -- authoritative even when multiple accounts bind concurrently.
  perform pg_advisory_xact_lock(hashtextextended('referral-graph', 0));

  with recursive ancestors(user_id, depth, path) as (
    select new.inviter_id, 1, array[new.inviter_id]::uuid[]
    union all
    select r.inviter_id, a.depth + 1, a.path || r.inviter_id
    from ancestors a
    join public.referrals r
      on r.invitee_id = a.user_id
    where r.status <> 'rejected'
      and (tg_op <> 'UPDATE' or r.id <> new.id)
      and a.depth < 64
      and not r.inviter_id = any(a.path)
  )
  select exists (
    select 1
    from ancestors
    where user_id = new.invitee_id
  )
  into v_cycle;

  if v_cycle then
    raise exception 'referral_cycle_rejected' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_referral_graph_acyclic()
  from public, anon, authenticated, service_role;

drop trigger if exists referral_graph_acyclic_guard on public.referrals;
create trigger referral_graph_acyclic_guard
before insert or update of inviter_id, invitee_id, status
on public.referrals
for each row execute function public.enforce_referral_graph_acyclic();

create or replace function public.bind_referral(p_invitee_id uuid, p_referral_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inviter_id uuid;
  v_code text := lower(trim(coalesce(p_referral_code, '')));
  v_cycle boolean := false;
begin
  if v_code !~ '^[0-9a-f]{16}$' then
    return jsonb_build_object('status', 'invalid_code');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('referral-graph', 0));
  perform pg_advisory_xact_lock(hashtextextended('referral:' || p_invitee_id::text, 0));

  if not exists (select 1 from public.profiles where id = p_invitee_id) then
    return jsonb_build_object('status', 'unknown_invitee');
  end if;

  if exists (select 1 from public.referrals where invitee_id = p_invitee_id) then
    return jsonb_build_object('status', 'existing');
  end if;

  if exists (
    select 1 from public.monetization_events
    where user_id = p_invitee_id and event_type = 'conversion' and status = 'confirmed'
  ) then
    return jsonb_build_object('status', 'already_monetized');
  end if;

  select id into v_inviter_id
  from public.profiles
  where referral_code = v_code
  limit 1;

  if not found then return jsonb_build_object('status', 'unknown_code'); end if;
  if v_inviter_id = p_invitee_id then return jsonb_build_object('status', 'self_referral'); end if;

  with recursive ancestors(user_id, depth, path) as (
    select v_inviter_id, 1, array[v_inviter_id]::uuid[]
    union all
    select r.inviter_id, a.depth + 1, a.path || r.inviter_id
    from ancestors a
    join public.referrals r
      on r.invitee_id = a.user_id
    where r.status <> 'rejected'
      and a.depth < 64
      and not r.inviter_id = any(a.path)
  )
  select exists (
    select 1
    from ancestors
    where user_id = p_invitee_id
  )
  into v_cycle;

  if v_cycle then
    return jsonb_build_object('status', 'cycle_rejected');
  end if;

  insert into public.referrals(inviter_id, invitee_id, source_code)
  values (v_inviter_id, p_invitee_id, v_code);

  return jsonb_build_object('status', 'bound', 'inviter_id', v_inviter_id);
end;
$$;

revoke all on function public.bind_referral(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.bind_referral(uuid,text)
  to service_role;

-- Referral rewards must be financed by verified post-user-reward margin.
-- Keep the configured headline rewards, but allow them to consume at most
-- half of the qualifying conversion's verified margin by default.
insert into public.app_config(key, value, version, reason)
values (
  'referral_reward',
  jsonb_build_object(
    'inviter_credits',100,
    'invitee_credits',50,
    'max_reward_share_of_margin_bps',5000
  ),
  2,
  'Verified referral reward only when funded by conversion margin; at least half of verified margin remains with the platform'
)
on conflict (key) do update
set value = coalesce(app_config.value,'{}'::jsonb)
    || jsonb_build_object('max_reward_share_of_margin_bps',5000),
    version = greatest(app_config.version,2),
    reason = excluded.reason,
    updated_at = now();

create or replace function public.reward_referral_on_conversion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $
declare
  v_ref public.referrals%rowtype;
  v_config jsonb := '{}'::jsonb;
  v_inviter_reward bigint := 100;
  v_invitee_reward bigint := 50;
  v_share_bps integer := 5000;
  v_verified_margin_usd_micros bigint := 0;
  v_reward_cost_usd_micros bigint := 0;
  v_reward_budget_usd_micros bigint := 0;
begin
  if new.event_type <> 'conversion' or new.status <> 'confirmed' then
    return new;
  end if;

  select * into v_ref
  from public.referrals
  where invitee_id = new.user_id
    and status = 'pending'
  for update;

  if not found then
    return new;
  end if;

  select coalesce(value,'{}'::jsonb)
  into v_config
  from public.app_config
  where key='referral_reward';

  v_inviter_reward := greatest(0,least(
    coalesce((v_config->>'inviter_credits')::bigint,100),
    1000000
  ));
  v_invitee_reward := greatest(0,least(
    coalesce((v_config->>'invitee_credits')::bigint,50),
    1000000
  ));
  v_share_bps := greatest(0,least(
    coalesce((v_config->>'max_reward_share_of_margin_bps')::integer,5000),
    10000
  ));

  -- 1 P = 1,000 USD micros under the canonical payout economics already used
  -- by Pulse Direct. User reward cost is removed before referral budget exists.
  v_verified_margin_usd_micros := greatest(
    0,
    coalesce(new.payout_usd_micros,0)
      - greatest(0,coalesce(new.reward_credits,0)) * 1000
  );
  v_reward_cost_usd_micros := (v_inviter_reward + v_invitee_reward) * 1000;
  v_reward_budget_usd_micros := floor(
    (v_verified_margin_usd_micros::numeric * v_share_bps::numeric) / 10000::numeric
  )::bigint;

  if v_reward_cost_usd_micros <= 0
     or v_reward_cost_usd_micros > v_reward_budget_usd_micros then
    -- Leave the referral pending. A later profitable verified conversion may
    -- qualify it; an underfunded conversion can never mint referral liability.
    return new;
  end if;

  if v_inviter_reward > 0 then
    insert into public.ledger_entries(user_id, event_key, entry_type, state, credits, metadata)
    values (
      v_ref.inviter_id,
      'referral:inviter:' || v_ref.id::text,
      'referral',
      'available',
      v_inviter_reward,
      jsonb_build_object(
        'referral_id',v_ref.id,
        'role','inviter',
        'qualifying_conversion_id',new.id,
        'verified_margin_usd_micros',v_verified_margin_usd_micros,
        'reward_budget_usd_micros',v_reward_budget_usd_micros
      )
    );
  end if;

  if v_invitee_reward > 0 then
    insert into public.ledger_entries(user_id, event_key, entry_type, state, credits, metadata)
    values (
      v_ref.invitee_id,
      'referral:invitee:' || v_ref.id::text,
      'referral',
      'available',
      v_invitee_reward,
      jsonb_build_object(
        'referral_id',v_ref.id,
        'role','invitee',
        'qualifying_conversion_id',new.id,
        'verified_margin_usd_micros',v_verified_margin_usd_micros,
        'reward_budget_usd_micros',v_reward_budget_usd_micros
      )
    );
  end if;

  update public.referrals
  set status='rewarded',
      qualifying_conversion_id=new.id,
      inviter_reward_credits=v_inviter_reward,
      invitee_reward_credits=v_invitee_reward,
      rewarded_at=now()
  where id=v_ref.id;

  return new;
end;
$;

revoke all on function public.reward_referral_on_conversion()
  from public, anon, authenticated, service_role;

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
  v_seen uuid[] := '{}'::uuid[];
begin
  select coalesce(value,'{}'::jsonb)
  into v_config
  from public.app_config
  where key='pulse_economy_v13';

  v_enabled := lower(coalesce(v_config->>'network_commission_enabled','false'))
    in ('true','1','yes','on');

  if new.event_type='conversion' and new.status='confirmed' then
    if not v_enabled then return new; end if;

    v_margin := greatest(
      0,
      coalesce(new.payout_usd_micros,0)
        - greatest(0,coalesce(new.reward_credits,0)) * 1000
    );
    if v_margin <= 0 then return new; end if;

    v_source_user := new.user_id;
    v_seen := array[new.user_id]::uuid[];

    for v_level in 1..3 loop
      select r.inviter_id into v_beneficiary
      from public.referrals r
      where r.invitee_id = v_source_user
        and r.status = 'rewarded'
      limit 1;

      if not found then exit; end if;

      -- Defense in depth: even a legacy or manually corrupted graph can never
      -- route commission back to the source user or repeat a beneficiary.
      if v_beneficiary = any(v_seen) then
        exit;
      end if;
      v_seen := array_append(v_seen, v_beneficiary);

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

create or replace function public.release_referral_network_integrity_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  exists (
    select 1
    from pg_trigger
    where tgrelid='public.referrals'::regclass
      and tgname='referral_graph_acyclic_guard'
      and tgenabled <> 'D'
  )
  and position(
    'cycle_rejected'
    in pg_get_functiondef('public.bind_referral(uuid,text)'::regprocedure)
  ) > 0
  and position(
    'referral-graph'
    in pg_get_functiondef('public.bind_referral(uuid,text)'::regprocedure)
  ) > 0
  and position(
    'v_beneficiary = any(v_seen)'
    in lower(pg_get_functiondef('public.apply_network_commission_on_monetization()'::regprocedure))
  ) > 0
  and position(
    'v_reward_cost_usd_micros > v_reward_budget_usd_micros'
    in lower(pg_get_functiondef('public.reward_referral_on_conversion()'::regprocedure))
  ) > 0
  and coalesce((
    select (value->>'max_reward_share_of_margin_bps')::integer = 5000
    from public.app_config
    where key='referral_reward'
  ),false)
  and not has_function_privilege('anon','public.bind_referral(uuid,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.bind_referral(uuid,text)','EXECUTE')
  and has_function_privilege('service_role','public.bind_referral(uuid,text)','EXECUTE');
$$;

revoke all on function public.release_referral_network_integrity_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_referral_network_integrity_contract()
  to service_role;

do $$
begin
  if not public.release_referral_network_integrity_contract() then
    raise exception 'referral network integrity contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'referral network hardening requires canonical release schema v55';
  end if;
end
$$;
