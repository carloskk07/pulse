-- Aggregated economics snapshot for the private admin dashboard.

create or replace function public.admin_economics_snapshot(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revenue_micros bigint := 0;
  v_reward_credits bigint := 0;
  v_active_users bigint := 0;
  v_conversions bigint := 0;
  v_chargebacks bigint := 0;
  v_claims bigint := 0;
  v_claim_credits bigint := 0;
  v_paid_withdrawals bigint := 0;
  v_paid_withdrawal_credits bigint := 0;
  v_held_withdrawals bigint := 0;
  v_new_users bigint := 0;
  v_total_users bigint := 0;
  v_providers jsonb := '[]'::jsonb;
begin
  if p_from is null or p_to is null or p_from >= p_to then
    return jsonb_build_object('status', 'invalid_range');
  end if;

  select
    coalesce(sum(payout_usd_micros), 0),
    count(*) filter (where event_type = 'conversion'),
    count(*) filter (where event_type = 'chargeback')
  into v_revenue_micros, v_conversions, v_chargebacks
  from public.monetization_events
  where created_at >= p_from and created_at < p_to;

  select coalesce(sum(credits), 0)
  into v_reward_credits
  from public.ledger_entries
  where created_at >= p_from and created_at < p_to
    and entry_type in ('daily_reward', 'offer', 'survey', 'referral', 'chargeback')
    and state <> 'reversed';

  select count(distinct user_id)
  into v_active_users
  from public.ledger_entries
  where created_at >= p_from and created_at < p_to;

  select count(*), coalesce(sum(reward_credits), 0)
  into v_claims, v_claim_credits
  from public.claims
  where created_at >= p_from and created_at < p_to;

  select
    count(*) filter (where status = 'paid'),
    coalesce(sum(amount_credits) filter (where status = 'paid'), 0),
    count(*) filter (where status = 'held')
  into v_paid_withdrawals, v_paid_withdrawal_credits, v_held_withdrawals
  from public.withdrawals
  where created_at >= p_from and created_at < p_to;

  select count(*) into v_new_users
  from public.profiles
  where created_at >= p_from and created_at < p_to;

  select count(*) into v_total_users from public.profiles;

  select coalesce(jsonb_agg(row_data order by (row_data->>'revenue_micros')::bigint desc), '[]'::jsonb)
  into v_providers
  from (
    select jsonb_build_object(
      'provider', provider,
      'revenue_micros', coalesce(sum(payout_usd_micros), 0),
      'conversions', count(*) filter (where event_type = 'conversion'),
      'chargebacks', count(*) filter (where event_type = 'chargeback')
    ) as row_data
    from public.monetization_events
    where created_at >= p_from and created_at < p_to
    group by provider
  ) provider_rows;

  return jsonb_build_object(
    'status', 'ok',
    'from', p_from,
    'to', p_to,
    'revenue_micros', v_revenue_micros,
    'reward_credits', v_reward_credits,
    'contribution_micros', v_revenue_micros - (v_reward_credits * 1000),
    'active_users', v_active_users,
    'conversions', v_conversions,
    'chargebacks', v_chargebacks,
    'claims', v_claims,
    'claim_credits', v_claim_credits,
    'paid_withdrawals', v_paid_withdrawals,
    'paid_withdrawal_credits', v_paid_withdrawal_credits,
    'held_withdrawals', v_held_withdrawals,
    'new_users', v_new_users,
    'total_users', v_total_users,
    'providers', v_providers
  );
end;
$$;

revoke all on function public.admin_economics_snapshot(timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.admin_economics_snapshot(timestamptz,timestamptz) to service_role;
