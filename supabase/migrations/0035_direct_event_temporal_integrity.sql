create or replace function public.settle_direct_campaign_completion(
  p_campaign_id uuid,
  p_session_id uuid,
  p_external_event_id text,
  p_secret text,
  p_payload jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_campaign public.direct_campaigns%rowtype;
  v_session public.direct_campaign_sessions%rowtype;
  v_direct_event_id uuid := gen_random_uuid();
  v_monetization_event_id uuid := gen_random_uuid();
  v_external_key text;
  v_next_spent bigint;
  v_next_reserved bigint;
  v_next_count integer;
  v_unspent_total bigint;
  v_effective_occurred_at timestamptz := coalesce(p_occurred_at, now());
begin
  if p_campaign_id is null
     or p_session_id is null
     or coalesce(trim(p_external_event_id), '') = ''
     or length(p_external_event_id) > 200
     or coalesce(trim(p_secret), '') = '' then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('direct-campaign:' || p_campaign_id::text, 0));

  select * into v_campaign
  from public.direct_campaigns
  where id = p_campaign_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_campaign.webhook_secret_hash <> encode(extensions.digest(trim(p_secret), 'sha256'), 'hex') then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  select * into v_session
  from public.direct_campaign_sessions
  where id = p_session_id and campaign_id = p_campaign_id
  for update;

  if not found then
    return jsonb_build_object('status', 'unknown_session');
  end if;

  if v_session.status = 'confirmed' then
    if v_session.external_event_id = trim(p_external_event_id) then
      return jsonb_build_object('status', 'idempotent', 'reward_credits', v_campaign.reward_credits);
    end if;
    return jsonb_build_object('status', 'session_already_settled');
  end if;

  if v_session.status <> 'reserved' then
    return jsonb_build_object('status', 'session_not_reserved');
  end if;

  if v_session.expires_at <= now() then
    update public.direct_campaign_sessions
    set status = 'expired', updated_at = now()
    where id = v_session.id;

    update public.direct_campaigns
    set reserved_usd_micros = greatest(0, reserved_usd_micros - v_session.reserved_usd_micros),
        updated_at = now()
    where id = p_campaign_id;

    return jsonb_build_object('status', 'session_expired');
  end if;

  -- Provider timestamps are evidence, not authority. A Direct event must belong
  -- causally to the live reservation that is about to be settled. Five minutes
  -- of tolerance covers modest clock skew without admitting arbitrary history or
  -- future-dated conversions into authoritative monetization tables.
  if v_effective_occurred_at < v_session.created_at - interval '5 minutes'
     or v_effective_occurred_at > now() + interval '5 minutes'
     or v_effective_occurred_at > v_session.expires_at + interval '5 minutes' then
    return jsonb_build_object('status', 'invalid_occurred_at');
  end if;

  if exists (
    select 1
    from public.direct_campaign_events
    where campaign_id = p_campaign_id
      and external_event_id = trim(p_external_event_id)
  ) then
    return jsonb_build_object('status', 'duplicate_event');
  end if;

  v_next_spent := v_campaign.spent_usd_micros + v_session.reserved_usd_micros;
  v_next_reserved := greatest(0, v_campaign.reserved_usd_micros - v_session.reserved_usd_micros);
  v_next_count := v_campaign.completion_count + 1;
  v_unspent_total := v_campaign.funded_usd_micros - v_next_spent;
  v_external_key := p_campaign_id::text || ':' || trim(p_external_event_id);

  insert into public.monetization_events(
    id, provider, external_id, user_id, event_type, status,
    payout_usd_micros, reward_credits, payload, occurred_at
  ) values (
    v_monetization_event_id,
    'pulse_direct',
    v_external_key,
    v_session.user_id,
    'conversion',
    'confirmed',
    v_session.reserved_usd_micros,
    v_campaign.reward_credits,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('campaign_id', p_campaign_id, 'session_id', p_session_id),
    v_effective_occurred_at
  );

  insert into public.ledger_entries(
    user_id, event_key, entry_type, state, credits, usd_micros, metadata
  ) values (
    v_session.user_id,
    'pulse_direct:conversion:' || v_external_key,
    'offer',
    'available',
    v_campaign.reward_credits,
    v_session.reserved_usd_micros,
    jsonb_build_object(
      'provider', 'pulse_direct',
      'campaign_id', p_campaign_id,
      'session_id', p_session_id,
      'external_event_id', trim(p_external_event_id),
      'pulse_protected', true
    )
  );

  insert into public.direct_campaign_events(
    id, campaign_id, session_id, user_id, external_event_id,
    payout_usd_micros, reward_credits, monetization_event_id, payload, occurred_at
  ) values (
    v_direct_event_id,
    p_campaign_id,
    p_session_id,
    v_session.user_id,
    trim(p_external_event_id),
    v_session.reserved_usd_micros,
    v_campaign.reward_credits,
    v_monetization_event_id,
    coalesce(p_payload, '{}'::jsonb),
    v_effective_occurred_at
  );

  update public.direct_campaign_sessions
  set status = 'confirmed',
      external_event_id = trim(p_external_event_id),
      confirmed_at = now(),
      updated_at = now()
  where id = p_session_id;

  update public.direct_campaigns
  set spent_usd_micros = v_next_spent,
      reserved_usd_micros = v_next_reserved,
      completion_count = v_next_count,
      status = case
        when v_next_count >= max_completions or v_unspent_total < price_per_action_usd_micros then 'exhausted'
        else status
      end,
      updated_at = now()
  where id = p_campaign_id;

  if v_next_count >= v_campaign.max_completions
     or v_unspent_total < v_campaign.price_per_action_usd_micros then
    update public.reward_opportunities
    set status = 'paused', health_state = 'hidden', updated_at = now()
    where provider = 'pulse_direct' and external_id = p_campaign_id::text;
  end if;

  return jsonb_build_object(
    'status', 'credited',
    'campaign_id', p_campaign_id,
    'session_id', p_session_id,
    'reward_credits', v_campaign.reward_credits,
    'advertiser_spend_usd_micros', v_session.reserved_usd_micros,
    'gross_contribution_usd_micros', v_session.reserved_usd_micros - (v_campaign.reward_credits * 1000)
  );
