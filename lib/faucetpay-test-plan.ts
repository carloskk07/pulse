import { CREDITS_PER_USD } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export type FaucetPayTestFeasibility =
  | "AWAITING_PACK"
  | "AWAITING_PULSE_CONTRACT"
  | "SAME_DAY"
  | "MULTI_DAY"
  | "LONG_TEST";

export type FaucetPayTestPlan = {
  feasibility: FaucetPayTestFeasibility;
  payoutCredits: number | null;
  payoutUsd: number | null;
  pulseRewardCredits: number | null;
  pulseIntervalMinutes: number | null;
  treasuryCode: string | null;
  claimsFromZero: number | null;
  minimumElapsedMinutes: number | null;
  treasuryCreditsRequired: number | null;
  treasuryOvershootCredits: number | null;
  fastestDayClaimCount: number | null;
  minimumDailyBudgetCredits: number | null;
  minimumUserDailyCapCredits: number | null;
  currentTreasuryAvailableCredits: number | null;
  currentDailyBudgetCredits: number | null;
  currentUserDailyCapCredits: number | null;
  treasuryDeficitCredits: number | null;
  dailyBudgetDeficitCredits: number | null;
  userDailyCapDeficitCredits: number | null;
  treasuryEnabled: boolean | null;
  treasuryKillSwitch: boolean | null;
  detail: string;
};

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function classifyElapsed(minutes: number): FaucetPayTestFeasibility {
  if (minutes <= 24 * 60) return "SAME_DAY";
  if (minutes <= 7 * 24 * 60) return "MULTI_DAY";
  return "LONG_TEST";
}

