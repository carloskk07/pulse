-- Pulse Direct session-state fix
-- PL/pgSQL FOUND is statement-scoped. Keep session existence in an explicit boolean so
-- later aggregate capacity queries cannot change the insert-vs-update decision.

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
  v_has_session boolean := false;
  v_session_id uuid := gen_random_uuid();
  v_available bigint := 0;
  v_reserved_sessions integer := 0;
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
  v_has_session := found;

  if v_has_session and v_session.status = 'confirmed' then
    return jsonb_build_object('status', 'already_completed');
  end if;

  if v_has_session and v_session.status = 'reserved' and v_session.expires_at > now() then
    return jsonb_build_object(
      'status', 'idempotent',
      'session_id', v_session.id,
      'destination_url', v_campaign.destination_url,
      'reward_credits', v_campaign.reward_credits,
      'expires_at', v_session.expires_at,
      'pulse_protected', true
    );
  end if;

  select count(*)::integer into v_reserved_sessions
  from public.direct_campaign_sessions
  where campaign_id = p_campaign_id and status = 'reserved' and expires_at > now();

  if v_campaign.completion_count + v_reserved_sessions >= v_campaign.max_completions then
    return jsonb_build_object('status', 'capacity_reserved');
  end if;

  v_available := v_campaign.funded_usd_micros - v_campaign.spent_usd_micros - v_campaign.reserved_usd_micros;
  if v_available < v_campaign.price_per_action_usd_micros then
    return jsonb_build_object('status', 'capacity_reserved');
  end if;

  if v_has_session then
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

revoke all on function public.start_direct_campaign_session(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.start_direct_campaign_session(uuid,uuid,integer) to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 16, 'migration', '0016_pulse_direct_session_state_fix.sql'),
  16,
  'Pulse Direct explicit session-existence state after reservation-cap hardening'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
