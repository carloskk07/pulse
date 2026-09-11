-- Authentication bootstrap + atomic Daily Pulse claim.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.app_config(key, value, version, reason)
values ('daily_pulse', '{"credits":12}'::jsonb, 1, 'Initial Daily Pulse reward')
on conflict (key) do nothing;

create or replace function public.claim_daily_pulse(p_user_id uuid)
returns table(claim_id uuid, ledger_id uuid, reward_credits integer, streak_days integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward integer := 12;
  v_claim_id uuid := gen_random_uuid();
  v_ledger_id uuid := gen_random_uuid();
  v_streak integer := 1;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || current_date::text, 0));

  if exists (
    select 1 from public.claims
    where user_id = p_user_id and claim_day = current_date
  ) then
    raise exception using errcode = 'P0001', message = 'DAILY_PULSE_ALREADY_CLAIMED';
  end if;

  insert into public.profiles(id) values (p_user_id)
  on conflict (id) do nothing;

  select coalesce((value->>'credits')::integer, 12)
    into v_reward
  from public.app_config
  where key = 'daily_pulse';

  v_reward := coalesce(v_reward, 12);

  insert into public.ledger_entries(id, user_id, event_key, entry_type, state, credits, metadata)
  values (
    v_ledger_id,
    p_user_id,
    'daily_pulse:' || p_user_id::text || ':' || current_date::text,
    'daily_reward',
    'available',
    v_reward,
    jsonb_build_object('claim_day', current_date)
  );

  insert into public.claims(id, user_id, claim_day, reward_credits, ledger_entry_id)
  values (v_claim_id, p_user_id, current_date, v_reward, v_ledger_id);

  select count(*)::integer
    into v_streak
  from (
    select claim_day, row_number() over (order by claim_day desc) as rn
    from public.claims
    where user_id = p_user_id and claim_day <= current_date
  ) ranked
  where claim_day = current_date - ((rn - 1)::integer);

  return query select v_claim_id, v_ledger_id, v_reward, coalesce(v_streak, 1);
end;
$$;

revoke all on function public.claim_daily_pulse(uuid) from public, anon, authenticated;
grant execute on function public.claim_daily_pulse(uuid) to service_role;
