import { randomUUID } from "node:crypto";
import "server-only";

import { hasCurrentFaucetPayReadProof } from "@/lib/faucetpay-authority";
import { getReleaseEvidenceFingerprint } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";
import { getFaucetPayBalanceReadOnly } from "@/providers/faucetpay-read";

export type TreasuryBackingStatus =
  | "backing_ready"
  | "backing_refresh_required"
  | "backing_refreshing"
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

type TreasuryBackingPreflightStatus =
  | "backing_ready"
  | "backing_insufficient"
  | "backing_refresh_acquired"
  | "backing_refresh_busy"
  | "backing_unavailable"
  | "read_proof_required"
  | "pack_authority_mismatch";

async function getTreasuryBackingPreflight(
  treasuryCode: string,
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
): Promise<TreasuryBackingPreflightStatus> {
  const payout = getFaucetPayPackConfig();
  const readProofFingerprint = getReleaseEvidenceFingerprint("faucetpay_read");
  if (!readProofFingerprint) return "read_proof_required";
  if (
    !payout.ready
    || !payout.asset
    || !payout.amountCredits
    || !payout.amountSmallestUnits
  ) {
    return "pack_authority_mismatch";
  }

  const { data, error } = await admin.rpc("treasury_backing_preflight", {
    p_treasury_code: treasuryCode,
    p_expected_read_proof_fingerprint: readProofFingerprint,
    p_expected_asset: payout.asset,
    p_expected_credits: payout.amountCredits,
    p_expected_units: payout.amountSmallestUnits,
    p_lease_token: randomUUID(),
    p_lease_seconds: 10,
  });
  if (error) return "backing_unavailable";

  const status = statusOf(data);
  if (
    status === "backing_ready"
    || status === "backing_insufficient"
    || status === "backing_refresh_acquired"
    || status === "backing_refresh_busy"
    || status === "read_proof_required"
    || status === "pack_authority_mismatch"
  ) {
    return status;
  }
  return "backing_unavailable";
}

const CONCURRENT_REFRESH_POLL_DELAYS_MS = [250, 250, 500, 1_000] as const;

async function waitForConcurrentBackingRefresh(
  treasuryCode: string,
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
): Promise<TreasuryBackingStatus> {
  for (const delayMs of CONCURRENT_REFRESH_POLL_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const current = await getTreasuryBackingGuard(treasuryCode, admin);
    if (current !== "backing_refresh_required") return current;
  }
  return "backing_refreshing";
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

  const payout = getFaucetPayPackConfig();
  const [readProofCurrent, authority] = await Promise.all([
    hasCurrentFaucetPayReadProof(admin),
    getCanonicalFaucetPayPackAuthority(admin),
  ]);
  if (!readProofCurrent) return "read_proof_required";
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

  const preflight = await getTreasuryBackingPreflight(treasuryCode, admin);
  if (preflight === "backing_ready" || preflight === "backing_insufficient") return preflight;
  if (preflight === "read_proof_required" || preflight === "pack_authority_mismatch") return preflight;
  if (preflight === "backing_refresh_busy") {
    return waitForConcurrentBackingRefresh(treasuryCode, admin);
  }
  if (preflight !== "backing_refresh_acquired") return "backing_unavailable";

  const refreshed = await refreshTreasuryBackingObservation(treasuryCode, admin);
  if (refreshed !== "backing_ready") return refreshed;

  return getTreasuryBackingGuard(treasuryCode, admin);
}
