-- V13 stacked-incentive budget authority.
-- Network commission may spend only verified margin remaining after a same-conversion referral acquisition reward.
-- Additive only; canonical release schema remains v55/0055.

update public.app_config
set value = coalesce(value,'{}'::jsonb)
  || jsonb_build_object('network_commission_residual_cap_bps',3000),
    updated_at = now()
where key='pulse_economy_v13';

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
  v_total_bps integer := 0;
  v_cap_bps integer := 3000;
  v_gross_margin bigint := 0;
  v_referral_cost bigint := 0;
  v_margin bigint := 0;
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

    v_gross_margin := greatest(
      0,
      coalesce(new.payout_usd_micros,0)
        - greatest(0,coalesce(new.reward_credits,0)) * 1000
    );
    if v_gross_margin <= 0 then return new; end if;

    -- reward_referral_after_conversion runs before zz_network_commission_after_monetization.
    -- Deduct only referral liability proven to have been created by this exact conversion.
    select coalesce(sum(greatest(le.credits,0)) * 1000,0)::bigint
    into v_referral_cost
    from public.ledger_entries le
    where le.entry_type='referral'
      and le.credits > 0
      and le.metadata->>'qualifying_conversion_id' = new.id::text;

    v_referral_cost := least(v_referral_cost,v_gross_margin);
    v_margin := greatest(0,v_gross_margin - v_referral_cost);
    if v_margin <= 0 then return new; end if;

    v_cap_bps := greatest(0,least(
      coalesce((v_config->>'network_commission_residual_cap_bps')::integer,3000),
      3000
    ));

    v_total_bps :=
      greatest(0,least(coalesce((v_config->'network_commission_bps'->>'1')::integer,0),10000))
      + greatest(0,least(coalesce((v_config->'network_commission_bps'->>'2')::integer,0),10000))
      + greatest(0,least(coalesce((v_config->'network_commission_bps'->>'3')::integer,0),10000));

    -- Fail closed on operator/config drift. Never silently scale a misconfigured
    -- network because the advertised levels must match the actual economics.
    if v_total_bps > v_cap_bps then
      return new;
    end if;

    v_source_user := new.user_id;
    v_seen := array[new.user_id]::uuid[];

    for v_level in 1..3 loop
      select r.inviter_id into v_beneficiary
      from public.referrals r
      where r.invitee_id = v_source_user
        and r.status = 'rewarded'
      limit 1;

      if not found then exit; end if;

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
            'commission_bps',v_bps,
            'gross_margin_usd_micros',v_gross_margin,
            'referral_cost_usd_micros',v_referral_cost,
            'residual_margin_usd_micros',v_margin,
            'network_total_bps',v_total_bps,
            'network_residual_cap_bps',v_cap_bps
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

create or replace function public.release_stacked_incentive_budget_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  coalesce((
    select (value->>'network_commission_residual_cap_bps')::integer between 0 and 3000
    from public.app_config
    where key='pulse_economy_v13'
  ),false)
  and position(
    'v_gross_margin - v_referral_cost'
    in lower(pg_get_functiondef('public.apply_network_commission_on_monetization()'::regprocedure))
  ) > 0
  and position(
    'qualifying_conversion_id'
    in pg_get_functiondef('public.apply_network_commission_on_monetization()'::regprocedure)
  ) > 0
  and position(
    'v_total_bps > v_cap_bps'
    in lower(pg_get_functiondef('public.apply_network_commission_on_monetization()'::regprocedure))
  ) > 0
  and position(
    'least('
    in lower(pg_get_functiondef('public.apply_network_commission_on_monetization()'::regprocedure))
  ) > 0;
$$;

revoke all on function public.release_stacked_incentive_budget_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_stacked_incentive_budget_contract()
  to service_role;

do $$
begin
  if not public.release_stacked_incentive_budget_contract() then
    raise exception 'stacked incentive budget contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'stacked incentive budget authority requires canonical release schema v55';
  end if;
end
$$;
