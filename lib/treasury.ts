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

export type TreasuryDailyFundingState = {
  treasuryId: string;
  code: string;
  fundedCredits: number;
  reservedCredits: number;
  spentCredits: number;
  availableCredits: number;
  dailyBudgetCredits: number;
  maxUserDailyCredits: number;
  enabled: boolean;
  killSwitch: boolean;
  utcDayStart: string;
  dailyClaimCredits: number;
  dailyReservationCredits: number;
  dailyCommittedCredits: number;
  remainingDailyBudgetCredits: number;
  fundingGapCredits: number;
};

export function deriveTreasuryDailyFundingState(input: {
  availableCredits: number;
  dailyBudgetCredits: number;
  dailyClaimCredits: number;
  dailyReservationCredits: number;
}) {
  const availableCredits = Math.max(0, Math.floor(input.availableCredits));
  const dailyBudgetCredits = Math.max(0, Math.floor(input.dailyBudgetCredits));
  const dailyClaimCredits = Math.max(0, Math.floor(input.dailyClaimCredits));
  const dailyReservationCredits = Math.max(0, Math.floor(input.dailyReservationCredits));
  const dailyCommittedCredits = dailyClaimCredits + dailyReservationCredits;
  const remainingDailyBudgetCredits = Math.max(dailyBudgetCredits - dailyCommittedCredits, 0);
  const fundingGapCredits = Math.max(remainingDailyBudgetCredits - availableCredits, 0);
  return {
    availableCredits,
    dailyBudgetCredits,
    dailyClaimCredits,
    dailyReservationCredits,
    dailyCommittedCredits,
    remainingDailyBudgetCredits,
    fundingGapCredits,
  };
}

export async function getTreasuryDailyFundingState(treasuryCode = "launch"): Promise<TreasuryDailyFundingState | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data: treasury, error: treasuryError } = await admin
    .from("reward_treasuries")
    .select("id,code,funded_credits,reserved_credits,spent_credits,daily_budget_credits,max_user_daily_credits,enabled,kill_switch")
    .eq("code", treasuryCode)
    .maybeSingle();

  if (treasuryError || !treasury?.id) return null;

  const utcTodayStart = new Date();
  utcTodayStart.setUTCHours(0, 0, 0, 0);
  const utcDayStart = utcTodayStart.toISOString();

  const [claimsResult, reservationsResult] = await Promise.all([
    admin
      .from("pulse_claims")
      .select("reward_credits")
      .eq("treasury_id", treasury.id)
      .gte("created_at", utcDayStart),
    admin
      .from("treasury_reservations")
      .select("amount_credits")
      .eq("treasury_id", treasury.id)
      .gte("created_at", utcDayStart)
      .in("status", ["reserved", "consumed"]),
  ]);

  if (claimsResult.error || reservationsResult.error) return null;

  const dailyClaimCredits = (claimsResult.data ?? []).reduce(
    (total, row) => total + Math.max(0, asNumber(row.reward_credits)),
    0,
  );
  const dailyReservationCredits = (reservationsResult.data ?? []).reduce(
    (total, row) => total + Math.max(0, asNumber(row.amount_credits)),
    0,
  );
  const fundedCredits = asNumber(treasury.funded_credits);
  const reservedCredits = asNumber(treasury.reserved_credits);
  const spentCredits = asNumber(treasury.spent_credits);
  const derived = deriveTreasuryDailyFundingState({
    availableCredits: fundedCredits - reservedCredits - spentCredits,
    dailyBudgetCredits: asNumber(treasury.daily_budget_credits),
    dailyClaimCredits,
    dailyReservationCredits,
  });

  return {
    treasuryId: String(treasury.id),
    code: String(treasury.code ?? treasuryCode),
    fundedCredits,
    reservedCredits,
    spentCredits,
    availableCredits: derived.availableCredits,
    dailyBudgetCredits: derived.dailyBudgetCredits,
    maxUserDailyCredits: asNumber(treasury.max_user_daily_credits),
    enabled: treasury.enabled === true,
    killSwitch: treasury.kill_switch === true,
    utcDayStart,
    dailyClaimCredits: derived.dailyClaimCredits,
    dailyReservationCredits: derived.dailyReservationCredits,
    dailyCommittedCredits: derived.dailyCommittedCredits,
    remainingDailyBudgetCredits: derived.remainingDailyBudgetCredits,
    fundingGapCredits: derived.fundingGapCredits,
  };
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
