import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TreasurySnapshot = {
  code: string;
  name: string;
  asset: string;
  fundedCredits: number;
  reservedCredits: number;
  spentCredits: number;
  availableCredits: number;
  dailyBudgetCredits: number;
  maxUserDailyCredits: number;
  enabled: boolean;
  killSwitch: boolean;
};

type TreasuryRpcRow = {
  code?: string;
  name?: string;
  asset?: string;
  funded_credits?: number | string;
  reserved_credits?: number | string;
  spent_credits?: number | string;
  available_credits?: number | string;
  daily_budget_credits?: number | string;
  max_user_daily_credits?: number | string;
  enabled?: boolean;
  kill_switch?: boolean;
};

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getTreasurySnapshot(): Promise<TreasurySnapshot[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data, error } = await admin.rpc("reward_treasury_snapshot");
  if (error || !Array.isArray(data)) return [];

  return (data as TreasuryRpcRow[]).map((row) => ({
    code: String(row.code ?? "unknown"),
    name: String(row.name ?? row.code ?? "Treasury"),
    asset: String(row.asset ?? "CREDITS"),
    fundedCredits: asNumber(row.funded_credits),
    reservedCredits: asNumber(row.reserved_credits),
    spentCredits: asNumber(row.spent_credits),
    availableCredits: asNumber(row.available_credits),
    dailyBudgetCredits: asNumber(row.daily_budget_credits),
    maxUserDailyCredits: asNumber(row.max_user_daily_credits),
    enabled: row.enabled === true,
    killSwitch: row.kill_switch !== false,
  }));
}

export async function reserveTreasuryBoost(input: {
  treasuryCode: string;
  userId: string;
  opportunityKey: string;
  amountCredits: number;
  idempotencyKey: string;
  ttlMinutes?: number;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "unavailable" as const };

  const { data, error } = await admin.rpc("reserve_treasury_boost", {
    p_treasury_code: input.treasuryCode,
    p_user_id: input.userId,
    p_opportunity_key: input.opportunityKey,
    p_amount_credits: Math.max(0, Math.floor(input.amountCredits)),
    p_idempotency_key: input.idempotencyKey,
    p_ttl_minutes: input.ttlMinutes ?? 60,
  });

  if (error) return { status: "error" as const };
  return (data ?? { status: "unknown" }) as Record<string, unknown>;
}

export async function finalizeTreasuryReservation(idempotencyKey: string, action: "consume" | "release") {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "unavailable" as const };

  const { data, error } = await admin.rpc("finalize_treasury_reservation", {
    p_idempotency_key: idempotencyKey,
    p_action: action,
  });

  if (error) return { status: "error" as const };
  return (data ?? { status: "unknown" }) as Record<string, unknown>;
}
