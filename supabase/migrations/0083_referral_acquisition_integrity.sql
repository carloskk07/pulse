-- V13 acquisition-integrity hardening.
-- Referral attribution must be established before the invitee has economic history.
-- Additive only; canonical release schema remains v55/0055.

create or replace function public.enforce_referral_acquisition_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1
    from public.ledger_entries le
    where le.user_id = new.invitee_id
  ) or exists (
    select 1
    from public.pulse_claims pc
    where pc.user_id = new.invitee_id
  ) or exists (
    select 1
    from public.monetization_events me
    where me.user_id = new.invitee_id
  ) or exists (
    select 1
    from public.withdrawals w
    where w.user_id = new.invitee_id
  ) then
    raise exception 'referral_economic_history_rejected' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_referral_acquisition_integrity()
  from public, anon, authenticated, service_role;

drop trigger if exists referral_acquisition_integrity_guard on public.referrals;
create trigger referral_acquisition_integrity_guard
before insert or update of inviter_id, invitee_id
on public.referrals
for each row execute function public.enforce_referral_acquisition_integrity();

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
    select 1 from public.ledger_entries
    where user_id = p_invitee_id
  ) or exists (
    select 1 from public.pulse_claims
    where user_id = p_invitee_id
  ) or exists (
    select 1 from public.monetization_events
    where user_id = p_invitee_id
  ) or exists (
    select 1 from public.withdrawals
    where user_id = p_invitee_id
  ) then
    return jsonb_build_object('status', 'already_economically_active');
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
  and exists (
    select 1
    from pg_trigger
    where tgrelid='public.referrals'::regclass
      and tgname='referral_acquisition_integrity_guard'
      and tgenabled <> 'D'
  )
  and position(
    'cycle_rejected'
    in pg_get_functiondef('public.bind_referral(uuid,text)'::regprocedure)
  ) > 0
  and position(
    'already_economically_active'
    in pg_get_functiondef('public.bind_referral(uuid,text)'::regprocedure)
  ) > 0
  and position(
    'referral-graph'
    in pg_get_functiondef('public.bind_referral(uuid,text)'::regprocedure)
  ) > 0
  and position(
    'ledger_entries'
    in pg_get_functiondef('public.enforce_referral_acquisition_integrity()'::regprocedure)
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
    raise exception 'referral acquisition integrity contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'referral acquisition integrity requires canonical release schema v55';
  end if;
end
$$;
