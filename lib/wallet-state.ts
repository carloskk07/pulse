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
  created_at: string;
};

export type WalletState = {
  state: RewardSnapshot;
  rows: LedgerItem[];
  activeWithdrawal: ActiveWithdrawal | null;
  withdrawalPilotAllowed: boolean;
  readProofReady: boolean;
  sendScopeProofReady: boolean;
};

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

  if (
    !id
    || !destination
    || !asset
    || !createdAt
    || !Number.isFinite(amountCredits)
    || amountCredits <= 0
    || (payoutUnits !== null && (!Number.isFinite(payoutUnits) || payoutUnits <= 0))
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
      withdrawalPilotAllowed: false,
      readProofReady: false,
      sendScopeProofReady: false,
    };
  }

  const admin = createSupabaseAdminClient();
  const [userResult, runtimeResult] = await Promise.all([
    supabase.rpc("current_user_wallet_state"),
    admin
      ? admin.rpc("current_wallet_runtime_state", { p_user_id: user.id })
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
    withdrawalPilotAllowed: rawRuntime.withdrawal_pilot_allowed === true,
    readProofReady: releaseEvidenceMatches(proof, "faucetpay_read"),
    sendScopeProofReady: releaseEvidenceMatches(proof, "faucetpay_send_scope"),
  };
}
