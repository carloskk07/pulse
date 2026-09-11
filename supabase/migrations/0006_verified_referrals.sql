-- Verified, single-inviter referral loop with automatic provider-confirmed rewards.

alter table public.profiles add column if not exists referral_code text;
update public.profiles
set referral_code = encode(gen_random_bytes(8), 'hex')
where referral_code is null;
create unique index if not exists profiles_referral_code_unique_idx on public.profiles(referral_code);
alter table public.profiles alter column referral_code set default encode(gen_random_bytes(8), 'hex');
alter table public.profiles alter column referral_code set not null;

alter table public.monetization_events
add column if not exists original_event_id uuid references public.monetization_events(id);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  source_code text not null,
  status text not null default 'pending' check (status in ('pending','rewarded','reversed','rejected')),
  qualifying_conversion_id uuid unique references public.monetization_events(id),
  inviter_reward_credits bigint not null default 0,
  invitee_reward_credits bigint not null default 0,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  reversed_at timestamptz,
  unique (invitee_id),
  check (inviter_id <> invitee_id)
);

create index if not exists referrals_inviter_status_idx on public.referrals(inviter_id, status);
alter table public.referrals enable row level security;
create policy "referrals_read_participant" on public.referrals
for select using (auth.uid() = inviter_id or auth.uid() = invitee_id);

insert into public.app_config(key, value, version, reason)
values ('referral_reward', '{"inviter_credits":100,"invitee_credits":50}'::jsonb, 1, 'Verified referral reward after first confirmed conversion')
on conflict (key) do nothing;