end;
$$;

revoke all on function public.settle_direct_campaign_completion(uuid,uuid,text,text,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.settle_direct_campaign_completion(uuid,uuid,text,text,jsonb,timestamptz) to service_role;

create or replace function public.release_pulse_direct_contract()
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select
    to_regclass('public.direct_campaigns') is not null
    and to_regclass('public.direct_campaign_funding') is not null
    and to_regclass('public.direct_campaign_sessions') is not null
    and to_regclass('public.direct_campaign_events') is not null
    and to_regclass('public.direct_campaign_funding_reference_unique_idx') is not null
    and coalesce((select relrowsecurity from pg_class where oid = 'public.direct_campaigns'::regclass), false)
    and coalesce((select relrowsecurity from pg_class where oid = 'public.direct_campaign_funding'::regclass), false)
    and coalesce((select relrowsecurity from pg_class where oid = 'public.direct_campaign_sessions'::regclass), false)
    and coalesce((select relrowsecurity from pg_class where oid = 'public.direct_campaign_events'::regclass), false)
    and not has_table_privilege('anon', 'public.direct_campaigns', 'SELECT')
    and not has_table_privilege('authenticated', 'public.direct_campaigns', 'SELECT')
    and not has_table_privilege('anon', 'public.direct_campaign_sessions', 'SELECT')
    and not has_table_privilege('authenticated', 'public.direct_campaign_sessions', 'SELECT')
    and not has_function_privilege('authenticated', 'public.settle_direct_campaign_completion(uuid,uuid,text,text,jsonb,timestamptz)', 'EXECUTE')
    and position('invalid_occurred_at' in pg_get_functiondef('public.settle_direct_campaign_completion(uuid,uuid,text,text,jsonb,timestamptz)'::regprocedure)) > 0
    and position('v_session.created_at' in pg_get_functiondef('public.settle_direct_campaign_completion(uuid,uuid,text,text,jsonb,timestamptz)'::regprocedure)) > 0
    and position('v_session.expires_at' in pg_get_functiondef('public.settle_direct_campaign_completion(uuid,uuid,text,text,jsonb,timestamptz)'::regprocedure)) > 0
    and position('v_effective_occurred_at' in pg_get_functiondef('public.settle_direct_campaign_completion(uuid,uuid,text,text,jsonb,timestamptz)'::regprocedure)) > 0;
$$;

revoke all on function public.release_pulse_direct_contract() from public, anon, authenticated;
grant execute on function public.release_pulse_direct_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 35, 'migration', '0035_direct_event_temporal_integrity.sql'),
  35,
  'Pulse Direct settlement accepts only provider timestamps causally bound to the live reserved session'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
