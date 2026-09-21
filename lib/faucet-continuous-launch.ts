import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFaucetLaunchState } from "@/lib/faucet-launch";
import { getCanonicalFaucetPayPackAuthority } from "@/lib/treasury-backing";
import { getTreasuryDailyFundingState } from "@/lib/treasury";

export type FaucetContinuousLaunchPlan = {
  available: boolean;
  stage: "CONTROLLED" | "CADENCE_READY" | "BACKING_REQUIRED" | "FUNDING_REQUIRED" | "READY_TO_OPEN" | "PUBLIC";
  intervalMinutes: number;
  windowsPerDay: number;
  baseRewardCredits: number;
  variableRewardsEnabled: boolean;
  minRewardCredits: number;
  maxRewardCredits: number;
  expectedRewardCredits: number;
  naturalDailyCeilingCredits: number;
  configuredUserDailyCredits: number;
  cadenceUnrestricted: boolean;
  dailyBudgetCredits: number;
  minimumFairShareBudgetCredits: number;
  dailyBudgetSupportsContinuousUse: boolean;
  treasuryAvailableCredits: number;
  dayOneFundingGapCredits: number;
  backingReady: boolean;
  pilotMode: boolean;
  payoutPackCredits: number;
};

function unavailable(): FaucetContinuousLaunchPlan {
  return {
    available: false,
    stage: "CONTROLLED",
    intervalMinutes: 60,
    windowsPerDay: 24,
    baseRewardCredits: 0,
    variableRewardsEnabled: false,
    minRewardCredits: 0,
    maxRewardCredits: 0,
    expectedRewardCredits: 0,
    naturalDailyCeilingCredits: 0,
    configuredUserDailyCredits: 0,
    cadenceUnrestricted: false,
    dailyBudgetCredits: 0,
    minimumFairShareBudgetCredits: 0,
    dailyBudgetSupportsContinuousUse: false,
    treasuryAvailableCredits: 0,
    dayOneFundingGapCredits: 0,
    backingReady: false,
    pilotMode: true,
    payoutPackCredits: 0,
  };
}

function bool(value: unknown) {
  return ["true", "1", "yes", "on"].includes(String(value ?? "false").toLowerCase());
}

export async function getFaucetContinuousLaunchPlan(): Promise<FaucetContinuousLaunchPlan> {
  const admin = createSupabaseAdminClient();
  if (!admin) return unavailable();

  const [launch, treasury, authority, economyResult] = await Promise.all([
    getFaucetLaunchState(),
    getTreasuryDailyFundingState("launch"),
    getCanonicalFaucetPayPackAuthority(admin),
    admin.from("app_config").select("value").eq("key", "pulse_economy_v13").maybeSingle(),
  ]);

  if (!launch.available || !treasury || !authority || economyResult.error || !economyResult.data?.value) {
    return unavailable();
  }

  const economy = economyResult.data.value as Record<string, unknown>;
  const bands = Array.isArray(economy.reward_bands)
    ? economy.reward_bands.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
  const variableRewardsEnabled = bool(economy.variable_reward_enabled);
  const configuredCredits = Math.max(1, Math.floor(launch.rewardCredits));

  const bandCredits = bands
    .map((band) => Number(band.credits ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const minBand = bandCredits.length ? Math.min(...bandCredits) : configuredCredits;
  const maxBand = bandCredits.length ? Math.max(...bandCredits) : configuredCredits;
  const minRewardCredits = variableRewardsEnabled ? minBand : configuredCredits;
  const maxRewardCredits = variableRewardsEnabled ? maxBand : configuredCredits;

  const totalBps = bands.reduce((sum, band) => sum + Math.max(0, Number(band.probability_bps ?? 0)), 0);
  const weightedCredits = bands.reduce(
    (sum, band) => sum + Math.max(0, Number(band.credits ?? 0)) * Math.max(0, Number(band.probability_bps ?? 0)),
    0,
  );
  const expectedRewardCredits = variableRewardsEnabled && totalBps > 0
    ? weightedCredits / totalBps
    : configuredCredits;

  const intervalMinutes = Math.max(15, Math.floor(launch.intervalMinutes));
  const windowsPerDay = Math.max(1, Math.floor(1440 / intervalMinutes));
  const naturalDailyCeilingCredits = windowsPerDay * maxRewardCredits;
  const configuredUserDailyCredits = Math.max(0, treasury.maxUserDailyCredits);
  const cadenceUnrestricted = configuredUserDailyCredits >= naturalDailyCeilingCredits;

  // Existing public fair-share authority requires one account's natural maximum
  // to be no more than half of the global UTC-day budget.
  const minimumFairShareBudgetCredits = naturalDailyCeilingCredits * 2;
  const dailyBudgetSupportsContinuousUse = treasury.dailyBudgetCredits >= minimumFairShareBudgetCredits;

  const dayOneFundingGapCredits = Math.max(
    0,
    treasury.remainingDailyBudgetCredits - treasury.availableCredits,
  );

  const stage: FaucetContinuousLaunchPlan["stage"] = !launch.pilotMode
    ? "PUBLIC"
    : !cadenceUnrestricted
      ? "CONTROLLED"
      : !dailyBudgetSupportsContinuousUse
        ? "CADENCE_READY"
        : !launch.backingReady
          ? "BACKING_REQUIRED"
          : dayOneFundingGapCredits > 0
            ? "FUNDING_REQUIRED"
            : "READY_TO_OPEN";

  return {
    available: true,
    stage,
    intervalMinutes,
    windowsPerDay,
    baseRewardCredits: configuredCredits,
    variableRewardsEnabled,
    minRewardCredits,
    maxRewardCredits,
    expectedRewardCredits,
    naturalDailyCeilingCredits,
    configuredUserDailyCredits,
    cadenceUnrestricted,
    dailyBudgetCredits: treasury.dailyBudgetCredits,
    minimumFairShareBudgetCredits,
    dailyBudgetSupportsContinuousUse,
    treasuryAvailableCredits: treasury.availableCredits,
    dayOneFundingGapCredits,
    backingReady: launch.backingReady,
    pilotMode: launch.pilotMode,
    payoutPackCredits: authority.amountCredits,
  };
}