create or replace function public.bind_referral(p_invitee_id uuid, p_referral_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter_id uuid;
  v_code text := lower(trim(coalesce(p_referral_code, '')));
begin
  if v_code !~ '^[0-9a-f]{16}$' then
    return jsonb_build_object('status', 'invalid_code');
  end if;

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

  insert into public.referrals(inviter_id, invitee_id, source_code)
  values (v_inviter_id, p_invitee_id, v_code);

  return jsonb_build_object('status', 'bound', 'inviter_id', v_inviter_id);
end;
$$;

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
    values (
      v_ref.inviter_id,
      'referral:inviter:' || v_ref.id::text,
      'referral',
      'available',
      v_inviter_reward,
      jsonb_build_object('referral_id', v_ref.id, 'role', 'inviter', 'qualifying_conversion_id', new.id)
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
      jsonb_build_object('referral_id', v_ref.id, 'role', 'invitee', 'qualifying_conversion_id', new.id)
    );
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

create or replace function public.reverse_referral_on_chargeback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals%rowtype;
begin
  if new.event_type <> 'chargeback' or new.original_event_id is null then return new; end if;

  select * into v_ref
  from public.referrals
  where qualifying_conversion_id = new.original_event_id and status = 'rewarded'
  for update;

  if not found then return new; end if;

  if v_ref.inviter_reward_credits > 0 then
    insert into public.ledger_entries(user_id, event_key, entry_type, state, credits, metadata)
    values (
      v_ref.inviter_id,
      'referral:inviter-reversal:' || v_ref.id::text,
      'referral',
      'available',
      -v_ref.inviter_reward_credits,
      jsonb_build_object('referral_id', v_ref.id, 'role', 'inviter_reversal', 'chargeback_event_id', new.id)
    );
  end if;

  if v_ref.invitee_reward_credits > 0 then
    insert into public.ledger_entries(user_id, event_key, entry_type, state, credits, metadata)
    values (
      v_ref.invitee_id,
      'referral:invitee-reversal:' || v_ref.id::text,
      'referral',
      'available',
      -v_ref.invitee_reward_credits,
      jsonb_build_object('referral_id', v_ref.id, 'role', 'invitee_reversal', 'chargeback_event_id', new.id)
    );
  end if;

  update public.referrals set status = 'reversed', reversed_at = now() where id = v_ref.id;
  return new;
end;
$$;

drop trigger if exists reward_referral_after_conversion on public.monetization_events;
create trigger reward_referral_after_conversion
after insert on public.monetization_events
for each row execute function public.reward_referral_on_conversion();

drop trigger if exists reverse_referral_after_chargeback on public.monetization_events;
create trigger reverse_referral_after_chargeback
after insert on public.monetization_events
for each row execute function public.reverse_referral_on_chargeback();

-- Replace callback application so chargebacks persist the exact original event id.
create or replace function public.apply_monetization_callback(
  p_provider text,
  p_external_id text,
  p_original_external_id text,
  p_user_id uuid,
  p_callback_type text,
  p_payout_usd_micros bigint,
  p_reward_credits bigint,
  p_occurred_at timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_callback_key text := p_callback_type || ':' || p_external_id;
  v_original_reward bigint;
  v_original_event_id uuid;
  v_original_user_id uuid;
  v_debit bigint;
begin
  if p_provider is null or p_external_id is null or p_callback_type not in ('conversion', 'chargeback') then
    return jsonb_build_object('status', 'invalid');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || v_callback_key, 0));

  if exists (select 1 from public.provider_callbacks where provider = p_provider and external_event_key = v_callback_key) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  if p_callback_type = 'chargeback' then
    select id, reward_credits, user_id into v_original_event_id, v_original_reward, v_original_user_id
    from public.monetization_events
    where provider = p_provider and external_id = p_original_external_id and event_type = 'conversion'
    limit 1;

    if not found then return jsonb_build_object('status', 'orphan_chargeback'); end if;
    v_debit := -abs(coalesce(v_original_reward, 0));

    insert into public.provider_callbacks(provider, external_event_key, payload_hash, processed_at)
    values (p_provider, v_callback_key, encode(digest(coalesce(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex'), now());

    insert into public.monetization_events(provider, external_id, user_id, event_type, status, payout_usd_micros, reward_credits, payload, occurred_at, original_event_id)
    values (p_provider, p_external_id, v_original_user_id, 'chargeback', 'reversed', p_payout_usd_micros, v_debit, coalesce(p_payload, '{}'::jsonb), p_occurred_at, v_original_event_id);

    insert into public.ledger_entries(user_id, event_key, entry_type, state, credits, usd_micros, metadata)
    values (v_original_user_id, p_provider || ':chargeback:' || p_external_id, 'chargeback', 'available', v_debit, p_payout_usd_micros,
      jsonb_build_object('provider', p_provider, 'transaction_id', p_external_id, 'original_transaction_id', p_original_external_id, 'original_event_id', v_original_event_id));

    return jsonb_build_object('status', 'reversed', 'credits', v_debit);
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then return jsonb_build_object('status', 'unknown_user'); end if;
  insert into public.profiles(id) values (p_user_id) on conflict (id) do nothing;
  if p_payout_usd_micros <= 0 or p_reward_credits <= 0 then return jsonb_build_object('status', 'invalid_amount'); end if;

  insert into public.provider_callbacks(provider, external_event_key, payload_hash, processed_at)
  values (p_provider, v_callback_key, encode(digest(coalesce(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex'), now());

  insert into public.monetization_events(provider, external_id, user_id, event_type, status, payout_usd_micros, reward_credits, payload, occurred_at)
  values (p_provider, p_external_id, p_user_id, 'conversion', 'confirmed', p_payout_usd_micros, p_reward_credits, coalesce(p_payload, '{}'::jsonb), p_occurred_at);

  insert into public.ledger_entries(user_id, event_key, entry_type, state, credits, usd_micros, metadata)
  values (p_user_id, p_provider || ':conversion:' || p_external_id, 'offer', 'available', p_reward_credits, p_payout_usd_micros,
    jsonb_build_object('provider', p_provider, 'transaction_id', p_external_id));

  return jsonb_build_object('status', 'credited', 'credits', p_reward_credits);
end;
$$;

revoke all on function public.bind_referral(uuid,text) from public, anon, authenticated;
grant execute on function public.bind_referral(uuid,text) to service_role;
revoke all on function public.reward_referral_on_conversion() from public, anon, authenticated;
revoke all on function public.reverse_referral_on_chargeback() from public, anon, authenticated;
