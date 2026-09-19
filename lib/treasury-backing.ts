import "server-only";

import { hasCurrentFaucetPayReadProof } from "@/lib/faucetpay-authority";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";
import { getFaucetPayBalanceReadOnly } from "@/providers/faucetpay-read";

export type TreasuryBackingStatus =
  | "backing_ready"
  | "backing_refresh_required"
  | "backing_insufficient"
  | "backing_unavailable"
  | "read_proof_required"
  | "pack_authority_mismatch";

export type FaucetPayPackAuthority = {
  asset: string;
  amountCredits: number;
  amountSmallestUnits: number;
};

function statusOf(value: unknown): string {
  return value && typeof value === "object" && !Array.isArray(value)
    ? String((value as Record<string, unknown>).status ?? "")
    : "";
}

export async function getCanonicalFaucetPayPackAuthority(
  admin = createSupabaseAdminClient(),
): Promise<FaucetPayPackAuthority | null> {
  if (!admin) return null;

  const { data, error } = await admin
    .from("faucetpay_payout_pack_authority")
    .select("asset,credits,units")
    .eq("singleton", true)
    .maybeSingle();
  if (error || !data) return null;

  const asset = String(data.asset ?? "").trim().toUpperCase();
  const amountCredits = Number(data.credits ?? 0);
  const amountSmallestUnits = Number(data.units ?? 0);
  if (
    !asset
    || !Number.isSafeInteger(amountCredits)
    || amountCredits <= 0
    || !Number.isSafeInteger(amountSmallestUnits)
    || amountSmallestUnits <= 0
  ) {
    return null;
  }

  return { asset, amountCredits, amountSmallestUnits };
}

function payoutMatchesAuthority(
  payout: ReturnType<typeof getFaucetPayPackConfig>,
  authority: FaucetPayPackAuthority | null,
) {
  return Boolean(
    payout.ready
    && authority
    && payout.asset === authority.asset
    && payout.amountCredits === authority.amountCredits
    && payout.amountSmallestUnits === authority.amountSmallestUnits
  );
}

export async function hasCanonicalFaucetPayPackAuthority(
  admin = createSupabaseAdminClient(),
  payout = getFaucetPayPackConfig(),
): Promise<boolean> {
  if (!admin) return false;
  const authority = await getCanonicalFaucetPayPackAuthority(admin);
  return payoutMatchesAuthority(payout, authority);
}

export async function getTreasuryBackingGuard(
  treasuryCode = "launch",
  admin = createSupabaseAdminClient(),
): Promise<TreasuryBackingStatus> {
  if (!admin) return "backing_unavailable";

  const { data, error } = await admin.rpc("treasury_backing_guard", {
    p_treasury_code: treasuryCode,
  });
  if (error) return "backing_unavailable";

  const status = statusOf(data);
  if (
    status === "backing_ready"
    || status === "backing_refresh_required"
    || status === "backing_insufficient"
  ) {
    return status;
  }
  return "backing_unavailable";
}

export async function refreshTreasuryBackingObservation(
  treasuryCode = "launch",
  admin = createSupabaseAdminClient(),
): Promise<TreasuryBackingStatus> {
  if (!admin) return "backing_unavailable";
  if (!(await hasCurrentFaucetPayReadProof(admin))) return "read_proof_required";

  const payout = getFaucetPayPackConfig();
  const authority = await getCanonicalFaucetPayPackAuthority(admin);
  if (!payoutMatchesAuthority(payout, authority)) return "pack_authority_mismatch";

  const balance = await getFaucetPayBalanceReadOnly(payout.asset);
  if (!balance.ok || balance.balanceSmallestUnits === null) {
    return "backing_unavailable";
  }

  const { data, error } = await admin.rpc("record_treasury_backing_observation", {
    p_treasury_code: treasuryCode,
    p_observed_balance_units: balance.balanceSmallestUnits,
  });
  if (error) return "backing_unavailable";

  const status = statusOf(data);
  if (status === "backing_ready") return "backing_ready";
  if (status === "backing_insufficient") return "backing_insufficient";
  if (status === "read_proof_missing") return "read_proof_required";
  if (status === "pack_authority_missing") return "pack_authority_mismatch";
  return "backing_unavailable";
}

export async function ensureFreshTreasuryBacking(
  treasuryCode = "launch",
  admin = createSupabaseAdminClient(),
): Promise<TreasuryBackingStatus> {
  if (!admin) return "backing_unavailable";

  // A current observation is reusable only while the live application
  // configuration still matches the fingerprint-bound FaucetPay read proof.
  // This is a local/database authority check and does not call FaucetPay.
  if (!(await hasCurrentFaucetPayReadProof(admin))) return "read_proof_required";

  const payout = getFaucetPayPackConfig();
  const authority = await getCanonicalFaucetPayPackAuthority(admin);
  if (!payoutMatchesAuthority(payout, authority)) return "pack_authority_mismatch";

  const current = await getTreasuryBackingGuard(treasuryCode, admin);
  if (current === "backing_ready" || current === "backing_insufficient") return current;
  if (current !== "backing_refresh_required") return current;

  const refreshed = await refreshTreasuryBackingObservation(treasuryCode, admin);
  if (refreshed !== "backing_ready") return refreshed;

  return getTreasuryBackingGuard(treasuryCode, admin);
}
