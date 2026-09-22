import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireAll(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(`${path} missing faucet launch contract: ${fragment}`);
    }
  }
  return source;
}

function forbidAll(path, fragments) {
  const source = read(path).toLowerCase();
  for (const fragment of fragments) {
    if (source.includes(fragment.toLowerCase())) {
      throw new Error(`${path} contains forbidden launch-runway mutation: ${fragment}`);
    }
  }
}

requireAll("lib/faucet-launch.ts", [
  'getTreasuryBackingGuard',
  'backingStatus: TreasuryBackingStatus',
  'backingReady: boolean',
  'const backingReady = backingStatus === "backing_ready"',
  'publicClaimsOpen: !pilotMode && backingReady && fairShareReady && treasuryReady',
  '!backingReady ? "backing"',
]);

const runway = requireAll("lib/faucet-launch-runway.ts", [
  'const INITIAL_PAID_USER_TARGET = 5',
  'getCanonicalFaucetPayPackAuthority',
  'getTreasuryDailyFundingState("launch")',
  '.from("profiles").select("id")',
  '.from("user_balance_state").select("user_id,available_credits")',
  '.from("withdrawals")',
  '.eq("status", "paid")',
  '.eq("payout_provider", "faucetpay")',
  'minimumClaimCreditsNeeded',
  'treasuryCreditGap',
]);

forbidAll("lib/faucet-launch-runway.ts", [
  ".insert(",
  ".update(",
  ".upsert(",
  ".delete(",
  "pilot_mode",
  "funded_credits:",
  "daily_budget_credits:",
  "max_user_daily_credits:",
]);

requireAll("app/admin/page.tsx", [
  "Backing proof",
  "REFRESH REQUIRED",
  "Five-user payout runway",
  "Minimum claim credits needed",
  "Incremental Treasury gap",
  "faucetRunway.treasuryCreditGap",
]);

requireAll("app/faucet/page.tsx", [
  "launch.publicClaimsOpen",
  'state={launch.publicClaimsOpen ? "ready" : "limited"}',
  "Public claiming is currently limited.",
  "Claim availability is shown inside your account when access is open.",
]);

requireAll("lib/product-readiness.ts", [
  "getTreasuryBackingGuard",
  'id: "public-backing"',
  'publicBackingStatus === "backing_ready"',
  'new Set(["public-access", "public-fair-share", "public-backing"])',
]);
requireAll("lib/product-launch-readiness.ts", [
  'new Set(["public-access", "public-fair-share", "public-backing"])',
]);

requireAll("lib/faucet-continuous-launch.ts", [
  "windowsPerDay",
  "naturalDailyCeilingCredits",
  "configuredUserDailyCredits",
  "cadenceUnrestricted",
  "minimumFairShareBudgetCredits",
  "dailyBudgetSupportsContinuousUse",
  '"READY_TO_OPEN"',
  '"PUBLIC"',
  "variableRewardsEnabled",
]);
forbidAll("lib/faucet-continuous-launch.ts", [
  ".insert(",
  ".update(",
  ".upsert(",
  ".delete(",
  "fund_reward_treasury",
]);

requireAll("app/admin/product/page.tsx", [
  "Continuous hourly authority",
  "Natural user ceiling",
  "NO ARTIFICIAL USER CAP",
  "Global daily budget",
  "Variable monetary rewards remain separately gated",
]);

if (runway.includes("INITIAL_PAID_USER_TARGET = 2")) {
  throw new Error("Internal strong initial evidence target must not regress to the documentary minimum.");
}

console.log("Faucet backing + launch runway contract PASS");
