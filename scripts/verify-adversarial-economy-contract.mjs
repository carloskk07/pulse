import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireAll(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(path + " missing adversarial economy contract: " + fragment);
    }
  }
  return source;
}

function forbidAll(path, fragments) {
  const source = read(path).toLowerCase();
  for (const fragment of fragments) {
    if (source.includes(fragment.toLowerCase())) {
      throw new Error(path + " contains forbidden adversarial economy pattern: " + fragment);
    }
  }
}

requireAll("supabase/migrations/0082_referral_network_cycle_guard.sql", [
  "referral_graph_acyclic_guard",
  "pg_advisory_xact_lock(hashtextextended('referral-graph', 0))",
  "'cycle_rejected'",
  "v_beneficiary = any(v_seen)",
  "max_reward_share_of_margin_bps',5000",
  "v_reward_cost_usd_micros > v_reward_budget_usd_micros",
  "verified_margin_usd_micros",
  "release_referral_network_integrity_contract",
  "canonical release schema v55",
]);

requireAll("supabase/migrations/0083_referral_acquisition_integrity.sql", [
  "referral_acquisition_integrity_guard",
  "'already_economically_active'",
  "public.ledger_entries",
  "public.pulse_claims",
  "public.monetization_events",
  "public.withdrawals",
  "release_referral_network_integrity_contract",
  "canonical release schema v55",
]);

requireAll("supabase/migrations/0084_stacked_incentive_budget_authority.sql", [
  "network_commission_residual_cap_bps',3000",
  "v_gross_margin - v_referral_cost",
  "qualifying_conversion_id",
  "v_total_bps > v_cap_bps",
  "release_stacked_incentive_budget_contract",
  "canonical release schema v55",
]);

requireAll("supabase/migrations/0085_cashback_budget_authority.sql", [
  "cashback_disabled",
  "cashback_user_share_bps",
  "reward_exceeds_cashback_share",
  "economics_mismatch",
  "release_cashback_budget_contract",
  "canonical release schema v55",
]);

requireAll("supabase/migrations/0086_variable_reward_budget_readiness.sql", [
  "variable_reward_budget_ready",
  "v_required_user_ceiling",
  "variable_reward_budget_not_ready",
  "variable_reward_activation_guard",
  "release_variable_reward_budget_contract",
  "canonical release schema v55",
]);

requireAll("supabase/migrations/0094_variable_reward_launch_preparation.sql", [
  "variable_reward_model_valid",
  "variable reward launch preparation requires pilot isolation",
  "if not v_pilot_mode and not public.variable_reward_budget_ready(new.value)",
  "variable_reward_enabled",
  "variable_reward_review_required",
  "release_variable_reward_budget_contract",
  "Canonical release schema remains v55/0055",
]);