export async function getFaucetPayTestPlan(): Promise<FaucetPayTestPlan> {
  const payout = getFaucetPayPackConfig();
  const payoutCredits = payout.amountCredits;
  const payoutUsd = payoutCredits ? payoutCredits / CREDITS_PER_USD : null;
  const admin = createSupabaseAdminClient();

  const emptyOperational = {
    treasuryCode: null,
    claimsFromZero: null,
    minimumElapsedMinutes: null,
    treasuryCreditsRequired: null,
    treasuryOvershootCredits: null,
    fastestDayClaimCount: null,
    minimumDailyBudgetCredits: null,
    minimumUserDailyCapCredits: null,
    currentTreasuryAvailableCredits: null,
    currentDailyBudgetCredits: null,
    currentUserDailyCapCredits: null,
    treasuryDeficitCredits: null,
    dailyBudgetDeficitCredits: null,
    userDailyCapDeficitCredits: null,
    treasuryEnabled: null,
    treasuryKillSwitch: null,
  };

  if (!admin) {
    return {
      feasibility: payoutCredits ? "AWAITING_PULSE_CONTRACT" : "AWAITING_PACK",
      payoutCredits,
      payoutUsd,
      pulseRewardCredits: null,
      pulseIntervalMinutes: null,
      ...emptyOperational,
      detail: payoutCredits
        ? "Trusted database authority is unavailable, so the live Hourly Pulse contract cannot be used for planning."
        : "No explicit payout-credit pack is configured and trusted database authority is unavailable. The planner will not invent either side of the test.",
    };
  }

  const { data: pulseRow, error: pulseError } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "hourly_pulse")
    .maybeSingle();

  const pulse = pulseRow?.value as {
    credits?: number | string;
    interval_minutes?: number | string;
    treasury_code?: string;
  } | null | undefined;
  const pulseRewardCredits = positiveInteger(pulse?.credits);
  const pulseIntervalMinutes = positiveInteger(pulse?.interval_minutes);
  const treasuryCode = pulse?.treasury_code?.trim() || "launch";

  const { data: treasury, error: treasuryError } = await admin
    .from("reward_treasuries")
    .select("funded_credits,reserved_credits,spent_credits,daily_budget_credits,max_user_daily_credits,enabled,kill_switch")
    .eq("code", treasuryCode)
    .maybeSingle();

  const funded = nonNegativeInteger(treasury?.funded_credits);
  const reserved = nonNegativeInteger(treasury?.reserved_credits);
  const spent = nonNegativeInteger(treasury?.spent_credits);
  const available = !treasuryError && funded !== null && reserved !== null && spent !== null
    ? Math.max(0, funded - reserved - spent)
    : null;
  const currentDailyBudgetCredits = treasuryError ? null : nonNegativeInteger(treasury?.daily_budget_credits);
  const currentUserDailyCapCredits = treasuryError ? null : nonNegativeInteger(treasury?.max_user_daily_credits);
  const treasuryEnabled = treasuryError ? null : treasury?.enabled === true;
  const treasuryKillSwitch = treasuryError ? null : treasury?.kill_switch === true;

  const liveBase = {
    payoutCredits,
    payoutUsd,
    pulseRewardCredits,
    pulseIntervalMinutes,
    treasuryCode,
    currentTreasuryAvailableCredits: available,
    currentDailyBudgetCredits,
    currentUserDailyCapCredits,
    treasuryEnabled,
    treasuryKillSwitch,
  };

  if (!payoutCredits) {
    return {
      feasibility: "AWAITING_PACK",
      ...liveBase,
      claimsFromZero: null,
      minimumElapsedMinutes: null,
      treasuryCreditsRequired: null,
      treasuryOvershootCredits: null,
      fastestDayClaimCount: null,
      minimumDailyBudgetCredits: null,
      minimumUserDailyCapCredits: null,
      treasuryDeficitCredits: null,
      dailyBudgetDeficitCredits: null,
      userDailyCapDeficitCredits: null,
      detail: "No explicit payout-credit pack is configured. Live Pulse/Treasury state is shown for context, but the planner will not invent a target payout.",
    };
  }

  if (pulseError || !pulseRewardCredits || !pulseIntervalMinutes) {
    return {
      feasibility: "AWAITING_PULSE_CONTRACT",
      ...liveBase,
      claimsFromZero: null,
      minimumElapsedMinutes: null,
      treasuryCreditsRequired: null,
      treasuryOvershootCredits: null,
      fastestDayClaimCount: null,
      minimumDailyBudgetCredits: null,
      minimumUserDailyCapCredits: null,
      treasuryDeficitCredits: null,
      dailyBudgetDeficitCredits: null,
      userDailyCapDeficitCredits: null,
      detail: "The live Hourly Pulse reward or rolling interval is not available as a positive integer, so no test duration or budget was guessed.",
    };
  }

  const claimsFromZero = Math.ceil(payoutCredits / pulseRewardCredits);
  const minimumElapsedMinutes = Math.max(0, claimsFromZero - 1) * pulseIntervalMinutes;
  const treasuryCreditsRequired = claimsFromZero * pulseRewardCredits;
  const treasuryOvershootCredits = treasuryCreditsRequired - payoutCredits;
  const theoreticalClaimsPerUtcDay = Math.ceil((24 * 60) / pulseIntervalMinutes);
  const fastestDayClaimCount = Math.min(claimsFromZero, theoreticalClaimsPerUtcDay);
  const minimumDailyBudgetCredits = fastestDayClaimCount * pulseRewardCredits;
  const minimumUserDailyCapCredits = minimumDailyBudgetCredits;
  const treasuryDeficitCredits = available === null ? null : Math.max(0, treasuryCreditsRequired - available);
  const dailyBudgetDeficitCredits = currentDailyBudgetCredits === null
    ? null
    : Math.max(0, minimumDailyBudgetCredits - currentDailyBudgetCredits);
  const userDailyCapDeficitCredits = currentUserDailyCapCredits === null
    ? null
    : Math.max(0, minimumUserDailyCapCredits - currentUserDailyCapCredits);
  const feasibility = classifyElapsed(minimumElapsedMinutes);

  const durationText = feasibility === "SAME_DAY"
    ? "within one day in the theoretical best case"
    : feasibility === "MULTI_DAY"
      ? "across multiple days even in the theoretical best case"
      : "longer than seven days even in the theoretical best case";

  return {
    feasibility,
    ...liveBase,
    claimsFromZero,
    minimumElapsedMinutes,
    treasuryCreditsRequired,
    treasuryOvershootCredits,
    fastestDayClaimCount,
    minimumDailyBudgetCredits,
    minimumUserDailyCapCredits,
    treasuryDeficitCredits,
    dailyBudgetDeficitCredits,
    userDailyCapDeficitCredits,
    detail: `From a zero balance, the configured pack would require ${claimsFromZero.toLocaleString("en-US")} real Hourly Pulse claim(s) and is reachable ${durationText}. The daily budget and user-cap figures are the arithmetic minimums for one isolated test user on the fastest valid schedule; existing claims or reservations would require additional headroom. This planner does not approve any funding or assert a FaucetPay minimum payout.`,
  };
}
