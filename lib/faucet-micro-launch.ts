import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFaucetLaunchState } from "@/lib/faucet-launch";
import { getFaucetLaunchRunway } from "@/lib/faucet-launch-runway";
import { getTreasuryDailyFundingState } from "@/lib/treasury";

export const MICRO_LAUNCH_POLICY = {
  dailyBudgetCredits: 10,
  maxUserDailyCredits: 2,
  paidUserEvidenceTarget: 5,
} as const;

export type FaucetMicroLaunchPlan = {
  available: boolean;
  stage: "CONTROLLED" | "CAPS_READY" | "READY_FOR_MICRO_OPEN" | "MICRO_OPEN" | "EVIDENCE_TARGET_REACHED";
  rewardCredits: number;
  payoutPackCredits: number;
  dailyBudgetCredits: number;
  maxUserDailyCredits: number;
  supportedUsersPerFullDay: number;
  claimsPerUserPerDay: number;
  daysToPayoutAtCap: number | null;
  capsReady: boolean;
  dayOneFunded: boolean;
  dayOneFundingGapCredits: number;
  backingReady: boolean;
  pilotMode: boolean;
  paidUsers: number;
  paidUserEvidenceTarget: number;
  remainingPaidUsers: number;
  proofRunwayCreditsNeeded: number;
  proofRunwayFundingGapCredits: number;
  activationEligible: boolean;
  scaleEvidenceReached: boolean;
};

function unavailable(): FaucetMicroLaunchPlan {
  return {
    available: false,
    stage: "CONTROLLED",
    rewardCredits: 0,
    payoutPackCredits: 0,
    dailyBudgetCredits: 0,
    maxUserDailyCredits: 0,
    supportedUsersPerFullDay: 0,
    claimsPerUserPerDay: 0,
    daysToPayoutAtCap: null,
    capsReady: false,
    dayOneFunded: false,
    dayOneFundingGapCredits: 0,
    backingReady: false,
    pilotMode: true,
    paidUsers: 0,
    paidUserEvidenceTarget: MICRO_LAUNCH_POLICY.paidUserEvidenceTarget,
    remainingPaidUsers: MICRO_LAUNCH_POLICY.paidUserEvidenceTarget,
    proofRunwayCreditsNeeded: 0,
    proofRunwayFundingGapCredits: 0,
    activationEligible: false,
    scaleEvidenceReached: false,
  };
}

export async function getFaucetMicroLaunchPlan(): Promise<FaucetMicroLaunchPlan> {
  const admin = createSupabaseAdminClient();
  if (!admin) return unavailable();

  const [launch, runway, treasury, authorityResult] = await Promise.all([
    getFaucetLaunchState(),
    getFaucetLaunchRunway(),
    getTreasuryDailyFundingState("launch"),
    admin.from("payout_pack_authority").select("amount_credits").eq("provider", "faucetpay").maybeSingle(),
  ]);

  if (!launch.available || !runway.available || !treasury || authorityResult.error || !authorityResult.data) {
    return unavailable();
  }

  const payoutPackCredits = Math.max(0, Number(authorityResult.data.amount_credits ?? 0));
  const rewardCredits = Math.max(1, launch.rewardCredits);
  const supportedUsersPerFullDay = treasury.maxUserDailyCredits > 0
    ? Math.floor(treasury.dailyBudgetCredits / treasury.maxUserDailyCredits)
    : 0;
  const claimsPerUserPerDay = treasury.maxUserDailyCredits > 0
    ? Math.floor(treasury.maxUserDailyCredits / rewardCredits)
    : 0;
  const daysToPayoutAtCap = treasury.maxUserDailyCredits > 0 && payoutPackCredits > 0
    ? Math.ceil(payoutPackCredits / treasury.maxUserDailyCredits)
    : null;

  const capsReady =
    treasury.dailyBudgetCredits === MICRO_LAUNCH_POLICY.dailyBudgetCredits
    && treasury.maxUserDailyCredits === MICRO_LAUNCH_POLICY.maxUserDailyCredits
    && supportedUsersPerFullDay >= MICRO_LAUNCH_POLICY.paidUserEvidenceTarget;

  const dayOneFundingGapCredits = Math.max(
    0,
    treasury.remainingDailyBudgetCredits - treasury.availableCredits,
  );
  const dayOneFunded = dayOneFundingGapCredits === 0;
  const paidUsers = runway.paidUsers;
  const scaleEvidenceReached = paidUsers >= MICRO_LAUNCH_POLICY.paidUserEvidenceTarget;
  const activationEligible = capsReady && dayOneFunded && launch.backingReady;

  const stage: FaucetMicroLaunchPlan["stage"] = scaleEvidenceReached
    ? "EVIDENCE_TARGET_REACHED"
    : !launch.pilotMode
      ? "MICRO_OPEN"
      : activationEligible
        ? "READY_FOR_MICRO_OPEN"
        : capsReady
          ? "CAPS_READY"
          : "CONTROLLED";

  return {
    available: true,
    stage,
    rewardCredits,
    payoutPackCredits,
    dailyBudgetCredits: treasury.dailyBudgetCredits,
    maxUserDailyCredits: treasury.maxUserDailyCredits,
    supportedUsersPerFullDay,
    claimsPerUserPerDay,
    daysToPayoutAtCap,
    capsReady,
    dayOneFunded,
    dayOneFundingGapCredits,
    backingReady: launch.backingReady,
    pilotMode: launch.pilotMode,
    paidUsers,
    paidUserEvidenceTarget: MICRO_LAUNCH_POLICY.paidUserEvidenceTarget,
    remainingPaidUsers: Math.max(0, MICRO_LAUNCH_POLICY.paidUserEvidenceTarget - paidUsers),
    proofRunwayCreditsNeeded: runway.minimumClaimCreditsNeeded,
    proofRunwayFundingGapCredits: runway.treasuryCreditGap,
    activationEligible,
    scaleEvidenceReached,
  };
}
