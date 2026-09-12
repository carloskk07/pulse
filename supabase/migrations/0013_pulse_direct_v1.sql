-- Pulse Direct v1
-- Prefunded, operator-controlled campaigns with reserved user sessions and atomic settlement.
-- Providers remain available as backfill; direct campaigns never depend on client-side balance writes.

create table if not exists public.direct_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_name text not null check (length(trim(advertiser_name)) between 1 and 160),
  title text not null check (length(trim(title)) between 1 and 180),
  description text not null default '',
  category text not null default 'other',
  action_type text not null check (action_type in ('install','signup','trial','purchase','survey','milestone','custom')),
  destination_url text not null check (destination_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft','active','paused','exhausted','completed','cancelled')),
  funded_usd_micros bigint not null default 0 check (funded_usd_micros >= 0),
  reserved_usd_micros bigint not null default 0 check (reserved_usd_micros >= 0),
  spent_usd_micros bigint not null default 0 check (spent_usd_micros >= 0),
  price_per_action_usd_micros bigint not null check (price_per_action_usd_micros > 0),
  reward_credits bigint not null check (reward_credits > 0),
  max_completions integer not null check (max_completions > 0),
  completion_count integer not null default 0 check (completion_count >= 0),
  country_codes text[] not null default '{}',
  device_platforms text[] not null default '{}',
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  webhook_secret_hash text not null,
  opportunity_id uuid references public.reward_opportunities(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (spent_usd_micros + reserved_usd_micros <= funded_usd_micros),
  check (price_per_action_usd_micros >= reward_credits * 1000),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.direct_campaign_funding (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.direct_campaigns(id) on delete restrict,
  amount_usd_micros bigint not null check (amount_usd_micros > 0),
  funding_reference text not null check (length(trim(funding_reference)) between 1 and 240),
  created_at timestamptz not null default now()
);

create table if not exists public.direct_campaign_sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.direct_campaigns(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'reserved' check (status in ('reserved','confirmed','released','expired')),
  reserved_usd_micros bigint not null check (reserved_usd_micros > 0),
  external_event_id text,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create table if not exists public.direct_campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.direct_campaigns(id) on delete restrict,
  session_id uuid not null references public.direct_campaign_sessions(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  external_event_id text not null,
  status text not null default 'confirmed' check (status in ('confirmed','reversed')),
  payout_usd_micros bigint not null check (payout_usd_micros > 0),
  reward_credits bigint not null check (reward_credits > 0),
  monetization_event_id uuid unique references public.monetization_events(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, external_event_id),
  unique (session_id)
);

create index if not exists direct_campaigns_status_idx on public.direct_campaigns(status, updated_at desc);
create index if not exists direct_campaign_sessions_campaign_status_idx on public.direct_campaign_sessions(campaign_id, status, expires_at);
create index if not exists direct_campaign_sessions_user_idx on public.direct_campaign_sessions(user_id, created_at desc);
create index if not exists direct_campaign_events_campaign_created_idx on public.direct_campaign_events(campaign_id, created_at desc);
create index if not exists direct_campaign_funding_campaign_created_idx on public.direct_campaign_funding(campaign_id, created_at desc);

alter table public.direct_campaigns enable row level security;
alter table public.direct_campaign_funding enable row level security;
alter table public.direct_campaign_sessions enable row level security;
alter table public.direct_campaign_events enable row level security;

revoke all on table public.direct_campaigns from public, anon, authenticated;
revoke all on table public.direct_campaign_funding from public, anon, authenticated;
revoke all on table public.direct_campaign_sessions from public, anon, authenticated;
revoke all on table public.direct_campaign_events from public, anon, authenticated;

grant select, insert, update, delete on table public.direct_campaigns to service_role;
grant select, insert, update, delete on table public.direct_campaign_funding to service_role;
grant select, insert, update, delete on table public.direct_campaign_sessions to service_role;
grant select, insert, update, delete on table public.direct_campaign_events to service_role;

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
  v_secret text := encode(gen_random_bytes(32), 'hex');
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
    encode(digest(v_secret, 'sha256'), 'hex')
  );

  return jsonb_build_object(
    'status', 'created',
    'campaign_id', v_campaign_id,
    'callback_secret', v_secret,
    'callback_secret_note', 'Shown once. Store it with the advertiser integration.'
  );
end;
$$;

create or replace function public.fund_direct_campaign(
  p_campaign_id uuid,
  p_amount_usd_micros bigint,
  p_funding_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.direct_campaigns%rowtype;
begin
  if p_campaign_id is null or p_amount_usd_micros is null or p_amount_usd_micros <= 0
     or coalesce(trim(p_funding_reference), '') = '' then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select * into v_campaign from public.direct_campaigns where id = p_campaign_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if v_campaign.status in ('completed','cancelled') then return jsonb_build_object('status', 'campaign_closed'); end if;

  insert into public.direct_campaign_funding(campaign_id, amount_usd_micros, funding_reference)
  values (p_campaign_id, p_amount_usd_micros, trim(p_funding_reference));

  update public.direct_campaigns
  set funded_usd_micros = funded_usd_micros + p_amount_usd_micros,
      updated_at = now()
  where id = p_campaign_id;

  return jsonb_build_object(
    'status', 'funded',
    'campaign_id', p_campaign_id,
    'funded_usd_micros', v_campaign.funded_usd_micros + p_amount_usd_micros
  );
end;
$$;

create or replace function public.activate_direct_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.direct_campaigns%rowtype;
  v_opportunity_id uuid;
begin
  select * into v_campaign from public.direct_campaigns where id = p_campaign_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if v_campaign.status in ('completed','cancelled') then return jsonb_build_object('status', 'campaign_closed'); end if;
  if v_campaign.funded_usd_micros - v_campaign.spent_usd_micros - v_campaign.reserved_usd_micros < v_campaign.price_per_action_usd_micros then
    return jsonb_build_object('status', 'insufficient_funding');
  end if;
  if v_campaign.completion_count >= v_campaign.max_completions then
    return jsonb_build_object('status', 'completion_cap_reached');
  end if;
  if v_campaign.ends_at is not null and v_campaign.ends_at <= now() then
    return jsonb_build_object('status', 'campaign_ended');
  end if;

  insert into public.reward_opportunities(
    provider, external_id, title, category, payout_usd_micros, base_reward_credits,
    estimated_minutes, country_codes, device_platforms, status, metadata,
    source_type, evidence_tier, health_state, freshness_ttl_minutes, verified_at, expires_at, refreshed_at, updated_at
  ) values (
    'pulse_direct', v_campaign.id::text, v_campaign.title, v_campaign.category,
    v_campaign.price_per_action_usd_micros, v_campaign.reward_credits,
    v_campaign.estimated_minutes, v_campaign.country_codes, v_campaign.device_platforms, 'active',
    jsonb_build_object('direct_campaign_id', v_campaign.id, 'action_type', v_campaign.action_type, 'pulse_protected', true),
    'direct', 'new', 'good', 1440, now(), v_campaign.ends_at, now(), now()
  )
  on conflict (provider, external_id) do update
  set title = excluded.title,
      category = excluded.category,
      payout_usd_micros = excluded.payout_usd_micros,
      base_reward_credits = excluded.base_reward_credits,
      estimated_minutes = excluded.estimated_minutes,
      country_codes = excluded.country_codes,
      device_platforms = excluded.device_platforms,
      status = 'active',
      metadata = excluded.metadata,
      source_type = 'direct',
      health_state = 'good',
      expires_at = excluded.expires_at,
      refreshed_at = now(),
      updated_at = now()
  returning id into v_opportunity_id;

  update public.direct_campaigns
  set status = 'active', opportunity_id = v_opportunity_id, updated_at = now()
  where id = p_campaign_id;

  return jsonb_build_object('status', 'active', 'campaign_id', p_campaign_id, 'opportunity_id', v_opportunity_id);
end;
$$;

create or replace function public.pause_direct_campaign(p_campaign_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.direct_campaigns%rowtype;
begin
  select * into v_campaign from public.direct_campaigns where id = p_campaign_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if v_campaign.status in ('completed','cancelled') then return jsonb_build_object('status', 'campaign_closed'); end if;

  update public.direct_campaigns set status = 'paused', updated_at = now() where id = p_campaign_id;
  update public.reward_opportunities
  set status = 'paused', health_state = 'hidden', updated_at = now()
  where provider = 'pulse_direct' and external_id = p_campaign_id::text;

  return jsonb_build_object('status', 'paused', 'campaign_id', p_campaign_id, 'reason', nullif(trim(coalesce(p_reason, '')), ''));
end;
$$;

create or replace function public.release_expired_direct_campaign_reservations(p_campaign_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released_count integer := 0;
  v_released_micros bigint := 0;
  v_row record;
begin
  for v_row in
    with expired as (
      update public.direct_campaign_sessions
      set status = 'expired', updated_at = now()
      where status = 'reserved'
        and expires_at <= now()
        and (p_campaign_id is null or campaign_id = p_campaign_id)
      returning campaign_id, reserved_usd_micros
    )
    select campaign_id, count(*)::integer as released_count, sum(reserved_usd_micros)::bigint as released_micros
    from expired
    group by campaign_id
  loop
    update public.direct_campaigns
    set reserved_usd_micros = greatest(0, reserved_usd_micros - v_row.released_micros),
        updated_at = now()
    where id = v_row.campaign_id;
    v_released_count := v_released_count + v_row.released_count;
    v_released_micros := v_released_micros + v_row.released_micros;
  end loop;

  return jsonb_build_object('status', 'ok', 'released_count', v_released_count, 'released_usd_micros', v_released_micros);
end;
$$;

create or replace function public.start_direct_campaign_session(
  p_campaign_id uuid,
  p_user_id uuid,
  p_ttl_minutes integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.direct_campaigns%rowtype;
  v_session public.direct_campaign_sessions%rowtype;
  v_session_id uuid := gen_random_uuid();
  v_available bigint := 0;
  v_ttl integer := greatest(5, least(coalesce(p_ttl_minutes, 60), 1440));
begin
  if p_campaign_id is null or p_user_id is null then return jsonb_build_object('status', 'invalid_request'); end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then return jsonb_build_object('status', 'unknown_user'); end if;

  perform pg_advisory_xact_lock(hashtextextended('direct-campaign:' || p_campaign_id::text, 0));
  perform public.release_expired_direct_campaign_reservations(p_campaign_id);

  select * into v_campaign from public.direct_campaigns where id = p_campaign_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if v_campaign.status <> 'active' then return jsonb_build_object('status', 'campaign_not_active'); end if;
  if v_campaign.starts_at is not null and now() < v_campaign.starts_at then return jsonb_build_object('status', 'not_started'); end if;
  if v_campaign.ends_at is not null and now() >= v_campaign.ends_at then
    update public.direct_campaigns set status = 'completed', updated_at = now() where id = p_campaign_id;
    update public.reward_opportunities set status = 'expired', health_state = 'hidden', updated_at = now()
      where provider = 'pulse_direct' and external_id = p_campaign_id::text;
    return jsonb_build_object('status', 'campaign_ended');
  end if;
  if v_campaign.completion_count >= v_campaign.max_completions then return jsonb_build_object('status', 'completion_cap_reached'); end if;

  select * into v_session
  from public.direct_campaign_sessions
  where campaign_id = p_campaign_id and user_id = p_user_id
  for update;

  if found and v_session.status = 'confirmed' then
    return jsonb_build_object('status', 'already_completed');
  end if;

  if found and v_session.status = 'reserved' and v_session.expires_at > now() then
    return jsonb_build_object(
      'status', 'idempotent',
      'session_id', v_session.id,
      'destination_url', v_campaign.destination_url,
      'reward_credits', v_campaign.reward_credits,
      'expires_at', v_session.expires_at,
      'pulse_protected', true
    );
  end if;

  v_available := v_campaign.funded_usd_micros - v_campaign.spent_usd_micros - v_campaign.reserved_usd_micros;
  if v_available < v_campaign.price_per_action_usd_micros then
    update public.direct_campaigns set status = 'exhausted', updated_at = now() where id = p_campaign_id;
    update public.reward_opportunities set status = 'paused', health_state = 'hidden', updated_at = now()
      where provider = 'pulse_direct' and external_id = p_campaign_id::text;
    return jsonb_build_object('status', 'campaign_exhausted');
  end if;

  if found then
    update public.direct_campaign_sessions
    set status = 'reserved',
        reserved_usd_micros = v_campaign.price_per_action_usd_micros,
        external_event_id = null,
        expires_at = now() + make_interval(mins => v_ttl),
        confirmed_at = null,
        updated_at = now()
    where id = v_session.id
    returning * into v_session;
    v_session_id := v_session.id;
  else
    insert into public.direct_campaign_sessions(id, campaign_id, user_id, reserved_usd_micros, expires_at)
    values (v_session_id, p_campaign_id, p_user_id, v_campaign.price_per_action_usd_micros, now() + make_interval(mins => v_ttl))
    returning * into v_session;
  end if;

  update public.direct_campaigns
  set reserved_usd_micros = reserved_usd_micros + v_campaign.price_per_action_usd_micros,
      updated_at = now()
  where id = p_campaign_id;

  return jsonb_build_object(
    'status', 'reserved',
    'session_id', v_session_id,
    'destination_url', v_campaign.destination_url,
    'reward_credits', v_campaign.reward_credits,
    'expires_at', v_session.expires_at,
    'pulse_protected', true
  );
end;
$$;

-- Pulse Direct does not automatically trigger the legacy referral subsidy.
-- Referral rewards remain provider-backed until a unified liability authority funds them.
create or replace function public.reward_referral_on_conversion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals%rowtype;
  v_config jsonb;
  v_inviter_reward bigint := 100;
  v_invitee_reward bigint := 50;
begin
  if new.event_type <> 'conversion' or new.status <> 'confirmed' then return new; end if;
  if new.provider = 'pulse_direct' then return new; end if;

  select * into v_ref
  from public.referrals
  where invitee_id = new.user_id and status = 'pending'
  for update;

  if not found then return new; end if;

  select value into v_config from public.app_config where key = 'referral_reward';
  v_inviter_reward := coalesce((v_config->>'inviter_credits')::bigint, 100);
  v_invitee_reward := coalesce((v_config->>'invitee_credits')::bigint, 50);

  if v_inviter_reward > 0 then
    insert into public.ledger_entries(user_id, event_key, entry_type, state, credits, metadata)
    values (v_ref.inviter_id, 'referral:inviter:' || v_ref.id::text, 'referral', 'available', v_inviter_reward,
      jsonb_build_object('referral_id', v_ref.id, 'role', 'inviter', 'qualifying_conversion_id', new.id));
  end if;

  if v_invitee_reward > 0 then
    insert into public.ledger_entries(user_id, event_key, entry_type, state, credits, metadata)
    values (v_ref.invitee_id, 'referral:invitee:' || v_ref.id::text, 'referral', 'available', v_invitee_reward,
      jsonb_build_object('referral_id', v_ref.id, 'role', 'invitee', 'qualifying_conversion_id', new.id));
  end if;

  update public.referrals
  set status = 'rewarded', qualifying_conversion_id = new.id,
      inviter_reward_credits = v_inviter_reward,
      invitee_reward_credits = v_invitee_reward,
      rewarded_at = now()
  where id = v_ref.id;

  return new;
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

  if v_campaign.webhook_secret_hash <> encode(digest(trim(p_secret), 'sha256'), 'hex') then
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

create or replace function public.reverse_direct_campaign_completion(
  p_campaign_id uuid,
  p_external_event_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.direct_campaigns%rowtype;
  v_event public.direct_campaign_events%rowtype;
  v_chargeback_id uuid := gen_random_uuid();
  v_external_key text;
begin
  if p_campaign_id is null or coalesce(trim(p_external_event_id), '') = '' or coalesce(trim(p_reason), '') = '' then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('direct-campaign:' || p_campaign_id::text, 0));
  select * into v_campaign from public.direct_campaigns where id = p_campaign_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;

  select * into v_event
  from public.direct_campaign_events
  where campaign_id = p_campaign_id and external_event_id = trim(p_external_event_id)
  for update;
  if not found then return jsonb_build_object('status', 'event_not_found'); end if;
  if v_event.status = 'reversed' then return jsonb_build_object('status', 'idempotent'); end if;

  v_external_key := p_campaign_id::text || ':' || trim(p_external_event_id);

  insert into public.monetization_events(
    id, provider, external_id, user_id, event_type, status,
    payout_usd_micros, reward_credits, payload, occurred_at, original_event_id
  ) values (
    v_chargeback_id, 'pulse_direct', v_external_key, v_event.user_id, 'chargeback', 'reversed',
    -abs(v_event.payout_usd_micros), -abs(v_event.reward_credits),
    jsonb_build_object('campaign_id', p_campaign_id, 'reason', trim(p_reason)), now(), v_event.monetization_event_id
  );

  insert into public.ledger_entries(user_id, event_key, entry_type, state, credits, usd_micros, metadata)
  values (
    v_event.user_id,
    'pulse_direct:chargeback:' || v_external_key,
    'chargeback',
    'available',
    -abs(v_event.reward_credits),
    -abs(v_event.payout_usd_micros),
    jsonb_build_object('provider', 'pulse_direct', 'campaign_id', p_campaign_id, 'external_event_id', trim(p_external_event_id), 'reason', trim(p_reason))
  );

  update public.direct_campaign_events set status = 'reversed', reversed_at = now() where id = v_event.id;
  update public.direct_campaigns
  set spent_usd_micros = greatest(0, spent_usd_micros - v_event.payout_usd_micros),
      completion_count = greatest(0, completion_count - 1),
      status = case when status = 'exhausted' then 'paused' else status end,
      updated_at = now()
  where id = p_campaign_id;
  update public.reward_opportunities
  set status = 'paused', health_state = 'hidden', updated_at = now()
  where provider = 'pulse_direct' and external_id = p_campaign_id::text;

  return jsonb_build_object('status', 'reversed', 'campaign_id', p_campaign_id, 'external_event_id', trim(p_external_event_id));
end;
$$;

create or replace function public.direct_campaign_snapshot()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'status', 'ok',
    'campaign_count', count(*),
    'active_count', count(*) filter (where status = 'active'),
    'funded_usd_micros', coalesce(sum(funded_usd_micros), 0),
    'reserved_usd_micros', coalesce(sum(reserved_usd_micros), 0),
    'spent_usd_micros', coalesce(sum(spent_usd_micros), 0),
    'gross_contribution_usd_micros', coalesce(sum(spent_usd_micros - (completion_count::bigint * reward_credits * 1000)), 0),
    'campaigns', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'advertiser_name', advertiser_name,
        'title', title,
        'action_type', action_type,
        'status', status,
        'funded_usd_micros', funded_usd_micros,
        'reserved_usd_micros', reserved_usd_micros,
        'spent_usd_micros', spent_usd_micros,
        'price_per_action_usd_micros', price_per_action_usd_micros,
        'reward_credits', reward_credits,
        'completion_count', completion_count,
        'max_completions', max_completions,
        'starts_at', starts_at,
        'ends_at', ends_at
      ) order by created_at desc
    ), '[]'::jsonb)
  )
  from public.direct_campaigns;
$$;

create or replace function public.release_pulse_direct_contract()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    to_regclass('public.direct_campaigns') is not null
    and to_regclass('public.direct_campaign_funding') is not null
    and to_regclass('public.direct_campaign_sessions') is not null
    and to_regclass('public.direct_campaign_events') is not null
    and coalesce((select relrowsecurity from pg_class where oid = 'public.direct_campaigns'::regclass), false)
    and coalesce((select relrowsecurity from pg_class where oid = 'public.direct_campaign_funding'::regclass), false)
    and coalesce((select relrowsecurity from pg_class where oid = 'public.direct_campaign_sessions'::regclass), false)
    and coalesce((select relrowsecurity from pg_class where oid = 'public.direct_campaign_events'::regclass), false)
    and not has_table_privilege('anon', 'public.direct_campaigns', 'SELECT')
    and not has_table_privilege('authenticated', 'public.direct_campaigns', 'SELECT')
    and not has_table_privilege('anon', 'public.direct_campaign_sessions', 'SELECT')
    and not has_table_privilege('authenticated', 'public.direct_campaign_sessions', 'SELECT')
    and not has_function_privilege('authenticated', 'public.settle_direct_campaign_completion(uuid,uuid,text,text,jsonb,timestamptz)', 'EXECUTE');
$$;

revoke all on function public.create_direct_campaign(text,text,text,text,text,text,bigint,bigint,integer,text[],text[],integer,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.fund_direct_campaign(uuid,bigint,text) from public, anon, authenticated;
revoke all on function public.activate_direct_campaign(uuid) from public, anon, authenticated;
revoke all on function public.pause_direct_campaign(uuid,text) from public, anon, authenticated;
revoke all on function public.release_expired_direct_campaign_reservations(uuid) from public, anon, authenticated;
revoke all on function public.start_direct_campaign_session(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.settle_direct_campaign_completion(uuid,uuid,text,text,jsonb,timestamptz) from public, anon, authenticated;
revoke all on function public.reverse_direct_campaign_completion(uuid,text,text) from public, anon, authenticated;
revoke all on function public.direct_campaign_snapshot() from public, anon, authenticated;
revoke all on function public.release_pulse_direct_contract() from public, anon, authenticated;

grant execute on function public.create_direct_campaign(text,text,text,text,text,text,bigint,bigint,integer,text[],text[],integer,timestamptz,timestamptz) to service_role;
grant execute on function public.fund_direct_campaign(uuid,bigint,text) to service_role;
grant execute on function public.activate_direct_campaign(uuid) to service_role;
grant execute on function public.pause_direct_campaign(uuid,text) to service_role;
grant execute on function public.release_expired_direct_campaign_reservations(uuid) to service_role;
grant execute on function public.start_direct_campaign_session(uuid,uuid,integer) to service_role;
grant execute on function public.settle_direct_campaign_completion(uuid,uuid,text,text,jsonb,timestamptz) to service_role;
grant execute on function public.reverse_direct_campaign_completion(uuid,text,text) to service_role;
grant execute on function public.direct_campaign_snapshot() to service_role;
grant execute on function public.release_pulse_direct_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 13, 'migration', '0013_pulse_direct_v1.sql'),
  13,
  'Prefunded Pulse Direct campaign authority with reserved sessions and atomic settlement'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
