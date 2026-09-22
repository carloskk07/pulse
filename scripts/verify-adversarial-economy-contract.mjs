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
  "canonical release schema remains v55/0055",
]);

forbidAll("supabase/migrations/0094_variable_reward_launch_preparation.sql", [
  "pilot_mode = false",
  "fund_reward_treasury(",
  "'version', 56",
  "schema_version = 56",
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
