-- V13.13 cashback revalidation state authority.
-- Affiliate networks may move a previously approved commission back to pending
-- review. Preserve the same event and ledger entry while removing spendable
-- availability until the provider confirms it again.
-- Canonical release schema remains v55/0055.

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
  v_config jsonb := '{}'::jsonb;
  v_enabled boolean := false;
  v_share_bps integer := 0;
  v_existing public.cashback_events%rowtype;
  v_ledger_id uuid;
  v_event_id uuid;
  v_state text;
  v_reward_cost numeric := 0;
  v_max_reward_cost numeric := 0;
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

  select coalesce(value,'{}'::jsonb)
  into v_config
  from public.app_config
  where key='pulse_economy_v13';

  v_enabled := lower(coalesce(v_config->>'cashback_enabled','false'))
    in ('true','1','yes','on');

  v_share_bps := greatest(0,least(
    coalesce((v_config->>'cashback_user_share_bps')::integer,0),
    10000
  ));

  if v_share_bps > 7500 then
    if p_status <> 'reversed' then
      return jsonb_build_object('status','cashback_config_unsafe');
    end if;
  end if;

  if p_status <> 'reversed' and not v_enabled then
    return jsonb_build_object('status','cashback_disabled');
  end if;

  if p_status <> 'reversed' then
    v_reward_cost := p_user_reward_credits::numeric * 1000::numeric;
    v_max_reward_cost := floor(
      (p_commission_usd_micros::numeric * v_share_bps::numeric) / 10000::numeric
    );

    if v_reward_cost > v_max_reward_cost then
      return jsonb_build_object('status','reward_exceeds_cashback_share');
    end if;
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

    if p_status <> 'reversed'
       and (
         v_existing.commission_usd_micros <> p_commission_usd_micros
         or v_existing.user_reward_credits <> p_user_reward_credits
       ) then
      return jsonb_build_object('status','economics_mismatch');
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
          payload=coalesce(p_payload,'{}'::jsonb),
          confirmed_at=now(),
          updated_at=now()
      where id=v_existing.id;

      return jsonb_build_object('status','confirmed','event_id',v_existing.id);
    end if;

    if p_status = 'pending' and v_existing.status = 'confirmed' then
      if v_existing.ledger_entry_id is not null then
        update public.ledger_entries
        set state = 'pending'
        where id = v_existing.ledger_entry_id
          and user_id = p_user_id
          and entry_type = 'cashback';
      end if;

      update public.cashback_events
      set status='pending',
          payload=coalesce(p_payload,'{}'::jsonb),
          confirmed_at=null,
          updated_at=now()
      where id=v_existing.id;

      return jsonb_build_object('status','pending','event_id',v_existing.id);
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
      jsonb_build_object(
        'cashback_event_id',v_event_id,
        'provider',v_provider,
        'cashback_user_share_bps',v_share_bps,
        'max_reward_cost_usd_micros',v_max_reward_cost
      )
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

create or replace function public.release_cashback_budget_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
with src as (
  select lower(pg_get_functiondef(
    'public.apply_cashback_event(text,text,uuid,text,bigint,bigint,jsonb)'::regprocedure
  )) as body
)
select
  coalesce((
    select (value->>'cashback_user_share_bps')::integer between 0 and 7500
    from public.app_config
    where key='pulse_economy_v13'
  ),false)
  and position('cashback_disabled' in (select body from src)) > 0
  and position('reward_exceeds_cashback_share' in (select body from src)) > 0
  and position('economics_mismatch' in (select body from src)) > 0
  and position('p_status = ''pending'' and v_existing.status = ''confirmed''' in (select body from src)) > 0
  and position('set state = ''pending''' in (select body from src)) > 0
  and position('confirmed_at=null' in (select body from src)) > 0
  and not has_function_privilege(
    'anon',
    'public.apply_cashback_event(text,text,uuid,text,bigint,bigint,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.apply_cashback_event(text,text,uuid,text,bigint,bigint,jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.apply_cashback_event(text,text,uuid,text,bigint,bigint,jsonb)',
    'EXECUTE'
  );
$$;

revoke all on function public.release_cashback_budget_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_cashback_budget_contract()
  to service_role;

do $$
begin
  if not public.release_cashback_budget_contract() then
    raise exception 'cashback revalidation contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'cashback revalidation requires canonical release schema v55';
  end if;
end
$$;
