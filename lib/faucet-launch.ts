import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTreasuryDailyFundingState } from "@/lib/treasury";

export type FaucetLaunchState = {
  available: boolean;
  publicClaimsOpen: boolean;
  pilotMode: boolean;
  rewardCredits: number;
  intervalMinutes: number;
  availableClaims: number;
  remainingDailyClaims: number;
  reason: "ready" | "pilot" | "treasury" | "fair_share" | "unavailable";
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
      intervalMinutes: 60,
      availableClaims: 0,
      remainingDailyClaims: 0,
      reason: "unavailable",
    };
  }

  const { data, error } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "hourly_pulse")
    .maybeSingle();

  if (error || !data?.value || typeof data.value !== "object") {
    return {
      available: false,
      publicClaimsOpen: false,
      pilotMode: true,
      rewardCredits: 0,
      intervalMinutes: 60,
      availableClaims: 0,
      remainingDailyClaims: 0,
      reason: "unavailable",
    };
  }

  const config = data.value as Record<string, unknown>;
  const rewardCredits = Math.max(1, asInt(config.credits, 1));
  const intervalMinutes = Math.max(15, asInt(config.interval_minutes, 60));
  const treasuryCode = String(config.treasury_code ?? "launch");
  const pilotMode = ["true", "1", "yes", "on"].includes(String(config.pilot_mode ?? "false").toLowerCase());
  const treasury = await getTreasuryDailyFundingState(treasuryCode);

  if (!treasury) {
    return {
      available: true,
      publicClaimsOpen: false,
      pilotMode,
      rewardCredits,
      intervalMinutes,
      availableClaims: 0,
      remainingDailyClaims: 0,
      reason: "treasury",
    };
  }

  const fairShareReady = treasury.maxUserDailyCredits > 0
    && treasury.dailyBudgetCredits > 0
    && treasury.maxUserDailyCredits * 2 <= treasury.dailyBudgetCredits;
  const availableClaims = Math.floor(treasury.availableCredits / rewardCredits);
  const remainingDailyClaims = Math.floor(treasury.remainingDailyBudgetCredits / rewardCredits);
  const treasuryReady = treasury.enabled
    && !treasury.killSwitch
    && treasury.availableCredits >= rewardCredits
    && treasury.remainingDailyBudgetCredits >= rewardCredits;

  return {
    available: true,
    publicClaimsOpen: !pilotMode && fairShareReady && treasuryReady,
    pilotMode,
    rewardCredits,
    intervalMinutes,
    availableClaims,
    remainingDailyClaims,
    reason: pilotMode ? "pilot" : !fairShareReady ? "fair_share" : !treasuryReady ? "treasury" : "ready",
  };
}
