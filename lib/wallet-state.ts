import { getCurrentUserContext } from "@/lib/current-user-context";
import { releaseEvidenceMatches } from "@/lib/release-evidence";
import {
  buildRewardSnapshotFromPayload,
  disconnectedSnapshot,
  ledgerItemsFromRows,
  objectValue,
  type LedgerItem,
  type RewardSnapshot,
} from "@/lib/reward-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ActiveWithdrawal = {
  id: string;
  status: "requested" | "held" | "submitted";
  destination: string;
  asset: string;
  amount_credits: number;
  payout_amount_units: number | null;
  service_fee_credits: number;
  created_at: string;
};

export type RecentPaidWithdrawal = {
  id: string;
  status: "paid";
  amount_credits: number;
  asset: string;
  updated_at: string;
};

export type WalletState = {
  state: RewardSnapshot;
  rows: LedgerItem[];
  activeWithdrawal: ActiveWithdrawal | null;
  recentPaidWithdrawal: RecentPaidWithdrawal | null;
  withdrawalPilotAllowed: boolean;
  readProofReady: boolean;
  sendScopeProofReady: boolean;
};

function recentPaidWithdrawalFromPayload(value: unknown): RecentPaidWithdrawal | null {
  const row = objectValue(value);
  if (row.status !== "paid") return null;

  const id = typeof row.id === "string" ? row.id : "";
  const asset = typeof row.asset === "string" ? row.asset : "";
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : "";
  const amountCredits = Number(row.amount_credits);
  const updatedAtMs = Date.parse(updatedAt);

  if (
    !id
    || !asset
    || !Number.isFinite(amountCredits)
    || amountCredits <= 0
    || !Number.isFinite(updatedAtMs)
  ) {
    return null;
  }

  return {
    id,
    status: "paid",
    amount_credits: amountCredits,
    asset,
    updated_at: new Date(updatedAtMs).toISOString(),
  };
}

function activeWithdrawalFromPayload(value: unknown): ActiveWithdrawal | null {
  const row = objectValue(value);
  const status = row.status;
  if (status !== "requested" && status !== "held" && status !== "submitted") return null;

  const id = typeof row.id === "string" ? row.id : "";
  const destination = typeof row.destination === "string" ? row.destination : "";
  const asset = typeof row.asset === "string" ? row.asset : "";
  const createdAt = typeof row.created_at === "string" ? row.created_at : "";
  const amountCredits = Number(row.amount_credits);
  const payoutUnits = row.payout_amount_units === null || row.payout_amount_units === undefined
    ? null
    : Number(row.payout_amount_units);
  const serviceFeeCredits = Number(row.service_fee_credits ?? 0);

  if (
    !id
    || !destination
    || !asset
    || !createdAt
    || !Number.isFinite(amountCredits)
    || amountCredits <= 0
    || (payoutUnits !== null && (!Number.isFinite(payoutUnits) || payoutUnits <= 0))
    || !Number.isFinite(serviceFeeCredits)
    || serviceFeeCredits < 0
  ) {
    return null;
  }

  return {
    id,
    status,
    destination,
    asset,
    amount_credits: amountCredits,
    payout_amount_units: payoutUnits,
    service_fee_credits: Math.floor(serviceFeeCredits),
    created_at: createdAt,
  };
}

export async function getWalletState(): Promise<WalletState> {
  const { supabase, user } = await getCurrentUserContext();
  if (!supabase) {
    return {
      state: disconnectedSnapshot,
      rows: [],
      activeWithdrawal: null,
      recentPaidWithdrawal: null,
      withdrawalPilotAllowed: false,
      readProofReady: false,
      sendScopeProofReady: false,
    };
  }
  if (!user) {
    return {
      state: { ...disconnectedSnapshot, preview: false },
      rows: [],
      activeWithdrawal: null,
      recentPaidWithdrawal: null,
      withdrawalPilotAllowed: false,
      readProofReady: false,
      sendScopeProofReady: false,
    };
  }

  const admin = createSupabaseAdminClient();
  const [userResult, runtimeResult, paidWithdrawalResult] = await Promise.all([
    supabase.rpc("current_user_wallet_state"),
    admin
      ? admin.rpc("current_wallet_runtime_state", { p_user_id: user.id })
      : Promise.resolve({ data: null, error: null }),
    admin
      ? admin
        .from("withdrawals")
        .select("id,status,amount_credits,asset,updated_at")
        .eq("user_id", user.id)
        .eq("status", "paid")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const rawUser = objectValue(userResult.data);
  const scopedUser = String(rawUser.user_id ?? "") === user.id ? rawUser : {};
  const rawRuntime = objectValue(runtimeResult.data);
  const proof = rawRuntime.external_proof;

  return {
    state: buildRewardSnapshotFromPayload(
      user,
      objectValue(scopedUser.reward),
      objectValue(rawRuntime.runtime),
    ),
    rows: ledgerItemsFromRows(scopedUser.ledger),
    activeWithdrawal: activeWithdrawalFromPayload(scopedUser.active_withdrawal),
    recentPaidWithdrawal: paidWithdrawalResult.error
      ? null
      : recentPaidWithdrawalFromPayload(paidWithdrawalResult.data),
    withdrawalPilotAllowed: rawRuntime.withdrawal_pilot_allowed === true,
    readProofReady: releaseEvidenceMatches(proof, "faucetpay_read"),
    sendScopeProofReady: releaseEvidenceMatches(proof, "faucetpay_send_scope"),
  };
}
