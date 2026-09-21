import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FaucetPayListingReadiness = {
  available: boolean;
  paidLast7d: number;
  uniqueUsersPaidLast7d: number;
  creditsPaidLast7d: number;
  allTimePaid: number;
  allTimeUniqueUsersPaid: number;
  documentationMinimumMet: boolean;
  strongInitialProofMet: boolean;
};

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export async function getFaucetPayListingReadiness(): Promise<FaucetPayListingReadiness> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      available: false,
      paidLast7d: 0,
      uniqueUsersPaidLast7d: 0,
      creditsPaidLast7d: 0,
      allTimePaid: 0,
      allTimeUniqueUsersPaid: 0,
      documentationMinimumMet: false,
      strongInitialProofMet: false,
    };
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [recentResult, allTimeResult] = await Promise.all([
    admin
      .from("withdrawals")
      .select("user_id,amount_credits")
      .eq("status", "paid")
      .eq("payout_provider", "faucetpay")
      .gte("updated_at", sevenDaysAgo),
    admin
      .from("withdrawals")
      .select("user_id")
      .eq("status", "paid")
      .eq("payout_provider", "faucetpay"),
  ]);

  if (recentResult.error || allTimeResult.error) {
    return {
      available: false,
      paidLast7d: 0,
      uniqueUsersPaidLast7d: 0,
      creditsPaidLast7d: 0,
      allTimePaid: 0,
      allTimeUniqueUsersPaid: 0,
      documentationMinimumMet: false,
      strongInitialProofMet: false,
    };
  }

  const recent = recentResult.data ?? [];
  const allTime = allTimeResult.data ?? [];
  const uniqueUsersPaidLast7d = new Set(recent.map((row) => String(row.user_id))).size;
  const allTimeUniqueUsersPaid = new Set(allTime.map((row) => String(row.user_id))).size;
  const creditsPaidLast7d = recent.reduce((total, row) => total + asNumber(row.amount_credits), 0);

  return {
    available: true,
    paidLast7d: recent.length,
    uniqueUsersPaidLast7d,
    creditsPaidLast7d,
    allTimePaid: allTime.length,
    allTimeUniqueUsersPaid,
    documentationMinimumMet: allTimeUniqueUsersPaid >= 2,
    strongInitialProofMet: uniqueUsersPaidLast7d >= 5 && recent.length >= 5,
  };
}
