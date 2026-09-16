alter table public.withdrawals
  add column if not exists dispatch_claimed_at timestamptz,
  add column if not exists dispatch_attempts integer not null default 0;

alter table public.withdrawals
  drop constraint if exists withdrawals_dispatch_attempts_check;

alter table public.withdrawals
  add constraint withdrawals_dispatch_attempts_check
  check (dispatch_attempts >= 0);

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
      from pg_catalog.pg_constraint c
      where c.conrelid = 'public.withdrawals'::regclass
        and c.conname = 'withdrawals_dispatch_attempts_check'
        and c.contype = 'c'
    )
    and exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'withdrawals'
        and c.column_name = 'dispatch_claimed_at'
        and c.data_type = 'timestamp with time zone'
    )
    and exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'withdrawals'
        and c.column_name = 'dispatch_attempts'
        and c.data_type = 'integer'
        and c.is_nullable = 'NO'
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
        and t.tgname = 'withdrawals_paid_terminal_guard'
        and not t.tgisinternal
        and t.tgenabled <> 'D'
    )
    and has_function_privilege('service_role', 'public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.finalize_withdrawal(uuid,text,text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.claim_withdrawal_dispatch(uuid,integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.finalize_withdrawal(uuid,text,text,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.finalize_withdrawal(uuid,text,text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.claim_withdrawal_dispatch(uuid,integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.claim_withdrawal_dispatch(uuid,integer)', 'EXECUTE')
    and not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)'::regprocedure)
    and not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.finalize_withdrawal(uuid,text,text,text)'::regprocedure)
    and not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.claim_withdrawal_dispatch(uuid,integer)'::regprocedure);
$$;

revoke all on function public.release_withdrawal_settlement_contract() from public, anon, authenticated;
grant execute on function public.release_withdrawal_settlement_contract() to service_role;

update public.app_config
set value = jsonb_build_object(
      'version', 40,
      'migration', '0040_withdrawal_dispatch_lease.sql'
    ),
    version = 40,
    updated_at = now()
where key = 'release_schema';
