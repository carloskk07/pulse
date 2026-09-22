import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireAll(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(path + " missing continuous rewards contract: " + fragment);
    }
  }
  return source;
}

function forbidAll(path, fragments) {
  const source = read(path).toLowerCase();
  for (const fragment of fragments) {
    if (source.includes(fragment.toLowerCase())) {
      throw new Error(path + " contains forbidden continuous rewards coupling: " + fragment);
    }
  }
}

requireAll("supabase/migrations/0077_continuous_reward_ecosystem.sql", [
  "pulse_economy_v13",
  "'hourly_windows_per_day', 24",
  "'user_daily_cap_mode', 'natural_hourly_ceiling'",
  "'variable_reward_enabled', false",
  "'variable_reward_review_required', true",
  "'extra_withdrawals_enabled', false",
  "'network_commission_enabled', false",
  "'cashback_enabled', false",
  "create table if not exists public.cashback_events",
  "alter table public.cashback_events enable row level security",
  "create or replace function public.apply_cashback_event",
  "reward_exceeds_confirmed_commission",
  "create table if not exists public.network_commission_events",
  "alter table public.network_commission_events enable row level security",
  "create or replace function public.apply_network_commission_on_monetization",
  "zz_network_commission_after_monetization",
  "create or replace function public.resolve_hourly_pulse_reward",
  "extensions.gen_random_bytes(2)",
  "v_total_bps <> 10000",
  "create or replace function public.claim_hourly_pulse(p_user_id uuid)",
  "public.resolve_hourly_pulse_reward(",
  "SCALE_V48_GLOBAL_CRITICAL_SECTION",
  "create or replace function public.reserve_withdrawal(",
  "free_window_used",
  "extra_withdrawals_enabled",
  "service_fee_credits",
  "service_fee_ledger_entry_id",
  "create or replace function public.finalize_withdrawal(",
  "create or replace function public.current_ecosystem_snapshot",
  "grant execute on function public.current_ecosystem_snapshot(uuid)",
  "to service_role",
  "create or replace function public.release_continuous_reward_ecosystem_contract",
]);

forbidAll("supabase/migrations/0077_continuous_reward_ecosystem.sql", [
  "grant execute on function public.current_ecosystem_snapshot(uuid) to authenticated",
  "grant execute on function public.apply_cashback_event(text,text,uuid,text,bigint,bigint,jsonb) to authenticated",
  "'variable_reward_enabled', true",
  "'extra_withdrawals_enabled', true",
  "'network_commission_enabled', true",
  "'cashback_enabled', true",
  "fund_reward_treasury(",
  "pilot_mode = false",
]);

requireAll("supabase/migrations/0078_v13_fk_index_hardening.sql", [
  "network_commission_source_user_idx",
  "pulse_ads_callbacks_verified_campaign_idx",
  "release_schema",
]);

requireAll("supabase/migrations/0079_natural_hourly_ceiling_authority.sql", [
  "pilot_mode=true",
  "v_windows <> 24",
  "v_ceiling <> 24",
  "max_user_daily_credits=v_ceiling",
  "arbitrary_user_quota_enabled",
  "faucet_continuous_launch_policy",
  "cadence migration changed forbidden Treasury authority",
]);

requireAll("supabase/migrations/0087_withdrawal_pass_anchor_authority.sql", [
  "free_pass_anchor_at",
  "withdrawals_free_pass_anchor_integrity_chk",
  "withdrawals_free_pass_anchor_idx",
  "max(free_pass_anchor_at)",
  "service_fee_credits,0)=0",
  "max(w.free_pass_anchor_at)",
  "release_withdrawal_pass_integrity_contract",
  "canonical release schema v55",
]);

