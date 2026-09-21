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
  "Public claiming stays closed until funded capacity and fair-share are ready.",
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

requireAll("lib/faucet-micro-launch.ts", [
  "dailyBudgetCredits: 10",
  "maxUserDailyCredits: 2",
  "paidUserEvidenceTarget: 5",
  "supportedUsersPerFullDay",
  "daysToPayoutAtCap",
  "dayOneFundingGapCredits",
  "proofRunwayFundingGapCredits",
  "activationEligible",
  '"READY_FOR_MICRO_OPEN"',
  '"EVIDENCE_TARGET_REACHED"',
]);
forbidAll("lib/faucet-micro-launch.ts", [
  ".insert(",
  ".update(",
  ".upsert(",
  ".delete(",
  "fund_reward_treasury",
  "pilot_mode:",
]);

requireAll("app/admin/product/page.tsx", [
  "Controlled micro-launch",
  "Users/day at full share",
  "Day-one funding gap",
  "Full proof runway gap",
  "Do not open public claims yet.",
]);

if (runway.includes("INITIAL_PAID_USER_TARGET = 2")) {
  throw new Error("Internal strong initial evidence target must not regress to the documentary minimum.");
}

console.log("Faucet backing + launch runway contract PASS");
