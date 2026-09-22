import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTreasuryDailyFundingState } from "@/lib/treasury";
import { getTreasuryBackingGuard, type TreasuryBackingStatus } from "@/lib/treasury-backing";

export type FaucetLaunchState = {
  available: boolean;
  publicClaimsOpen: boolean;
  pilotMode: boolean;
  rewardCredits: number;
  rewardVariable: boolean;
  rewardMinCredits: number;
  rewardMaxCredits: number;
  intervalMinutes: number;
  availableClaims: number;
  remainingDailyClaims: number;
  backingStatus: TreasuryBackingStatus;
  backingReady: boolean;
  reason: "ready" | "pilot" | "backing" | "treasury" | "fair_share" | "unavailable";
};

function asInt(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

export async function getFaucetLaunchState(): Promise<FaucetLaunchState> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      available: false,
      publicClaimsOpen: false,
      pilotMode: true,
      rewardCredits: 0,
      rewardVariable: false,
      rewardMinCredits: 0,
      rewardMaxCredits: 0,
      intervalMinutes: 60,
      availableClaims: 0,
      remainingDailyClaims: 0,
      backingStatus: "backing_unavailable",
      backingReady: false,
      reason: "unavailable",
    };
  }

  const { data, error } = await admin
    .from("app_config")
    .select("key,value")
    .in("key", ["hourly_pulse", "pulse_economy_v13"]);

  const pulseRow = data?.find((row) => row.key === "hourly_pulse");
  const economyRow = data?.find((row) => row.key === "pulse_economy_v13");

  if (error || !pulseRow?.value || typeof pulseRow.value !== "object") {
    return {
      available: false,
      publicClaimsOpen: false,
      pilotMode: true,
      rewardCredits: 0,
      rewardVariable: false,
      rewardMinCredits: 0,
      rewardMaxCredits: 0,
      intervalMinutes: 60,
      availableClaims: 0,
      remainingDailyClaims: 0,
      backingStatus: "backing_unavailable",
      backingReady: false,
      reason: "unavailable",
    };
  }

  const config = pulseRow.value as Record<string, unknown>;
  const economy = economyRow?.value && typeof economyRow.value === "object"
    ? economyRow.value as Record<string, unknown>
    : {};
  const rewardCredits = Math.max(1, asInt(config.credits, 1));
  const rewardBands = Array.isArray(economy.reward_bands)
    ? economy.reward_bands.filter((band): band is Record<string, unknown> => Boolean(band) && typeof band === "object" && !Array.isArray(band))
    : [];
  const validBandCredits = rewardBands
    .map((band) => asInt(band.credits, 0))
    .filter((value) => value > 0);
  const variableEnabled = ["true", "1", "yes", "on"].includes(String(economy.variable_reward_enabled ?? "false").toLowerCase());
  const variableReviewRequired = !["false", "0", "no", "off"].includes(String(economy.variable_reward_review_required ?? "true").toLowerCase());
  const rewardVariable = variableEnabled && !variableReviewRequired && validBandCredits.length > 0;
  const rewardMinCredits = rewardVariable ? Math.min(...validBandCredits) : rewardCredits;
  const rewardMaxCredits = rewardVariable ? Math.max(...validBandCredits) : rewardCredits;
  const intervalMinutes = Math.max(15, asInt(config.interval_minutes, 60));
  const treasuryCode = String(config.treasury_code ?? "launch");
  const pilotMode = ["true", "1", "yes", "on"].includes(String(config.pilot_mode ?? "false").toLowerCase());
  const [treasury, backingStatus] = await Promise.all([
    getTreasuryDailyFundingState(treasuryCode),
    getTreasuryBackingGuard(treasuryCode, admin),
  ]);
  const backingReady = backingStatus === "backing_ready";

  if (!treasury) {
    return {
      available: true,
      publicClaimsOpen: false,
      pilotMode,
      rewardCredits,
      rewardVariable,
      rewardMinCredits,
      rewardMaxCredits,
      intervalMinutes,
      availableClaims: 0,
      remainingDailyClaims: 0,
      backingStatus,
      backingReady,
      reason: "treasury",
    };
  }

  const fairShareReady = treasury.maxUserDailyCredits > 0
    && treasury.dailyBudgetCredits > 0
    && treasury.maxUserDailyCredits * 2 <= treasury.dailyBudgetCredits;
  const budgetUnitCredits = rewardVariable ? rewardMaxCredits : rewardCredits;
  const availableClaims = Math.floor(treasury.availableCredits / budgetUnitCredits);
  const remainingDailyClaims = Math.floor(treasury.remainingDailyBudgetCredits / budgetUnitCredits);
  const treasuryReady = treasury.enabled
    && !treasury.killSwitch
    && treasury.availableCredits >= budgetUnitCredits
    && treasury.remainingDailyBudgetCredits >= budgetUnitCredits;

  return {
    available: true,
    publicClaimsOpen: !pilotMode && backingReady && fairShareReady && treasuryReady,
    pilotMode,
    rewardCredits,
    rewardVariable,
    rewardMinCredits,
    rewardMaxCredits,
    intervalMinutes,
    availableClaims,
    remainingDailyClaims,
    backingStatus,
    backingReady,
    reason: pilotMode ? "pilot" : !backingReady ? "backing" : !fairShareReady ? "fair_share" : !treasuryReady ? "treasury" : "ready",
  };
}
