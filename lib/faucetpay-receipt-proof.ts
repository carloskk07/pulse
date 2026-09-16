import { createHash } from "node:crypto";
import { getReleaseEvidenceFingerprint } from "@/lib/release-evidence";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

const FAUCETPAY_PAYOUT_PROOF_SCHEMA = "faucetpay-payout-proof-v3";
const FAUCETPAY_RECEIPT_PROOF_SCHEMA = "faucetpay-receipt-proof-v3";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
type JsonRecord = Record<string, unknown>;

export type FaucetPayPaidWithdrawal = {
  id: string;
  idempotency_key: string;
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
  const idempotencyKey = typeof row.idempotency_key === "string" ? row.idempotency_key.trim() : "";
  const provider = typeof row.payout_provider === "string" ? row.payout_provider.trim().toLowerCase() : "";
  const asset = typeof row.asset === "string" ? row.asset.trim().toUpperCase() : "";
  const destination = typeof row.destination === "string" ? row.destination.trim() : "";
  const externalId = typeof row.external_id === "string" ? row.external_id.trim() : "";
  const status = row.status === "paid" ? "paid" : "";

  if (!id || !idempotencyKey || provider !== "faucetpay" || !asset || !destination || !externalId || status !== "paid" || !amountCredits || !payoutAmountUnits) {
    return null;
  }

  return {
    id,
    idempotency_key: idempotencyKey,
    payout_provider: provider,
    asset,
    destination,
    amount_credits: amountCredits,
    payout_amount_units: payoutAmountUnits,
    external_id: externalId,
    status: "paid",
  };
}

function evidenceFor(value: unknown, key: "faucetpay_payout" | "faucetpay_receipt") {
  return objectValue(objectValue(value)[key]);
}

