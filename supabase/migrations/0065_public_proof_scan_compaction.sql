-- Performance-only migration: compact public proof aggregates.
-- Keep release authority pinned to v55/0055; this changes no financial state
-- and preserves the existing service_role-only SECURITY DEFINER surface.

create or replace function public.pulse_public_snapshot()
returns jsonb
language sql
security definer
set search_path = public
as $$
with claim_stats as (
  select
    count(*) filter (
      where created_at >= now() - interval '24 hours'
    )::bigint as claims_24h,
    count(distinct user_id) filter (
      where created_at >= now() - interval '24 hours'
    )::bigint as unique_users_24h,
    coalesce(sum(reward_credits) filter (
      where created_at >= now() - interval '24 hours'
    ), 0)::bigint as credited_24h_credits,
    coalesce(sum(reward_credits), 0)::bigint as credited_all_time_credits
  from public.pulse_claims
),
turbo_stats as (
  select count(*)::bigint as confirmed_turbos_24h
  from public.monetization_events
  where event_type = 'conversion'
    and status = 'confirmed'
    and created_at >= now() - interval '24 hours'
),
withdrawal_stats as (
  select
    count(*) filter (
      where status = 'paid'
    )::bigint as paid_withdrawals_all_time,
    coalesce(sum(amount_credits) filter (
      where status = 'paid'
    ), 0)::bigint as paid_withdrawal_credits_all_time
  from public.withdrawals
)
select jsonb_build_object(
  'generated_at', now(),
  'claims_24h', c.claims_24h,
  'unique_users_24h', c.unique_users_24h,
  'credited_24h_credits', c.credited_24h_credits,
  'credited_all_time_credits', c.credited_all_time_credits,
  'confirmed_turbos_24h', t.confirmed_turbos_24h,
  'paid_withdrawals_all_time', w.paid_withdrawals_all_time,
  'paid_withdrawal_credits_all_time', w.paid_withdrawal_credits_all_time
)
from claim_stats c
cross join turbo_stats t
cross join withdrawal_stats w;
$$;

revoke all on function public.pulse_public_snapshot()
  from public, anon, authenticated, service_role;
grant execute on function public.pulse_public_snapshot()
  to service_role;

do $$
declare
  v_schema jsonb;
  v_actual jsonb;
  v_expected jsonb;
  v_definition text;
begin
  select value
  into v_schema
  from public.app_config
  where key = 'release_schema';

  if coalesce(nullif(v_schema->>'version', '')::integer, 0) <> 55
     or coalesce(v_schema->>'migration', '') <> '0055_invite_snapshot_compaction.sql' then
    raise exception 'v65 requires release authority v55/0055';
  end if;

  select public.pulse_public_snapshot() - 'generated_at'
  into v_actual;

  select jsonb_build_object(
    'claims_24h',
      (select count(*) from public.pulse_claims
       where created_at >= now() - interval '24 hours'),
    'unique_users_24h',
      (select count(distinct user_id) from public.pulse_claims
       where created_at >= now() - interval '24 hours'),
    'credited_24h_credits',
      (select coalesce(sum(reward_credits), 0) from public.pulse_claims
       where created_at >= now() - interval '24 hours'),
    'credited_all_time_credits',
      (select coalesce(sum(reward_credits), 0) from public.pulse_claims),
    'confirmed_turbos_24h',
      (select count(*) from public.monetization_events
       where event_type = 'conversion'
         and status = 'confirmed'
         and created_at >= now() - interval '24 hours'),
    'paid_withdrawals_all_time',
      (select count(*) from public.withdrawals where status = 'paid'),
    'paid_withdrawal_credits_all_time',
      (select coalesce(sum(amount_credits), 0)
       from public.withdrawals where status = 'paid')
  )
  into v_expected;

  if v_actual <> v_expected then
    raise exception 'v65 public proof output mismatch';
  end if;

  select lower(pg_get_functiondef('public.pulse_public_snapshot()'::regprocedure))
  into v_definition;

  if position('claim_stats as' in v_definition) = 0
     or position('turbo_stats as' in v_definition) = 0
     or position('withdrawal_stats as' in v_definition) = 0
     or position('count(distinct user_id) filter' in v_definition) = 0
     or position('(select count(*) from public.pulse_claims' in v_definition) > 0 then
    raise exception 'v65 public proof compaction contract failed';
  end if;

  if not (
    (select p.prosecdef
     from pg_catalog.pg_proc p
     where p.oid = 'public.pulse_public_snapshot()'::regprocedure)
    and has_function_privilege(
      'service_role',
      'public.pulse_public_snapshot()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.pulse_public_snapshot()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.pulse_public_snapshot()',
      'EXECUTE'
    )
  ) then
    raise exception 'v65 public proof execution authority drifted';
  end if;
end
$$;
