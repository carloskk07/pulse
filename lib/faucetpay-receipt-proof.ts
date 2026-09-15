import { createHash } from "node:crypto";
import { getReleaseEvidenceFingerprint, releaseEvidenceMatches } from "@/lib/release-evidence";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

const FAUCETPAY_RECEIPT_PROOF_SCHEMA = "faucetpay-receipt-proof-v1";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type JsonRecord = Record<string, unknown>;

export type FaucetPayPaidWithdrawal = {
  id: string;
  payout_provider: string;
  asset: string;
  destination: string;
  amount_credits: number;
  payout_amount_units: number;
  external_id: string;
  status: "paid";
};

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function positiveSafeInteger(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function normalizePaidWithdrawal(value: unknown): FaucetPayPaidWithdrawal | null {
  const row = objectValue(value);
  const amountCredits = positiveSafeInteger(row.amount_credits);
  const payoutAmountUnits = positiveSafeInteger(row.payout_amount_units);
  const id = typeof row.id === "string" ? row.id : "";
  const provider = typeof row.payout_provider === "string" ? row.payout_provider.trim().toLowerCase() : "";
  const asset = typeof row.asset === "string" ? row.asset.trim().toUpperCase() : "";
  const destination = typeof row.destination === "string" ? row.destination.trim() : "";
  const externalId = typeof row.external_id === "string" ? row.external_id.trim() : "";
  const status = row.status === "paid" ? "paid" : "";

  if (!id || provider !== "faucetpay" || !asset || !destination || !externalId || status !== "paid" || !amountCredits || !payoutAmountUnits) {
    return null;
  }

  return {
    id,
    payout_provider: provider,
    asset,
    destination,
    amount_credits: amountCredits,
    payout_amount_units: payoutAmountUnits,
    external_id: externalId,
    status: "paid",
  };
}

export function getFaucetPayReceiptFingerprint(withdrawal: FaucetPayPaidWithdrawal) {
  const payoutFingerprint = getReleaseEvidenceFingerprint("faucetpay_payout");
  if (!payoutFingerprint) return null;

  const destinationHash = createHash("sha256").update(withdrawal.destination).digest("hex");
  return createHash("sha256")
    .update(JSON.stringify([
      FAUCETPAY_RECEIPT_PROOF_SCHEMA,
      payoutFingerprint,
      withdrawal.id,
      withdrawal.external_id,
      withdrawal.payout_provider,
      withdrawal.asset,
      String(withdrawal.amount_credits),
      String(withdrawal.payout_amount_units),
      destinationHash,
    ]))
    .digest("hex");
}

export function faucetPayReceiptEvidenceMatches(proof: unknown, withdrawal: FaucetPayPaidWithdrawal | null) {
  if (!withdrawal) return false;
  const expected = getFaucetPayReceiptFingerprint(withdrawal);
  if (!expected) return false;
  const evidence = objectValue(objectValue(proof).faucetpay_receipt);
  return evidence.fingerprint === expected && typeof evidence.verified_at === "string" && evidence.verified_at.length > 0;
}

export async function getLatestFaucetPayPaidWithdrawal(admin: AdminClient) {
  const { data, error } = await admin
    .from("withdrawals")
    .select("id,payout_provider,asset,destination,amount_credits,payout_amount_units,external_id,status")
    .eq("payout_provider", "faucetpay")
    .eq("status", "paid")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return normalizePaidWithdrawal(data);
}

export async function getFaucetPayReceiptProofState(admin: AdminClient, proofValue?: unknown) {
  const [withdrawal, proofResult] = await Promise.all([
    getLatestFaucetPayPaidWithdrawal(admin),
    proofValue === undefined
      ? admin.from("app_config").select("value").eq("key", "release_external_proof").maybeSingle()
      : Promise.resolve({ data: { value: proofValue }, error: null }),
  ]);

  const proof = proofResult.data?.value;
  const payoutProofCurrent = !proofResult.error && releaseEvidenceMatches(proof, "faucetpay_payout");
  const receiptProofCurrent = !proofResult.error && payoutProofCurrent && faucetPayReceiptEvidenceMatches(proof, withdrawal);

  return { withdrawal, payoutProofCurrent, receiptProofCurrent };
}

export async function recordFaucetPayReceiptProof(admin: AdminClient, withdrawal: FaucetPayPaidWithdrawal) {
  const fingerprint = getFaucetPayReceiptFingerprint(withdrawal);
  if (!fingerprint) return false;

  const { data, error } = await admin.rpc("record_release_evidence", {
    p_kind: "faucetpay_receipt",
    p_fingerprint: fingerprint,
  });
  return !error && data === true;
}
