-- Supabase v42: isolate controlled withdrawals to the same pilot allowlist
-- used by Hourly Pulse while pilot_mode is enabled.
--
-- This is a payout safety gate, not a payout trigger. It does not fund Treasury,
-- reserve a withdrawal, call FaucetPay, or create external evidence.

create or replace function public.withdrawal_pilot_allowed(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_config jsonb := '{}'::jsonb;
  v_pilot_mode boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  select coalesce(value, '{}'::jsonb)
  into v_config
  from public.app_config
  where key = 'hourly_pulse';

  v_config := coalesce(v_config, '{}'::jsonb);
  v_pilot_mode := lower(coalesce(v_config->>'pilot_mode', 'false')) in ('true','1','yes','on');

  if not v_pilot_mode then
    return true;
  end if;

  return exists (
    select 1
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(v_config->'pilot_user_ids') = 'array'
          then v_config->'pilot_user_ids'
        else '[]'::jsonb
      end
    ) as pilot(user_id)
    where pilot.user_id = p_user_id::text
  );
end;
$$;

revoke all on function public.withdrawal_pilot_allowed(uuid) from public, anon, authenticated;
grant execute on function public.withdrawal_pilot_allowed(uuid) to service_role;

create or replace function public.reserve_withdrawal(
  p_user_id uuid,
  p_idempotency_key text,
  p_provider text,
  p_asset text,
  p_destination text,
  p_amount_credits bigint,
  p_payout_amount_units bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_existing public.withdrawals%rowtype;
  v_available bigint := 0;
  v_risk_score integer := 0;
  v_hold_score integer := 60;
  v_status text := 'requested';
  v_withdrawal_id uuid := gen_random_uuid();
  v_ledger_id uuid := gen_random_uuid();
begin
  if p_user_id is null then
    return jsonb_build_object('status', 'invalid_user');
  end if;

  if p_amount_credits <= 0 or p_payout_amount_units <= 0 or length(trim(p_destination)) = 0 then
    return jsonb_build_object('status', 'invalid');
  end if;

  if not public.withdrawal_pilot_allowed(p_user_id) then
    return jsonb_build_object('status', 'pilot_restricted');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('withdrawal:' || p_user_id::text, 0));

  select * into v_existing
  from public.withdrawals
  where user_id = p_user_id and status in ('requested', 'held', 'submitted')
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'status', case when v_existing.status = 'held' then 'held' else 'active' end,
      'withdrawal_id', v_existing.id,
      'idempotency_key', v_existing.idempotency_key,
      'destination', v_existing.destination,
      'asset', v_existing.asset,
      'amount_credits', v_existing.amount_credits,
      'payout_amount_units', v_existing.payout_amount_units
    );
  end if;

  select coalesce(available_credits, 0) into v_available
  from public.user_balances
  where user_id = p_user_id;
  v_available := coalesce(v_available, 0);

  if v_available < p_amount_credits then
    return jsonb_build_object('status', 'insufficient', 'available_credits', v_available);
  end if;

  select coalesce(risk_score, 0)
  into v_risk_score
  from public.profiles
  where id = p_user_id;

  select coalesce((value->>'hold_risk_score')::integer, 60)
  into v_hold_score
  from public.app_config
  where key = 'withdrawal_risk';

  v_hold_score := coalesce(v_hold_score, 60);
  if coalesce(v_risk_score, 0) >= v_hold_score then
    v_status := 'held';
  end if;

  insert into public.ledger_entries(
    id, user_id, event_key, entry_type, state, credits, metadata
  )
  values (
    v_ledger_id,
    p_user_id,
    'withdrawal:reserve:' || v_withdrawal_id::text,
    'withdrawal',
    'available',
    -p_amount_credits,
    jsonb_build_object(
      'provider', p_provider,
      'asset', p_asset,
      'withdrawal_id', v_withdrawal_id
    )
  );

  insert into public.withdrawals(
    id, user_id, idempotency_key, payout_provider, asset, destination,
    amount_credits, payout_amount_units, status, ledger_entry_id
  )
  values (
    v_withdrawal_id,
    p_user_id,
    p_idempotency_key,
    p_provider,
    upper(p_asset),
    trim(p_destination),
    p_amount_credits,
    p_payout_amount_units,
    v_status,
    v_ledger_id
  );

  return jsonb_build_object(
    'status', v_status,
    'withdrawal_id', v_withdrawal_id,
    'idempotency_key', p_idempotency_key,
    'destination', trim(p_destination),
    'asset', upper(p_asset),
    'amount_credits', p_amount_credits,
    'payout_amount_units', p_payout_amount_units
  );
