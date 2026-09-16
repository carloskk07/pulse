-- Supabase v40: make external payout dispatch a one-way financial boundary.
--
-- A withdrawal must move requested -> submitted before any provider dispatch.
-- Once submitted, an ambiguous provider outcome may only remain submitted or
-- advance to paid. It must never become failed/cancelled and restore credits
-- without a separate authoritative reconciliation mechanism.

create or replace function public.withdrawal_settlement_transition_allowed(
  p_from text,
  p_to text
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog, public
as $$
  select coalesce(
    case p_from
      when 'requested' then p_to in ('requested', 'submitted', 'failed')
      when 'submitted' then p_to in ('submitted', 'paid')
      when 'paid' then p_to = 'paid'
      when 'failed' then p_to = 'failed'
      when 'cancelled' then p_to = 'cancelled'
      when 'held' then p_to = 'held'
      else false
    end,
    false
  );
$$;

revoke all on function public.withdrawal_settlement_transition_allowed(text,text) from public, anon, authenticated;
grant execute on function public.withdrawal_settlement_transition_allowed(text,text) to service_role;

drop trigger if exists withdrawals_paid_terminal_guard on public.withdrawals;
drop trigger if exists withdrawals_settlement_state_guard on public.withdrawals;
drop function if exists public.enforce_withdrawal_paid_terminal();

create or replace function public.enforce_withdrawal_settlement_state()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.withdrawal_settlement_transition_allowed(old.status, new.status) then
    raise exception 'invalid withdrawal settlement transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  if old.status = 'paid' and new.external_id is distinct from old.external_id then
    raise exception 'paid withdrawal provider reference is immutable'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_withdrawal_settlement_state() from public, anon, authenticated;

drop trigger if exists withdrawals_settlement_state_guard on public.withdrawals;
create trigger withdrawals_settlement_state_guard
before update on public.withdrawals
for each row
execute function public.enforce_withdrawal_settlement_state();

alter table public.withdrawals
  drop constraint if exists withdrawals_paid_external_id_check;

alter table public.withdrawals
  add constraint withdrawals_paid_external_id_check
  check (
    (status = 'paid' and nullif(trim(external_id), '') is not null)
    or (status <> 'paid' and external_id is null)
  );

create or replace function public.finalize_withdrawal(
  p_withdrawal_id uuid,
  p_status text,
  p_external_id text,
  p_message text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row public.withdrawals%rowtype;
  v_external_id text := nullif(trim(p_external_id), '');
begin
  if p_status not in ('submitted', 'paid', 'failed') then
    return jsonb_build_object('status', 'invalid');
  end if;

  if p_status = 'paid' and v_external_id is null then
    return jsonb_build_object('status', 'invalid_external_id');
  end if;

  select * into v_row
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_row.status = 'paid' then
    return jsonb_build_object('status', 'paid', 'external_id', v_row.external_id);
  end if;
  if v_row.status in ('failed', 'cancelled') then
    return jsonb_build_object('status', v_row.status);
  end if;
  if v_row.status = 'held' then
    return jsonb_build_object('status', 'held');
  end if;

  if not public.withdrawal_settlement_transition_allowed(v_row.status, p_status) then
    return jsonb_build_object(
      'status', 'invalid_transition',
      'current_status', v_row.status,
      'requested_status', p_status
    );
  end if;

  if p_status = 'submitted' then
    update public.withdrawals
    set status = 'submitted',
        external_id = null,
        provider_message = p_message,
        updated_at = now()
    where id = p_withdrawal_id;
    return jsonb_build_object('status', 'submitted');
  end if;

  if p_status = 'paid' then
    update public.withdrawals
    set status = 'paid',
        external_id = v_external_id,
        provider_message = p_message,
        updated_at = now()
    where id = p_withdrawal_id;
    update public.ledger_entries
    set state = 'withdrawn'
    where id = v_row.ledger_entry_id;
    return jsonb_build_object('status', 'paid', 'external_id', v_external_id);
  end if;

  -- Reversal is only legal while the withdrawal is still requested, i.e. before
  -- provider dispatch authority has been persisted as submitted.
  update public.withdrawals
  set status = 'failed',
      external_id = null,
      provider_message = p_message,
      updated_at = now()
  where id = p_withdrawal_id;
  update public.ledger_entries
  set state = 'reversed'
  where id = v_row.ledger_entry_id;
  return jsonb_build_object('status', 'failed');
end;
$$;

revoke all on function public.finalize_withdrawal(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.finalize_withdrawal(uuid,text,text,text) to service_role;

create or replace function public.release_withdrawal_settlement_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select
    exists (
      select 1
      from pg_catalog.pg_constraint c
      where c.conrelid = 'public.withdrawals'::regclass
        and c.conname = 'withdrawals_paid_external_id_check'
        and c.contype = 'c'
    )
    and exists (
      select 1
      from pg_catalog.pg_index i
      join pg_catalog.pg_class idx on idx.oid = i.indexrelid
      where i.indrelid = 'public.withdrawals'::regclass
        and idx.relname = 'withdrawals_idempotency_key_key'
        and i.indisunique
    )
    and exists (
      select 1
      from pg_catalog.pg_index i
      join pg_catalog.pg_class idx on idx.oid = i.indexrelid
      where i.indrelid = 'public.withdrawals'::regclass
        and idx.relname = 'withdrawals_one_active_per_user_idx'
        and i.indisunique
        and i.indpred is not null
    )
    and exists (
      select 1
      from pg_catalog.pg_index i
      join pg_catalog.pg_class idx on idx.oid = i.indexrelid
      where i.indrelid = 'public.withdrawals'::regclass
        and idx.relname = 'withdrawals_paid_provider_external_id_uidx'
        and i.indisunique
        and i.indpred is not null
    )
    and exists (
      select 1
      from pg_catalog.pg_trigger t
      where t.tgrelid = 'public.withdrawals'::regclass
        and t.tgname = 'withdrawals_settlement_state_guard'
        and not t.tgisinternal
        and t.tgenabled <> 'D'
    )
    and not exists (
      select 1
      from pg_catalog.pg_trigger t
      where t.tgrelid = 'public.withdrawals'::regclass
        and t.tgname = 'withdrawals_paid_terminal_guard'
        and not t.tgisinternal
        and t.tgenabled <> 'D'
    )
    and public.withdrawal_settlement_transition_allowed('requested', 'submitted')
    and public.withdrawal_settlement_transition_allowed('requested', 'failed')
    and not public.withdrawal_settlement_transition_allowed('requested', 'paid')
    and public.withdrawal_settlement_transition_allowed('submitted', 'submitted')
    and public.withdrawal_settlement_transition_allowed('submitted', 'paid')
    and not public.withdrawal_settlement_transition_allowed('submitted', 'failed')
    and not public.withdrawal_settlement_transition_allowed('submitted', 'cancelled')
    and public.withdrawal_settlement_transition_allowed('paid', 'paid')
    and not public.withdrawal_settlement_transition_allowed('paid', 'submitted')
    and has_function_privilege('service_role', 'public.withdrawal_settlement_transition_allowed(text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.finalize_withdrawal(uuid,text,text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.withdrawal_settlement_transition_allowed(text,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.withdrawal_settlement_transition_allowed(text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.finalize_withdrawal(uuid,text,text,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.finalize_withdrawal(uuid,text,text,text)', 'EXECUTE')
    and not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.withdrawal_settlement_transition_allowed(text,text)'::regprocedure)
    and not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)'::regprocedure)
    and not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.finalize_withdrawal(uuid,text,text,text)'::regprocedure);
$$;

revoke all on function public.release_withdrawal_settlement_contract() from public, anon, authenticated;
grant execute on function public.release_withdrawal_settlement_contract() to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 40, 'migration', '0040_submitted_withdrawal_terminal.sql'),
  40,
  'Withdrawal settlement is a one-way requested -> submitted -> paid authority; submitted payouts require reconciliation and cannot auto-refund'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();