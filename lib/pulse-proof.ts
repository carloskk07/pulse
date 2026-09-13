import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PulseProof = {
  available: boolean;
  generatedAt: string | null;
  claims24h: number;
  uniqueUsers24h: number;
  credited24hCredits: number;
  creditedAllTimeCredits: number;
  confirmedTurbos24h: number;
  paidWithdrawalsAllTime: number;
  paidWithdrawalCreditsAllTime: number;
};

const unavailable: PulseProof = {
  available: false,
  generatedAt: null,
  claims24h: 0,
  uniqueUsers24h: 0,
  credited24hCredits: 0,
  creditedAllTimeCredits: 0,
  confirmedTurbos24h: 0,
  paidWithdrawalsAllTime: 0,
  paidWithdrawalCreditsAllTime: 0,
};

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getPulseProof(): Promise<PulseProof> {
  const admin = createSupabaseAdminClient();
  if (!admin) return unavailable;

  const { data, error } = await admin.rpc("pulse_public_snapshot");
  if (error || !data || typeof data !== "object") return unavailable;

  const row = data as Record<string, unknown>;
  return {
    available: true,
    generatedAt: typeof row.generated_at === "string" ? row.generated_at : null,
    claims24h: number(row.claims_24h),
    uniqueUsers24h: number(row.unique_users_24h),
    credited24hCredits: number(row.credited_24h_credits),
    creditedAllTimeCredits: number(row.credited_all_time_credits),
    confirmedTurbos24h: number(row.confirmed_turbos_24h),
    paidWithdrawalsAllTime: number(row.paid_withdrawals_all_time),
    paidWithdrawalCreditsAllTime: number(row.paid_withdrawal_credits_all_time),
  };
}
