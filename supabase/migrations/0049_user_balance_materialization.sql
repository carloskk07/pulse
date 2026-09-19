-- Supabase v49: materialize current user balances so backing, funding and
-- withdrawal paths no longer aggregate the full immutable ledger history.
-- The public user_balances interface remains identical and security_invoker.

create table if not exists public.user_balance_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  available_credits bigint not null default 0,
  pending_credits bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_balance_state enable row level security;

revoke all on table public.user_balance_state
  from public, anon, authenticated, service_role;
grant select on table public.user_balance_state to authenticated, service_role;

drop policy if exists "user_balance_state_read_own" on public.user_balance_state;
create policy "user_balance_state_read_own"
on public.user_balance_state
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.sync_user_balance_state_from_ledger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old_available bigint := 0;
  v_old_pending bigint := 0;
  v_new_available bigint := 0;
  v_new_pending bigint := 0;
begin
  if tg_op <> 'INSERT' then
    v_old_available := case when old.state in ('available','withdrawn') then old.credits else 0 end;
    v_old_pending := case when old.state in ('pending','confirmed') then old.credits else 0 end;
  end if;

  if tg_op <> 'DELETE' then
    v_new_available := case when new.state in ('available','withdrawn') then new.credits else 0 end;
    v_new_pending := case when new.state in ('pending','confirmed') then new.credits else 0 end;
  end if;

  if tg_op = 'INSERT' then
    insert into public.user_balance_state(
      user_id, available_credits, pending_credits, updated_at
    )
    values (
      new.user_id, v_new_available, v_new_pending, now()
    )
    on conflict (user_id) do update
    set available_credits = public.user_balance_state.available_credits + excluded.available_credits,
        pending_credits = public.user_balance_state.pending_credits + excluded.pending_credits,
        updated_at = now();

    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.user_balance_state
    set available_credits = available_credits - v_old_available,
        pending_credits = pending_credits - v_old_pending,
        updated_at = now()
    where user_id = old.user_id;

    if not found then
      raise exception 'user_balance_state_missing:%', old.user_id using errcode = 'P0001';
    end if;

    delete from public.user_balance_state s
    where s.user_id = old.user_id
      and s.available_credits = 0
      and s.pending_credits = 0
      and not exists (
        select 1
        from public.ledger_entries le
        where le.user_id = old.user_id
      );

    return old;
  end if;

  if old.user_id = new.user_id then
    update public.user_balance_state
    set available_credits = available_credits + v_new_available - v_old_available,
        pending_credits = pending_credits + v_new_pending - v_old_pending,
        updated_at = now()
    where user_id = new.user_id;

    if not found then
      raise exception 'user_balance_state_missing:%', new.user_id using errcode = 'P0001';
    end if;
  else
    update public.user_balance_state
    set available_credits = available_credits - v_old_available,
        pending_credits = pending_credits - v_old_pending,
        updated_at = now()
    where user_id = old.user_id;

    if not found then
      raise exception 'user_balance_state_missing:%', old.user_id using errcode = 'P0001';
    end if;

    delete from public.user_balance_state s
    where s.user_id = old.user_id
      and s.available_credits = 0
      and s.pending_credits = 0
      and not exists (
        select 1
        from public.ledger_entries le
        where le.user_id = old.user_id
      );

    insert into public.user_balance_state(
      user_id, available_credits, pending_credits, updated_at
    )
    values (
      new.user_id, v_new_available, v_new_pending, now()
    )
    on conflict (user_id) do update
    set available_credits = public.user_balance_state.available_credits + excluded.available_credits,
        pending_credits = public.user_balance_state.pending_credits + excluded.pending_credits,
        updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function public.sync_user_balance_state_from_ledger()
  from public, anon, authenticated, service_role;

lock table public.ledger_entries in share row exclusive mode;

drop trigger if exists ledger_user_balance_state_sync on public.ledger_entries;

truncate table public.user_balance_state;

insert into public.user_balance_state(
  user_id,
  available_credits,
  pending_credits,
  updated_at
)
select
  user_id,
  coalesce(sum(
    case when state in ('available','withdrawn') then credits else 0 end
  ),0)::bigint,
  coalesce(sum(
    case when state in ('pending','confirmed') then credits else 0 end
  ),0)::bigint,
  now()