forbidAll("supabase/migrations/0087_withdrawal_pass_anchor_authority.sql", [
  "'extra_withdrawals_enabled', true",
  "pilot_mode = false",
  "fund_reward_treasury(",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("supabase/migrations/0088_withdrawal_recovery_authority.sql", [
  "payout_authority_version",
  "withdrawal_payout_authority_snapshot_guard",
  "faucetpay_payout_pack_authority",
  "payout_authority_mismatch",
  "withdrawal_payout_authority_snapshot_valid",
  "release_withdrawal_recovery_authority_contract",
  "canonical release schema v55",
]);

forbidAll("supabase/migrations/0088_withdrawal_recovery_authority.sql", [
  "pilot_mode = false",
  "fund_reward_treasury(",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("supabase/migrations/0089_withdrawal_retry_backoff.sql", [
  "v_effective_retry_seconds",
  "power(2::numeric",
  "least(",
  "900",
  "backoff_seconds",
  "release_withdrawal_retry_backoff_contract",
  "canonical release schema v55",
]);

forbidAll("supabase/migrations/0089_withdrawal_retry_backoff.sql", [
  "pilot_mode = false",
  "fund_reward_treasury(",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("lib/pulse-ecosystem.ts", [
  "XP is non-monetary",
  "current_ecosystem_snapshot",
  "totalClaims * 5",
  "confirmedConversions * 30",
  "paidWithdrawals * 50",
  "rewardedReferrals * 40",
  "freeWithdrawalAvailable",
  "networkCommissionEnabled",
  "extraWithdrawalsEnabled",
  "variableRewardReviewRequired",
]);

requireAll("components/continuous-pulse-panel.tsx", [
  "Every hour can open another Pulse.",
  "Up to 24/day",
  "global funding and fraud controls",
]);

requireAll("components/continuous-earn-hub.tsx", [
  "Cashback",
  "Network",
  "XP measures verified participation",
  "Reversed purchases never become spendable rewards",
]);

requireAll("components/network-depth-panel.tsx", [
  "Three levels. Real activity only.",
  "Commission engine",
]);

requireAll("components/withdrawal-pass-panel.tsx", [
  "Withdrawal access",
  "free withdrawal",
  "extraWithdrawalsEnabled",
]);

requireAll("app/api/withdrawals/route.ts", [
  'reserved.status === "free_window_used"',
  '"free-pass-used"',
  "reservedHasStoredPayoutAuthority",
  'reserved.status === "submitted"',
  '"withdrawal_payout_authority_snapshot_valid"',
  "payout_authority_version",
  "error instanceof FaucetPayApiError && !error.retryable",
  '"failed"',
  '"submitted"',
]);

requireAll("app/wallet/page.tsx", [
  "getPulseEcosystemSnapshot",
  "ecosystem.freeWithdrawalAvailable || ecosystem.extraWithdrawalsEnabled",
  '"free-pass-used"',
]);

requireAll("lib/reward-state.ts", [
  "claimRewardVariable",
  "claimRewardMinCredits",
  "claimRewardMaxCredits",
  "variable_reward_review_required",
]);

requireAll("app/dashboard/page.tsx", [
  'state.claimRewardVariable ? "Reveal reward"',
]);

requireAll("components/app-shell.tsx", [
  'label: "Earn"',
  'label: "Referrals"',
]);

const dashboard = read("app/dashboard/page.tsx");
if (!dashboard.includes("<ContinuousPulsePanel />")) {
  throw new Error("Dashboard must expose the continuous hourly model.");
}

const earn = read("app/earn/page.tsx");
if (!earn.includes("<ContinuousEarnHub />")) {
  throw new Error("Earn must expose missions, cashback and network.");
}

const invite = read("app/invite/page.tsx");
if (!invite.includes("<NetworkDepthPanel />")) {
  throw new Error("Network must expose three-level depth.");
}

const wallet = read("app/wallet/page.tsx");
if (!wallet.includes("<WithdrawalPassPanel snapshot={ecosystem} />")) {
  throw new Error("Vault must expose the withdrawal pass.");
}

console.log("Continuous reward ecosystem V13 contract PASS");