forbidAll("supabase/migrations/0094_variable_reward_launch_preparation.sql", [
  "pilot_mode = false",
  "fund_reward_treasury(",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("supabase/migrations/0095_variable_reward_public_open_guard.sql", [
  "variable_reward_public_open_ready",
  "variable_reward_public_open_not_ready",
  "if new.key = 'hourly_pulse'",
  "public-open guard failed to reject unsafe transition",
  "release_variable_reward_budget_contract",
  "Canonical release schema remains v55/0055",
]);

forbidAll("supabase/migrations/0095_variable_reward_public_open_guard.sql", [
  "fund_reward_treasury(",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("supabase/migrations/0096_variable_reward_pilot_execution.sql", [
  "resolve_hourly_pulse_reward",
  "variable_reward_model_valid",
  "variable_reward_public_open_ready",
  "v_pilot_mode",
  "extensions.gen_random_bytes",
  "v_sample < 60000",
  "release_variable_reward_execution_contract",
  "Canonical release schema remains v55/0055",
]);

forbidAll("supabase/migrations/0096_variable_reward_pilot_execution.sql", [
  "fund_reward_treasury(",
  "pilot_mode = false",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("supabase/migrations/0097_variable_reward_contract_alignment.sql", [
  "release_variable_reward_budget_contract",
  "variable_reward_public_open_ready",
  "variable_reward_model_valid",
  "release_variable_reward_execution_contract",
  "aligned variable reward readiness contract failed",
  "Canonical release schema remains v55/0055",
]);

forbidAll("supabase/migrations/0097_variable_reward_contract_alignment.sql", [
  "fund_reward_treasury(",
  "pilot_mode = false",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("supabase/migrations/0098_variable_reward_readiness_snapshot.sql", [
  "controlled_technical_readiness_snapshot",
  "pulse_economy_v13",
  "variable_reward_model_valid",
  "jsonb_array_elements",
  "'pulse_economy'",
  "release_variable_reward_execution_contract",
  "variable reward readiness snapshot contract failed",
  "canonical release schema v55",
]);

forbidAll("supabase/migrations/0098_variable_reward_readiness_snapshot.sql", [
  "fund_reward_treasury(",
  "pilot_mode = false",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("supabase/migrations/0099_pilot_backing_separation.sql", [
  "enforce_pulse_claim_backing_guard",
  "pilot_user_ids",
  "new.user_id::text",
  "if v_pilot_user then",
  "treasury_backing_guard",
  "v_status <> 'backing_ready'",
  "release_pilot_backing_separation_contract",
  "pilot backing separation requires current pilot isolation",
  "canonical release schema v55",
]);

forbidAll("supabase/migrations/0099_pilot_backing_separation.sql", [
  "fund_reward_treasury(",
  "pilot_mode = false",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("supabase/migrations/0100_variable_reward_cadence_policy.sql", [
  "variable_reward_cadence_policy_ready",
  "user_daily_ceiling_credits",
  "natural_variable_hourly_ceiling",
  "v_required_ceiling <> 1200",
  "release_variable_reward_cadence_policy_contract",
  "canonical release schema v55",
]);

forbidAll("supabase/migrations/0100_variable_reward_cadence_policy.sql", [
  "update public.reward_treasuries",
  "fund_reward_treasury(",
  "pilot_mode = false",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("supabase/migrations/0101_extra_withdrawal_launch_policy.sql", [
  "extra_withdrawals_enabled",
  "extra_withdrawal_fee_credits",
  "free_withdrawal_window_hours",
  "withdrawal:fee:",
  "withdrawal_fee",
  "service_fee_credits",
  "release_extra_withdrawal_launch_contract",
  "Canonical release schema remains v55/0055",
]);

forbidAll("supabase/migrations/0101_extra_withdrawal_launch_policy.sql", [
  "pilot_mode = false",
  "fund_reward_treasury(",
  "update public.reward_treasuries",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("supabase/migrations/0102_referral_network_launch_policy.sql", [
  "network_commission_enabled",
  "network_commission_bps",
  "network_commission_residual_cap_bps",
  "zz_network_commission_after_monetization",
  "release_network_commission_launch_contract",
  "v_gross_margin - v_referral_cost",
  "Canonical release schema remains v55/0055",
]);

forbidAll("supabase/migrations/0102_referral_network_launch_policy.sql", [
  "pilot_mode = false",
  "fund_reward_treasury(",
  "update public.reward_treasuries",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("supabase/migrations/0103_cashback_canonical_ingestion.sql", [
  "cashback_tracking_sessions",
  "apply_cashback_attributed_event",
  "tracking_already_bound",
  "p_commission_usd_micros::numeric * v_share_bps::numeric",
  "/ 10000000::numeric",
  "release_cashback_ingestion_contract",
  "Canonical release schema remains v55/0055",
]);

forbidAll("supabase/migrations/0103_cashback_canonical_ingestion.sql", [
  "pilot_mode = false",
  "fund_reward_treasury(",
  "update public.reward_treasuries",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("lib/controlled-technical-readiness.ts", [
  'admin.rpc("release_cashback_ingestion_contract")',
  'setupBlockers.push("cashback-ingestion")',
]);

requireAll("lib/controlled-technical-readiness.ts", [
  'admin.rpc("release_network_commission_launch_contract")',
  'setupBlockers.push("network-commission-launch")',
]);

requireAll("lib/controlled-technical-readiness.ts", [
  'admin.rpc("release_extra_withdrawal_launch_contract")',
  'setupBlockers.push("extra-withdrawal-launch")',
]);

requireAll("lib/controlled-technical-readiness.ts", [
  'admin.rpc("release_variable_reward_cadence_policy_contract")',
  'setupBlockers.push("variable-reward-cadence-policy")',
]);

requireAll("lib/controlled-technical-readiness.ts", [
  'admin.rpc("release_pilot_backing_separation_contract")',
  'setupBlockers.push("pilot-backing-separation")',
]);

requireAll("lib/reward-contract.ts", [
  "getCurrentRewardContract",
  "variable_reward_enabled",
  "variable_reward_review_required",
  "totalProbabilityBps === 10_000",
  "creditsValue < baseCredits",
  "new Set(credits)",
]);

requireAll("lib/product-readiness.ts", [
  "getCurrentRewardContract",
  'eq("key", "pulse_economy_v13")',
  "authorizedRewardCredits.includes(Number(latestClaim.reward_credits))",
  '.in("reward_credits", authorizedRewardCredits.length ? authorizedRewardCredits : [rewardCredits])',
  "authorizedRewardCredits.includes(Number(chainClaim.reward_credits))",
  "Number(claimLedger.credits) === Number(chainClaim.reward_credits)",
]);

requireAll("lib/controlled-technical-readiness.ts", [
  "getCurrentRewardContract",
  "snapshot.pulse_economy",
  "authorizedRewardCredits.includes(numberValue(latestClaim.reward_credits))",
  "authorizedRewardCredits.includes(numberValue(chainClaim.reward_credits))",
  "numberValue(claimLedger.credits) === numberValue(chainClaim.reward_credits)",
]);

forbidAll("lib/product-readiness.ts", [
  'Number(latestClaim.reward_credits) === rewardCredits',
  '.eq("reward_credits", rewardCredits)',
  'Number(chainClaim.reward_credits) === rewardCredits',
  'Number(claimLedger.credits) === rewardCredits',
]);

forbidAll("lib/controlled-technical-readiness.ts", [
  'numberValue(latestClaim.reward_credits) === rewardCredits',
  'numberValue(chainClaim.reward_credits) === rewardCredits',
  'numberValue(claimLedger.credits) === rewardCredits',
]);

forbidAll("supabase/migrations/0086_variable_reward_budget_readiness.sql", [
  "'variable_reward_enabled', true",
  "'variable_reward_review_required', false",
  "pilot_mode = false",
  "fund_reward_treasury(",
  "'version', 56",
  "schema_version = 56",
]);

forbidAll("supabase/migrations/0085_cashback_budget_authority.sql", [
  "cashback_enabled','true",
  "pilot_mode = false",
  "fund_reward_treasury(",
  "'version', 56",
  "schema_version = 56",
]);

forbidAll("supabase/migrations/0084_stacked_incentive_budget_authority.sql", [
  "network_commission_enabled','true",
  "cashback_enabled','true",
  "variable_reward_enabled','true",
  "pilot_mode = false",
  "fund_reward_treasury(",
  "'version', 56",
  "schema_version = 56",
]);

const authActions = read("app/auth/actions.ts");
const signInStart = authActions.indexOf("export async function signIn");
const signUpStart = authActions.indexOf("export async function signUp");
if (signInStart < 0 || signUpStart <= signInStart) {
  throw new Error("Could not isolate signIn for referral acquisition contract.");
}
const signInBody = authActions.slice(signInStart, signUpStart);
if (signInBody.includes("bindReferralForUser")) {
  throw new Error("Normal sign-in must not create referral attribution.");
}

forbidAll("supabase/migrations/0082_referral_network_cycle_guard.sql", [
  "network_commission_enabled','true",
  "pilot_mode = false",
  "fund_reward_treasury(",
  "'version', 56",
  "schema_version = 56",
]);

const migration0082 = read("supabase/migrations/0082_referral_network_cycle_guard.sql");
if (/\nas \$\n/.test(migration0082) || /\n\$;\n/.test(migration0082)) {
  throw new Error("Migration 0082 contains an invalid single-dollar PL/pgSQL delimiter.");
}

requireAll("app/api/direct/start/route.ts", [
  "isTrustedSameOriginMutation(request)",
  'return json(401, { status: "auth-required" })',
  'target.protocol !== "https:"',
  "destination: target.toString()",
]);

forbidAll("app/api/direct/start/route.ts", [
  "NextResponse.redirect(target",
  "NextResponse.redirect(new URL(destination",
]);

requireAll("components/direct-start-button.tsx", [
  'fetch("/api/direct/start"',
  'method: "POST"',
  'credentials: "same-origin"',
  'target.protocol !== "https:"',
  "window.location.assign(target.toString())",
]);

requireAll("lib/controlled-technical-readiness.ts", [
  'admin.rpc("release_referral_network_integrity_contract")',
  'setupBlockers.push("referral-network-integrity")',
  'admin.rpc("release_stacked_incentive_budget_contract")',
  'setupBlockers.push("stacked-incentive-budget")',
  'admin.rpc("release_cashback_budget_contract")',
  'setupBlockers.push("cashback-budget")',
  'admin.rpc("release_variable_reward_budget_contract")',
  'setupBlockers.push("variable-reward-budget")',
  'admin.rpc("release_variable_reward_execution_contract")',
  'setupBlockers.push("variable-reward-execution")',
]);

const earn = requireAll("app/earn/page.tsx", [
  "DirectStartButton",
  "campaignId={best.externalId}",
  "campaignId={item.externalId}",
]);
if (earn.includes('action="/api/direct/start"')) {
  throw new Error("Pulse Direct must not depend on a form redirect to an external advertiser.");
}

const csp = read("next.config.ts");
if (!csp.includes(`"form-action 'self' https://faucetpay.io"`)) {
  throw new Error("CSP must allow only the explicit FaucetPay merchant form destination alongside self.");
}
if (/[\`"]form-action 'self' https:[\`"]/.test(csp)) {
  throw new Error("CSP form-action must not be widened to arbitrary HTTPS origins.");
}

console.log("Adversarial economy + referral graph contract PASS");
