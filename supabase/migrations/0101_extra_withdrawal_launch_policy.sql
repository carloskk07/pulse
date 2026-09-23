-- V13.7 launch policy for fee-free + paid extra withdrawals.
-- Product configuration is finalized during pilot; public access remains
-- controlled by withdrawal_pilot_allowed(), which follows hourly_pulse.pilot_mode.
-- Canonical release schema remains v55/0055.

update public.app_config
set value = jsonb_set(
  jsonb_set(
    jsonb_set(value,'{free_withdrawal_window_hours}','24'::jsonb,true),
    '{extra_withdrawals_enabled}','true'::jsonb,true
  ),
  '{extra_withdrawal_fee_credits}','1'::jsonb,true
),
version = greatest(version,15),
reason = 'Launch policy: one fee-free withdrawal every 24 hours plus paid extra withdrawals',
updated_at = now()
where key='pulse_economy_v13';

create or replace function public.current_user_wallet_state()
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
with
identity as (
  select auth.uid() as user_id
),
reward as (
  select public.current_user_reward_snapshot() as value
),
recent_ledger as (
  select le.id, le.entry_type, le.state, le.credits, le.created_at
  from public.ledger_entries le, identity i
  where le.user_id = i.user_id
  order by le.created_at desc
  limit 12
),
active_withdrawal as (
  select w.id, w.status, w.destination, w.asset, w.amount_credits,
         w.payout_amount_units, coalesce(w.service_fee_credits,0) as service_fee_credits,
         w.created_at
  from public.withdrawals w, identity i
  where w.user_id = i.user_id
    and w.status in ('requested','held','submitted')
  order by w.created_at desc
  limit 1
)
select jsonb_build_object(
  'user_id', (select user_id from identity),
  'reward', (select value from reward),
  'ledger', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'entry_type', entry_type,
      'state', state,
      'credits', credits,
      'created_at', created_at
    ) order by created_at desc)
    from recent_ledger
  ), '[]'::jsonb),
  'active_withdrawal', (
    select jsonb_build_object(
      'id', id,
      'status', status,
      'destination', destination,
      'asset', asset,
      'amount_credits', amount_credits,
      'payout_amount_units', payout_amount_units,
      'service_fee_credits', service_fee_credits,
      'created_at', created_at
    )
    from active_withdrawal
  )
)
where (select user_id from identity) is not null;
$$;

revoke all on function public.current_user_wallet_state()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_wallet_state()
  to authenticated;

create or replace function public.release_extra_withdrawal_launch_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
with
cfg as (
  select coalesce(value,'{}'::jsonb) as value
  from public.app_config
  where key='pulse_economy_v13'
),
src as (
  select
    lower(pg_get_functiondef('public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)'::regprocedure)) as reserve_src,
    lower(pg_get_functiondef('public.finalize_withdrawal(uuid,text,text,text)'::regprocedure)) as finalize_src,
    lower(pg_get_functiondef('public.current_user_wallet_state()'::regprocedure)) as wallet_src
)
select
  coalesce(((select value from cfg)->>'free_withdrawal_window_hours')::integer,0) = 24
  and lower(coalesce((select value from cfg)->>'extra_withdrawals_enabled','false')) in ('true','1','yes','on')
  and coalesce(((select value from cfg)->>'extra_withdrawal_fee_credits')::bigint,0) = 1
  and position('max(free_pass_anchor_at)' in (select reserve_src from src)) > 0
  and position('withdrawal:fee:' in (select reserve_src from src)) > 0
  and position('withdrawal_fee' in (select reserve_src from src)) > 0
  and position('extra_withdrawal' in (select reserve_src from src)) > 0
  and position('p_amount_credits + v_fee_credits' in (select reserve_src from src)) > 0
  and position('v_row.ledger_entry_id,v_row.service_fee_ledger_entry_id' in replace((select finalize_src from src),' ','')) > 0
  and position('coalesce(v_row.service_fee_credits,0)=0' in replace((select finalize_src from src),' ','')) > 0
  and position('service_fee_credits' in (select wallet_src from src)) > 0
  and has_function_privilege('authenticated','public.current_user_wallet_state()','EXECUTE')
  and not has_function_privilege('anon','public.current_user_wallet_state()','EXECUTE')
  and has_function_privilege('service_role','public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)','EXECUTE')
  and not has_function_privilege('authenticated','public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)','EXECUTE')
  and has_function_privilege('service_role','public.finalize_withdrawal(uuid,text,text,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.finalize_withdrawal(uuid,text,text,text)','EXECUTE');
$$;

revoke all on function public.release_extra_withdrawal_launch_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_extra_withdrawal_launch_contract()
  to service_role;

do $$
begin
  if not public.release_withdrawal_pass_integrity_contract() then
    raise exception 'withdrawal pass integrity contract failed after launch policy activation';
  end if;

  if not public.release_extra_withdrawal_launch_contract() then
    raise exception 'extra withdrawal launch contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'extra withdrawal launch policy requires canonical release schema v55';
  end if;
end
$$;
