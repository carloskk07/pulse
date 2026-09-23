-- V13.10 activate the launch extra-withdrawal policy during pilot.
-- One paid fee-free withdrawal owns the rolling 24-hour anchor.
-- Additional withdrawals inside that window remain optional and pay the
-- already-configured one-credit service fee without moving the free anchor.
-- Public payout access remains isolated by withdrawal_pilot_allowed().
-- Canonical release schema remains v55/0055.

update public.app_config
set value = jsonb_set(
      value,
      '{extra_withdrawals_enabled}',
      'true'::jsonb,
      true
    ),
    version = greatest(version,15),
    reason = 'Launch withdrawal policy active in pilot: one fee-free payout per 24 hours plus optional extra payouts with the configured fee',
    updated_at = now()
where key='pulse_economy_v13';

create or replace function public.release_extra_withdrawal_policy_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
with economy as (
  select coalesce(value,'{}'::jsonb) as value
  from public.app_config
  where key='pulse_economy_v13'
),
authority as (
  select credits
  from public.faucetpay_payout_pack_authority
  where singleton=true
),
reserve_src as (
  select lower(pg_get_functiondef(
    'public.reserve_withdrawal(uuid,text,text,text,text,bigint,bigint)'::regprocedure
  )) as body
),
finalize_src as (
  select lower(pg_get_functiondef(
    'public.finalize_withdrawal(uuid,text,text,text)'::regprocedure
  )) as body
)
select
  public.release_withdrawal_pass_integrity_contract()
  and public.release_withdrawal_pilot_contract()
  and coalesce((
    select lower(value->>'extra_withdrawals_enabled') in ('true','1','yes','on')
      and greatest(1,least(
        coalesce((value->>'free_withdrawal_window_hours')::integer,24),
        168
      )) = 24
      and coalesce((value->>'extra_withdrawal_fee_credits')::bigint,0) >= 1
      and coalesce((value->>'extra_withdrawal_fee_credits')::bigint,0)
        <= coalesce((select credits from authority),0)
    from economy
  ),false)
  and position('free_pass_anchor_at' in (select body from reserve_src)) > 0
  and position('v_extra_enabled' in (select body from reserve_src)) > 0
  and position('v_fee_credits' in (select body from reserve_src)) > 0
  and position('withdrawal_fee' in (select body from reserve_src)) > 0
  and position('free_pass_anchor_at=case' in replace((select body from finalize_src),' ','')) > 0
  and position('service_fee_credits,0)=0' in replace((select body from finalize_src),' ','')) > 0
  and not has_function_privilege(
    'anon','public.release_extra_withdrawal_policy_contract()','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.release_extra_withdrawal_policy_contract()','EXECUTE'
  );
$$;

revoke all on function public.release_extra_withdrawal_policy_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_extra_withdrawal_policy_contract()
  to service_role;

do $$
begin
  if not coalesce((
    select lower(value->>'pilot_mode') in ('true','1','yes','on')
    from public.app_config
    where key='hourly_pulse'
  ),false) then
    raise exception 'extra withdrawal launch activation requires current pilot isolation';
  end if;

  if not public.release_extra_withdrawal_policy_contract() then
    raise exception 'extra withdrawal launch policy contract failed';
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
