-- Atomic provider conversion / chargeback application.

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

  if exists (
    select 1 from public.provider_callbacks
    where provider = p_provider and external_event_key = v_callback_key
  ) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  if p_callback_type = 'chargeback' then
    select id, reward_credits, user_id
      into v_original_event_id, v_original_reward, v_original_user_id
    from public.monetization_events
    where provider = p_provider
      and external_id = p_original_external_id
      and event_type = 'conversion'
    limit 1;

    if not found then
      return jsonb_build_object('status', 'orphan_chargeback');
    end if;

    v_debit := -abs(coalesce(v_original_reward, 0));

    insert into public.provider_callbacks(provider, external_event_key, payload_hash, processed_at)
    values (p_provider, v_callback_key, encode(digest(coalesce(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex'), now());

    insert into public.monetization_events(provider, external_id, user_id, event_type, status, payout_usd_micros, reward_credits, payload, occurred_at)
    values (p_provider, p_external_id, v_original_user_id, 'chargeback', 'reversed', p_payout_usd_micros, v_debit, coalesce(p_payload, '{}'::jsonb), p_occurred_at);

    insert into public.ledger_entries(user_id, event_key, entry_type, state, credits, usd_micros, metadata)
    values (
      v_original_user_id,
      p_provider || ':chargeback:' || p_external_id,
      'chargeback',
      'available',
      v_debit,
      p_payout_usd_micros,
      jsonb_build_object('provider', p_provider, 'transaction_id', p_external_id, 'original_transaction_id', p_original_external_id, 'original_event_id', v_original_event_id)
    );

    return jsonb_build_object('status', 'reversed', 'credits', v_debit);
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    return jsonb_build_object('status', 'unknown_user');
  end if;

  insert into public.profiles(id) values (p_user_id)
  on conflict (id) do nothing;

  if p_payout_usd_micros <= 0 or p_reward_credits <= 0 then
    return jsonb_build_object('status', 'invalid_amount');
  end if;

  insert into public.provider_callbacks(provider, external_event_key, payload_hash, processed_at)
  values (p_provider, v_callback_key, encode(digest(coalesce(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex'), now());

  insert into public.monetization_events(provider, external_id, user_id, event_type, status, payout_usd_micros, reward_credits, payload, occurred_at)
  values (p_provider, p_external_id, p_user_id, 'conversion', 'confirmed', p_payout_usd_micros, p_reward_credits, coalesce(p_payload, '{}'::jsonb), p_occurred_at);

  insert into public.ledger_entries(user_id, event_key, entry_type, state, credits, usd_micros, metadata)
  values (
    p_user_id,
    p_provider || ':conversion:' || p_external_id,
    'offer',
    'available',
    p_reward_credits,
    p_payout_usd_micros,
    jsonb_build_object('provider', p_provider, 'transaction_id', p_external_id)
  );

  return jsonb_build_object('status', 'credited', 'credits', p_reward_credits);
end;
$$;

revoke all on function public.apply_monetization_callback(text,text,text,uuid,text,bigint,bigint,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.apply_monetization_callback(text,text,text,uuid,text,bigint,bigint,timestamptz,jsonb) to service_role;
