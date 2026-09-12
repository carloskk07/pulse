-- Pulse Direct crypto schema fix
-- Supabase installs pgcrypto helpers in the extensions schema. Keep search_path locked to public
-- and qualify only the required cryptographic functions explicitly.

create or replace function public.create_direct_campaign(
  p_advertiser_name text,
  p_title text,
  p_description text,
  p_category text,
  p_action_type text,
  p_destination_url text,
  p_price_per_action_usd_micros bigint,
  p_reward_credits bigint,
  p_max_completions integer,
  p_country_codes text[] default '{}',
  p_device_platforms text[] default '{}',
  p_estimated_minutes integer default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid := gen_random_uuid();
  v_secret text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if coalesce(trim(p_advertiser_name), '') = ''
     or coalesce(trim(p_title), '') = ''
     or p_action_type not in ('install','signup','trial','purchase','survey','milestone','custom')
     or coalesce(trim(p_destination_url), '') !~ '^https://'
     or p_price_per_action_usd_micros is null or p_price_per_action_usd_micros <= 0
     or p_reward_credits is null or p_reward_credits <= 0
     or p_max_completions is null or p_max_completions <= 0
     or p_price_per_action_usd_micros < p_reward_credits * 1000
     or (p_estimated_minutes is not null and p_estimated_minutes <= 0)
     or (p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at) then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  insert into public.direct_campaigns(
    id, advertiser_name, title, description, category, action_type, destination_url,
    price_per_action_usd_micros, reward_credits, max_completions,
    country_codes, device_platforms, estimated_minutes, starts_at, ends_at, webhook_secret_hash
  ) values (
    v_campaign_id, trim(p_advertiser_name), trim(p_title), coalesce(p_description, ''), coalesce(nullif(trim(p_category), ''), 'other'),
    p_action_type, trim(p_destination_url), p_price_per_action_usd_micros, p_reward_credits, p_max_completions,
    coalesce(p_country_codes, '{}'), coalesce(p_device_platforms, '{}'), p_estimated_minutes, p_starts_at, p_ends_at,
    encode(extensions.digest(v_secret, 'sha256'), 'hex')
  );

  return jsonb_build_object(
    'status', 'created',
    'campaign_id', v_campaign_id,
    'callback_secret', v_secret,
    'callback_secret_note', 'Shown once. Store it with the advertiser integration.'
  );
end;
$$;

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
set search_path = public
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
  v_remaining bigint;
begin
  if p_campaign_id is null or p_session_id is null or coalesce(trim(p_external_event_id), '') = ''
     or length(p_external_event_id) > 200 or coalesce(trim(p_secret), '') = '' then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('direct-campaign:' || p_campaign_id::text, 0));
  select * into v_campaign from public.direct_campaigns where id = p_campaign_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;

  if v_campaign.webhook_secret_hash <> encode(extensions.digest(trim(p_secret), 'sha256'), 'hex') then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  select * into v_session
  from public.direct_campaign_sessions
  where id = p_session_id and campaign_id = p_campaign_id
  for update;
  if not found then return jsonb_build_object('status', 'unknown_session'); end if;

  if v_session.status = 'confirmed' then
    if v_session.external_event_id = trim(p_external_event_id) then
      return jsonb_build_object('status', 'idempotent', 'reward_credits', v_campaign.reward_credits);
    end if;
    return jsonb_build_object('status', 'session_already_settled');
  end if;

  if v_session.status <> 'reserved' then return jsonb_build_object('status', 'session_not_reserved'); end if;

  if v_session.expires_at <= now() then
    update public.direct_campaign_sessions set status = 'expired', updated_at = now() where id = v_session.id;
    update public.direct_campaigns
      set reserved_usd_micros = greatest(0, reserved_usd_micros - v_session.reserved_usd_micros), updated_at = now()
      where id = p_campaign_id;
    return jsonb_build_object('status', 'session_expired');
  end if;

  if exists (
    select 1 from public.direct_campaign_events
    where campaign_id = p_campaign_id and external_event_id = trim(p_external_event_id)
  ) then
    return jsonb_build_object('status', 'duplicate_event');
  end if;

  v_next_spent := v_campaign.spent_usd_micros + v_session.reserved_usd_micros;
  v_next_reserved := greatest(0, v_campaign.reserved_usd_micros - v_session.reserved_usd_micros);
  v_next_count := v_campaign.completion_count + 1;
  v_remaining := v_campaign.funded_usd_micros - v_next_spent - v_next_reserved;
  v_external_key := p_campaign_id::text || ':' || trim(p_external_event_id);

  insert into public.monetization_events(
    id, provider, external_id, user_id, event_type, status,
    payout_usd_micros, reward_credits, payload, occurred_at
  ) values (
    v_monetization_event_id, 'pulse_direct', v_external_key, v_session.user_id,
    'conversion', 'confirmed', v_session.reserved_usd_micros, v_campaign.reward_credits,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('campaign_id', p_campaign_id, 'session_id', p_session_id),
    coalesce(p_occurred_at, now())
  );

  insert into public.ledger_entries(user_id, event_key, entry_type, state, credits, usd_micros, metadata)
  values (
    v_session.user_id,
    'pulse_direct:conversion:' || v_external_key,
    'offer',
    'available',
    v_campaign.reward_credits,
    v_session.reserved_usd_micros,
    jsonb_build_object('provider', 'pulse_direct', 'campaign_id', p_campaign_id, 'session_id', p_session_id, 'external_event_id', trim(p_external_event_id), 'pulse_protected', true)
  );

  insert into public.direct_campaign_events(
    id, campaign_id, session_id, user_id, external_event_id, payout_usd_micros,
    reward_credits, monetization_event_id, payload, occurred_at
  ) values (
    v_direct_event_id, p_campaign_id, p_session_id, v_session.user_id, trim(p_external_event_id),
    v_session.reserved_usd_micros, v_campaign.reward_credits, v_monetization_event_id,
    coalesce(p_payload, '{}'::jsonb), coalesce(p_occurred_at, now())
  );

  update public.direct_campaign_sessions
  set status = 'confirmed', external_event_id = trim(p_external_event_id), confirmed_at = now(), updated_at = now()
  where id = p_session_id;

  update public.direct_campaigns
  set spent_usd_micros = v_next_spent,
      reserved_usd_micros = v_next_reserved,
      completion_count = v_next_count,
      status = case
        when v_next_count >= max_completions or v_remaining < price_per_action_usd_micros then 'exhausted'
        else status
      end,
      updated_at = now()
  where id = p_campaign_id;

  if v_next_count >= v_campaign.max_completions or v_remaining < v_campaign.price_per_action_usd_micros then
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

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 14, 'migration', '0014_pulse_direct_crypto_fix.sql'),
  14,
  'Pulse Direct cryptographic function qualification for Supabase extensions schema'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