from public.ledger_entries
group by user_id;

create trigger ledger_user_balance_state_sync
after insert or update or delete on public.ledger_entries
for each row execute function public.sync_user_balance_state_from_ledger();

create or replace view public.user_balances
with (security_invoker = true)
as
select
  user_id,
  available_credits,
  pending_credits
from public.user_balance_state;

revoke all on table public.user_balances
  from public, anon, authenticated, service_role;
grant select on table public.user_balances to authenticated, service_role;

do $$
begin
  if exists (
    with expected as (
      select
        user_id,
        coalesce(sum(
          case when state in ('available','withdrawn') then credits else 0 end
        ),0)::bigint as available_credits,
        coalesce(sum(
          case when state in ('pending','confirmed') then credits else 0 end
        ),0)::bigint as pending_credits
      from public.ledger_entries
      group by user_id
    ),
    diff as (
      select
        coalesce(e.user_id, s.user_id) as user_id,
        e.available_credits as expected_available,
        s.available_credits as actual_available,
        e.pending_credits as expected_pending,
        s.pending_credits as actual_pending
      from expected e
      full join public.user_balance_state s using (user_id)
    )
    select 1
    from diff
    where expected_available is distinct from actual_available
       or expected_pending is distinct from actual_pending
  ) then
    raise exception 'user_balance_state_backfill_mismatch' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.release_user_balance_materialization_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select
    to_regclass('public.user_balance_state') is not null
    and coalesce((
      select relrowsecurity
      from pg_class
      where oid = 'public.user_balance_state'::regclass
    ), false)
    and has_table_privilege('authenticated', 'public.user_balance_state', 'SELECT')
    and not has_table_privilege('authenticated', 'public.user_balance_state', 'INSERT')
    and not has_table_privilege('authenticated', 'public.user_balance_state', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.user_balance_state', 'DELETE')
    and has_table_privilege('service_role', 'public.user_balance_state', 'SELECT')
    and not has_table_privilege('service_role', 'public.user_balance_state', 'INSERT')
    and not has_table_privilege('service_role', 'public.user_balance_state', 'UPDATE')
    and not has_table_privilege('service_role', 'public.user_balance_state', 'DELETE')
    and to_regprocedure('public.sync_user_balance_state_from_ledger()') is not null
    and coalesce((
      select prosecdef
      from pg_proc
      where oid = 'public.sync_user_balance_state_from_ledger()'::regprocedure
    ), false)
    and not has_function_privilege(
      'anon',
      'public.sync_user_balance_state_from_ledger()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.sync_user_balance_state_from_ledger()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'service_role',
      'public.sync_user_balance_state_from_ledger()',
      'EXECUTE'
    )
    and exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.ledger_entries'::regclass
        and tgname = 'ledger_user_balance_state_sync'
        and tgenabled <> 'D'
    )
    and coalesce((
      select 'security_invoker=true' = any(coalesce(reloptions, '{}'::text[]))
      from pg_class
      where oid = 'public.user_balances'::regclass
    ), false)
    and position(
      'user_balance_state'
      in lower(pg_get_viewdef('public.user_balances'::regclass, true))
    ) > 0
    and position(
      'ledger_entries'
      in lower(pg_get_viewdef('public.user_balances'::regclass, true))
    ) = 0
    and has_table_privilege('authenticated', 'public.user_balances', 'SELECT')
    and not has_table_privilege('authenticated', 'public.user_balances', 'INSERT')
    and not has_table_privilege('authenticated', 'public.user_balances', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.user_balances', 'DELETE')
    and has_table_privilege('service_role', 'public.user_balances', 'SELECT')
    and not has_table_privilege('service_role', 'public.user_balances', 'INSERT')
    and not has_table_privilege('service_role', 'public.user_balances', 'UPDATE')
    and not has_table_privilege('service_role', 'public.user_balances', 'DELETE');
$$;

revoke all on function public.release_user_balance_materialization_contract()
  from public, anon, authenticated;
grant execute on function public.release_user_balance_materialization_contract()
  to service_role;

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  jsonb_build_object('version', 49, 'migration', '0049_user_balance_materialization.sql'),
  49,
  'Transactionally materialized current user balances for O(current-users) backing, funding and withdrawal reads'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();
