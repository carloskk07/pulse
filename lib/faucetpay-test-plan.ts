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
  claimsFromZero: number | null;
  minimumElapsedMinutes: number | null;
  treasuryCreditsRequired: number | null;
  treasuryOvershootCredits: number | null;
  currentTreasuryAvailableCredits: number | null;
  treasuryDeficitCredits: number | null;
  treasuryEnabled: boolean | null;
  treasuryKillSwitch: boolean | null;
  detail: string;
};

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
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

  if (!payoutCredits) {
    return {
      feasibility: "AWAITING_PACK",
      payoutCredits: null,
      payoutUsd: null,
      pulseRewardCredits: null,
      pulseIntervalMinutes: null,
      claimsFromZero: null,
      minimumElapsedMinutes: null,
      treasuryCreditsRequired: null,
      treasuryOvershootCredits: null,
      currentTreasuryAvailableCredits: null,
      treasuryDeficitCredits: null,
      treasuryEnabled: null,
      treasuryKillSwitch: null,
      detail: "No explicit payout-credit pack is configured. The planner will not invent one.",
    };
  }

  if (!admin) {
    return {
      feasibility: "AWAITING_PULSE_CONTRACT",
      payoutCredits,
      payoutUsd,
      pulseRewardCredits: null,
      pulseIntervalMinutes: null,
      claimsFromZero: null,
      minimumElapsedMinutes: null,
      treasuryCreditsRequired: null,
      treasuryOvershootCredits: null,
      currentTreasuryAvailableCredits: null,
      treasuryDeficitCredits: null,
      treasuryEnabled: null,
      treasuryKillSwitch: null,
      detail: "Trusted database authority is unavailable, so the live Hourly Pulse contract cannot be used for planning.",
    };
  }

  const [{ data: pulseRow, error: pulseError }, { data: treasury, error: treasuryError }] = await Promise.all([
    admin.from("app_config").select("value").eq("key", "hourly_pulse").maybeSingle(),
    admin.from("reward_treasuries")
      .select("funded_credits,reserved_credits,spent_credits,enabled,kill_switch")
      .eq("code", "launch")
      .maybeSingle(),
  ]);

  const pulse = pulseRow?.value as { credits?: number | string; interval_minutes?: number | string } | null | undefined;
  const pulseRewardCredits = positiveInteger(pulse?.credits);
  const pulseIntervalMinutes = positiveInteger(pulse?.interval_minutes);

  const funded = Number(treasury?.funded_credits ?? 0);
  const reserved = Number(treasury?.reserved_credits ?? 0);
  const spent = Number(treasury?.spent_credits ?? 0);
  const available = !treasuryError && Number.isFinite(funded) && Number.isFinite(reserved) && Number.isFinite(spent)
    ? Math.max(0, funded - reserved - spent)
    : null;

  if (pulseError || !pulseRewardCredits || !pulseIntervalMinutes) {
    return {
      feasibility: "AWAITING_PULSE_CONTRACT",
      payoutCredits,
      payoutUsd,
      pulseRewardCredits,
      pulseIntervalMinutes,
      claimsFromZero: null,
      minimumElapsedMinutes: null,
      treasuryCreditsRequired: null,
      treasuryOvershootCredits: null,
      currentTreasuryAvailableCredits: available,
      treasuryDeficitCredits: null,
      treasuryEnabled: treasuryError ? null : treasury?.enabled === true,
      treasuryKillSwitch: treasuryError ? null : treasury?.kill_switch === true,
      detail: "The live Hourly Pulse reward or rolling interval is not available as a positive integer, so no test duration was guessed.",
    };
  }

  const claimsFromZero = Math.ceil(payoutCredits / pulseRewardCredits);
  const minimumElapsedMinutes = Math.max(0, claimsFromZero - 1) * pulseIntervalMinutes;
  const treasuryCreditsRequired = claimsFromZero * pulseRewardCredits;
  const treasuryOvershootCredits = treasuryCreditsRequired - payoutCredits;
  const treasuryDeficitCredits = available === null ? null : Math.max(0, treasuryCreditsRequired - available);
  const feasibility = classifyElapsed(minimumElapsedMinutes);

  const durationText = feasibility === "SAME_DAY"
    ? "within one day in the theoretical best case"
    : feasibility === "MULTI_DAY"
      ? "across multiple days even in the theoretical best case"
      : "longer than seven days even in the theoretical best case";

  return {
    feasibility,
    payoutCredits,
    payoutUsd,
    pulseRewardCredits,
    pulseIntervalMinutes,
    claimsFromZero,
    minimumElapsedMinutes,
    treasuryCreditsRequired,
    treasuryOvershootCredits,
    currentTreasuryAvailableCredits: available,
    treasuryDeficitCredits,
    treasuryEnabled: treasuryError ? null : treasury?.enabled === true,
    treasuryKillSwitch: treasuryError ? null : treasury?.kill_switch === true,
    detail: `From a zero balance, the configured pack would require ${claimsFromZero.toLocaleString("en-US")} real Hourly Pulse claim(s) and is reachable ${durationText}. This is arithmetic planning only; it does not approve Treasury funding or assert a FaucetPay minimum payout.`,
  };
}