end;
$$;

revoke all on function public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint) from public, anon, authenticated;
grant execute on function public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint) to service_role;

create or replace function public.claim_withdrawal_dispatch(
  p_withdrawal_id uuid,
  p_retry_after_seconds integer default 30
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row public.withdrawals%rowtype;
  v_now timestamptz := now();
  v_retry_seconds integer := coalesce(p_retry_after_seconds, 30);
  v_retry_after integer;
begin
  if v_retry_seconds < 5 or v_retry_seconds > 3600 then
    return jsonb_build_object('status', 'invalid_retry_window', 'dispatch', false);
  end if;

  select * into v_row
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found', 'dispatch', false);
  end if;

  if v_row.status = 'paid' then
    return jsonb_build_object(
      'status', 'paid',
      'dispatch', false,
      'external_id', v_row.external_id,
      'attempt', v_row.dispatch_attempts
    );
  end if;

  if v_row.status = 'held' then
    return jsonb_build_object('status', 'held', 'dispatch', false, 'attempt', v_row.dispatch_attempts);
  end if;

  if v_row.status in ('failed', 'cancelled') then
    return jsonb_build_object('status', v_row.status, 'dispatch', false, 'attempt', v_row.dispatch_attempts);
  end if;

  if not public.withdrawal_pilot_allowed(v_row.user_id) then
    return jsonb_build_object(
      'status', 'pilot_restricted',
      'dispatch', false,
      'attempt', v_row.dispatch_attempts
    );
  end if;

  if v_row.status not in ('requested', 'submitted') then
    return jsonb_build_object('status', 'invalid_state', 'dispatch', false, 'attempt', v_row.dispatch_attempts);
  end if;

  if v_row.status = 'submitted'
     and v_row.dispatch_claimed_at is not null
     and v_row.dispatch_claimed_at > v_now - make_interval(secs => v_retry_seconds) then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from ((v_row.dispatch_claimed_at + make_interval(secs => v_retry_seconds)) - v_now)))::integer
    );

    return jsonb_build_object(
      'status', 'submitted',
      'dispatch', false,
      'retry_after_seconds', v_retry_after,
      'attempt', v_row.dispatch_attempts
    );
  end if;

  update public.withdrawals
  set status = 'submitted',
      dispatch_claimed_at = v_now,
      dispatch_attempts = dispatch_attempts + 1,
      provider_message = case
        when v_row.status = 'requested' then 'Payout dispatch lease claimed'
        else 'Payout recovery dispatch lease claimed'
      end,
      updated_at = v_now
  where id = p_withdrawal_id
  returning * into v_row;

  return jsonb_build_object(
    'status', 'submitted',
    'dispatch', true,
    'attempt', v_row.dispatch_attempts,
    'dispatch_claimed_at', v_row.dispatch_claimed_at
  );
end;
$$;

revoke all on function public.claim_withdrawal_dispatch(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_withdrawal_dispatch(uuid, integer) to service_role;

create or replace function public.release_withdrawal_pilot_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select
    has_function_privilege('service_role', 'public.withdrawal_pilot_allowed(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.withdrawal_pilot_allowed(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.withdrawal_pilot_allowed(uuid)', 'EXECUTE')
    and not (
      select p.prosecdef
      from pg_catalog.pg_proc p
      where p.oid = 'public.withdrawal_pilot_allowed(uuid)'::regprocedure
    )
    and position('pilot_mode' in pg_get_functiondef('public.withdrawal_pilot_allowed(uuid)'::regprocedure)) > 0
    and position('pilot_user_ids' in pg_get_functiondef('public.withdrawal_pilot_allowed(uuid)'::regprocedure)) > 0
    and position('withdrawal_pilot_allowed' in pg_get_functiondef('public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)'::regprocedure)) > 0
    and position('pilot_restricted' in pg_get_functiondef('public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)'::regprocedure)) > 0
    and position('withdrawal_pilot_allowed' in pg_get_functiondef('public.claim_withdrawal_dispatch(uuid,integer)'::regprocedure)) > 0
    and position('pilot_restricted' in pg_get_functiondef('public.claim_withdrawal_dispatch(uuid,integer)'::regprocedure)) > 0;
$$;

revoke all on function public.release_withdrawal_pilot_contract() from public, anon, authenticated;
grant execute on function public.release_withdrawal_pilot_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object(
    'version', 42,
    'migration', '0042_withdrawal_pilot_isolation.sql'
  ),
  42,
  'Controlled withdrawals share the Hourly Pulse pilot allowlist before the first real payout proof'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
