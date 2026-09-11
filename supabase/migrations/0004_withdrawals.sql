-- Safe payout reservation + reconciliation semantics.

alter table public.withdrawals add column if not exists payout_amount_units bigint;
alter table public.withdrawals add column if not exists ledger_entry_id uuid references public.ledger_entries(id);
alter table public.withdrawals add column if not exists provider_message text;

create unique index if not exists withdrawals_one_active_per_user_idx
on public.withdrawals(user_id)
where status in ('requested', 'held', 'submitted');

insert into public.app_config(key, value, version, reason)
values ('withdrawal_risk', '{"hold_risk_score":60}'::jsonb, 1, 'Initial withdrawal risk gate')
on conflict (key) do nothing;

create or replace view public.user_balances
with (security_invoker = true) as
select
  user_id,
  coalesce(sum(case when state in ('available', 'withdrawn') then credits else 0 end), 0)::bigint as available_credits,
  coalesce(sum(case when state in ('pending', 'confirmed') then credits else 0 end), 0)::bigint as pending_credits
from public.ledger_entries
group by user_id;

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
security definer
set search_path = public
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
  if p_amount_credits <= 0 or p_payout_amount_units <= 0 or length(trim(p_destination)) = 0 then
    return jsonb_build_object('status', 'invalid');
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
  from public.user_balances where user_id = p_user_id;
  v_available := coalesce(v_available, 0);

  if v_available < p_amount_credits then
    return jsonb_build_object('status', 'insufficient', 'available_credits', v_available);
  end if;

  select coalesce(risk_score, 0) into v_risk_score from public.profiles where id = p_user_id;
  select coalesce((value->>'hold_risk_score')::integer, 60) into v_hold_score
  from public.app_config where key = 'withdrawal_risk';
  v_hold_score := coalesce(v_hold_score, 60);
  if coalesce(v_risk_score, 0) >= v_hold_score then v_status := 'held'; end if;

  insert into public.ledger_entries(id, user_id, event_key, entry_type, state, credits, metadata)
  values (
    v_ledger_id,
    p_user_id,
    'withdrawal:reserve:' || v_withdrawal_id::text,
    'withdrawal',
    'available',
    -p_amount_credits,
    jsonb_build_object('provider', p_provider, 'asset', p_asset, 'withdrawal_id', v_withdrawal_id)
  );

  insert into public.withdrawals(
    id, user_id, idempotency_key, payout_provider, asset, destination,
    amount_credits, payout_amount_units, status, ledger_entry_id
  ) values (
    v_withdrawal_id, p_user_id, p_idempotency_key, p_provider, upper(p_asset), trim(p_destination),
    p_amount_credits, p_payout_amount_units, v_status, v_ledger_id
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

create or replace function public.finalize_withdrawal(
  p_withdrawal_id uuid,
  p_status text,
  p_external_id text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.withdrawals%rowtype;
begin
  if p_status not in ('submitted', 'paid', 'failed') then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_row from public.withdrawals where id = p_withdrawal_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;

  if v_row.status = 'paid' then return jsonb_build_object('status', 'paid', 'external_id', v_row.external_id); end if;
  if v_row.status in ('failed', 'cancelled') then return jsonb_build_object('status', v_row.status); end if;
  if v_row.status = 'held' then return jsonb_build_object('status', 'held'); end if;

  if p_status = 'submitted' then
    update public.withdrawals
    set status = 'submitted', provider_message = p_message, updated_at = now()
    where id = p_withdrawal_id;
    return jsonb_build_object('status', 'submitted');
  end if;

  if p_status = 'paid' then
    update public.withdrawals
    set status = 'paid', external_id = p_external_id, provider_message = p_message, updated_at = now()
    where id = p_withdrawal_id;
    update public.ledger_entries set state = 'withdrawn' where id = v_row.ledger_entry_id;
    return jsonb_build_object('status', 'paid', 'external_id', p_external_id);
  end if;

  update public.withdrawals
  set status = 'failed', provider_message = p_message, updated_at = now()
  where id = p_withdrawal_id;
  update public.ledger_entries set state = 'reversed' where id = v_row.ledger_entry_id;
  return jsonb_build_object('status', 'failed');
end;
$$;

revoke all on function public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint) from public, anon, authenticated;
grant execute on function public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint) to service_role;
revoke all on function public.finalize_withdrawal(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.finalize_withdrawal(uuid,text,text,text) to service_role;