function evidenceWithdrawalId(value: unknown, key: "faucetpay_payout" | "faucetpay_receipt") {
  const id = evidenceFor(value, key).withdrawal_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function withdrawalIdentity(withdrawal: FaucetPayPaidWithdrawal) {
  const destinationHash = createHash("sha256").update(withdrawal.destination).digest("hex");
  return [
    withdrawal.id,
    withdrawal.idempotency_key,
    withdrawal.external_id,
    withdrawal.payout_provider,
    withdrawal.asset,
    String(withdrawal.amount_credits),
    String(withdrawal.payout_amount_units),
    destinationHash,
  ];
}

export function getFaucetPayPayoutFingerprint(withdrawal: FaucetPayPaidWithdrawal) {
  const configFingerprint = getReleaseEvidenceFingerprint("faucetpay_payout");
  if (!configFingerprint) return null;
  return createHash("sha256")
    .update(JSON.stringify([FAUCETPAY_PAYOUT_PROOF_SCHEMA, configFingerprint, ...withdrawalIdentity(withdrawal)]))
    .digest("hex");
}

export function faucetPayPayoutEvidenceMatches(proof: unknown, withdrawal: FaucetPayPaidWithdrawal | null) {
  if (!withdrawal) return false;
  const expected = getFaucetPayPayoutFingerprint(withdrawal);
  if (!expected) return false;
  const evidence = evidenceFor(proof, "faucetpay_payout");
  return evidence.withdrawal_id === withdrawal.id
    && evidence.fingerprint === expected
    && typeof evidence.verified_at === "string"
    && evidence.verified_at.length > 0;
}

export function getFaucetPayReceiptFingerprint(withdrawal: FaucetPayPaidWithdrawal) {
  const payoutFingerprint = getFaucetPayPayoutFingerprint(withdrawal);
  if (!payoutFingerprint) return null;
  return createHash("sha256")
    .update(JSON.stringify([FAUCETPAY_RECEIPT_PROOF_SCHEMA, payoutFingerprint, ...withdrawalIdentity(withdrawal)]))
    .digest("hex");
}

export function faucetPayReceiptEvidenceMatches(proof: unknown, withdrawal: FaucetPayPaidWithdrawal | null) {
  if (!withdrawal) return false;
  const expected = getFaucetPayReceiptFingerprint(withdrawal);
  if (!expected) return false;
  const evidence = evidenceFor(proof, "faucetpay_receipt");
  return evidence.withdrawal_id === withdrawal.id
    && evidence.fingerprint === expected
    && typeof evidence.verified_at === "string"
    && evidence.verified_at.length > 0;
}

export async function getFaucetPayPaidWithdrawalById(admin: AdminClient, withdrawalId: string) {
  const { data, error } = await admin
    .from("withdrawals")
    .select("id,idempotency_key,payout_provider,asset,destination,amount_credits,payout_amount_units,external_id,status")
    .eq("id", withdrawalId)
    .eq("payout_provider", "faucetpay")
    .eq("status", "paid")
    .maybeSingle();

  if (error) return null;
  return normalizePaidWithdrawal(data);
}

export async function getLatestFaucetPayPaidWithdrawal(admin: AdminClient) {
  const { data, error } = await admin
    .from("withdrawals")
    .select("id,idempotency_key,payout_provider,asset,destination,amount_credits,payout_amount_units,external_id,status")
    .eq("payout_provider", "faucetpay")
    .eq("status", "paid")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return normalizePaidWithdrawal(data);
}

export async function getFaucetPayReceiptProofState(admin: AdminClient, proofValue?: unknown) {
  const proofResult = proofValue === undefined
    ? await admin.from("app_config").select("value").eq("key", "release_external_proof").maybeSingle()
    : { data: { value: proofValue }, error: null };

  const proof = proofResult.data?.value;
  const payoutWithdrawalId = !proofResult.error ? evidenceWithdrawalId(proof, "faucetpay_payout") : null;
  const receiptWithdrawalId = !proofResult.error ? evidenceWithdrawalId(proof, "faucetpay_receipt") : null;
  const payoutWithdrawal = payoutWithdrawalId
    ? await getFaucetPayPaidWithdrawalById(admin, payoutWithdrawalId)
    : null;
  const receiptWithdrawal = receiptWithdrawalId
    ? await getFaucetPayPaidWithdrawalById(admin, receiptWithdrawalId)
    : null;
  const latestWithdrawal = payoutWithdrawal ?? receiptWithdrawal ?? await getLatestFaucetPayPaidWithdrawal(admin);
  const payoutProofCurrent = !proofResult.error && faucetPayPayoutEvidenceMatches(proof, payoutWithdrawal);
  const receiptProofCurrent = !proofResult.error
    && payoutProofCurrent
    && Boolean(payoutWithdrawal && receiptWithdrawal && payoutWithdrawal.id === receiptWithdrawal.id)
    && faucetPayReceiptEvidenceMatches(proof, receiptWithdrawal);

  return {
    withdrawal: latestWithdrawal,
    payoutWithdrawal,
    boundWithdrawal: receiptWithdrawal,
    payoutProofCurrent,
    receiptProofCurrent,
  };
}

export async function recordFaucetPayPayoutProof(admin: AdminClient, withdrawal: FaucetPayPaidWithdrawal) {
  const fingerprint = getFaucetPayPayoutFingerprint(withdrawal);
  if (!fingerprint) return false;

  const { data, error } = await admin.rpc("record_faucetpay_payout_evidence", {
    p_withdrawal_id: withdrawal.id,
    p_fingerprint: fingerprint,
  });
  return !error && data === true;
}

export async function recordFaucetPayPayoutProofById(admin: AdminClient, withdrawalId: string) {
  const withdrawal = await getFaucetPayPaidWithdrawalById(admin, withdrawalId);
  if (!withdrawal) return false;
  return recordFaucetPayPayoutProof(admin, withdrawal);
}

export async function recordFaucetPayReceiptProof(admin: AdminClient, withdrawal: FaucetPayPaidWithdrawal) {
  const fingerprint = getFaucetPayReceiptFingerprint(withdrawal);
  if (!fingerprint) return false;

  const { data, error } = await admin.rpc("record_faucetpay_receipt_evidence", {
    p_withdrawal_id: withdrawal.id,
    p_fingerprint: fingerprint,
  });
  return !error && data === true;
}
