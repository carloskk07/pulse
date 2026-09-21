import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCanonicalFaucetPayPackAuthority } from "@/lib/treasury-backing";
import { getTreasuryDailyFundingState } from "@/lib/treasury";

const INITIAL_PAID_USER_TARGET = 5;

export type FaucetLaunchRunway = {
  available: boolean;
  targetPaidUsers: number;
  paidUsers: number;
  remainingPaidUsers: number;
  currentProfiles: number;
  unpaidExistingProfiles: number;
  payoutPackCredits: number;
  minimumClaimCreditsNeeded: number;
  treasuryAvailableCredits: number;
  treasuryCreditGap: number;
};

function unavailable(): FaucetLaunchRunway {
  return {
    available: false,
    targetPaidUsers: INITIAL_PAID_USER_TARGET,
    paidUsers: 0,
    remainingPaidUsers: INITIAL_PAID_USER_TARGET,
    currentProfiles: 0,
    unpaidExistingProfiles: 0,
    payoutPackCredits: 0,
    minimumClaimCreditsNeeded: 0,
    treasuryAvailableCredits: 0,
    treasuryCreditGap: 0,
  };
}

export async function getFaucetLaunchRunway(): Promise<FaucetLaunchRunway> {
  const admin = createSupabaseAdminClient();
  if (!admin) return unavailable();

  const [authority, treasury, profilesResult, balancesResult, paidResult] = await Promise.all([
    getCanonicalFaucetPayPackAuthority(admin),
    getTreasuryDailyFundingState("launch"),
    admin.from("profiles").select("id"),
    admin.from("user_balance_state").select("user_id,available_credits"),
    admin
      .from("withdrawals")
      .select("user_id")
      .eq("status", "paid")
      .eq("payout_provider", "faucetpay"),
  ]);

  if (
    !authority
    || !treasury
    || profilesResult.error
    || balancesResult.error
    || paidResult.error
  ) {
    return unavailable();
  }

  const payoutPackCredits = authority.amountCredits;
  const paidUsers = new Set((paidResult.data ?? []).map((row) => String(row.user_id)));
  const currentProfiles = (profilesResult.data ?? []).map((row) => String(row.id));
  const balances = new Map(
    (balancesResult.data ?? []).map((row) => [
      String(row.user_id),
      Math.max(0, Number(row.available_credits ?? 0)),
    ]),
  );

  const remainingPaidUsers = Math.max(0, INITIAL_PAID_USER_TARGET - paidUsers.size);
  const unpaidExisting = currentProfiles
    .filter((userId) => !paidUsers.has(userId))
    .map((userId) => ({
      userId,
      creditsNeeded: Math.max(0, payoutPackCredits - (balances.get(userId) ?? 0)),
    }))
    .sort((a, b) => a.creditsNeeded - b.creditsNeeded);

  const existingCandidates = unpaidExisting.slice(0, remainingPaidUsers);
  const missingNewUsers = Math.max(0, remainingPaidUsers - existingCandidates.length);
  const minimumClaimCreditsNeeded =
    existingCandidates.reduce((sum, candidate) => sum + candidate.creditsNeeded, 0)
    + missingNewUsers * payoutPackCredits;
  const treasuryAvailableCredits = Math.max(0, treasury.availableCredits);
  const treasuryCreditGap = Math.max(0, minimumClaimCreditsNeeded - treasuryAvailableCredits);

  return {
    available: true,
    targetPaidUsers: INITIAL_PAID_USER_TARGET,
    paidUsers: paidUsers.size,
    remainingPaidUsers,
    currentProfiles: currentProfiles.length,
    unpaidExistingProfiles: unpaidExisting.length,
    payoutPackCredits,
    minimumClaimCreditsNeeded,
    treasuryAvailableCredits,
    treasuryCreditGap,
  };
}
