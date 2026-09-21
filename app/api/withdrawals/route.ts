import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hasCurrentFaucetPayReadProof, hasCurrentFaucetPaySendScopeProof } from "@/lib/faucetpay-authority";
import { recordFaucetPayPayoutProofById } from "@/lib/faucetpay-receipt-proof";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { isTrustedSameOriginMutation, readUrlEncodedFormWithLimit } from "@/lib/request-security";
import { hasCanonicalFaucetPayPackAuthority } from "@/lib/treasury-backing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { hasWithdrawalPilotAccess } from "@/lib/withdrawal-pilot";
import { FaucetPayApiError, FaucetPayProvider, getFaucetPayPackConfig } from "@/providers/faucetpay";
import { getFaucetPayReadOnlyPreflight } from "@/providers/faucetpay-readonly";

export const runtime = "nodejs";

const PAYOUT_DISPATCH_RETRY_SECONDS = 30;

function walletRedirect(request: NextRequest, state: string) {
  return NextResponse.redirect(new URL(`/wallet?withdraw=${encodeURIComponent(state)}`, request.url), 303);
}

type ReservedWithdrawal = {
  status?: string;
  withdrawal_id?: string;
  idempotency_key?: string;
  destination?: string;
  asset?: string;
  amount_credits?: number;
  payout_amount_units?: number;
  service_fee_credits?: number;
  payout_authority_version?: number;
  payout_authority_asset?: string;
  payout_authority_credits?: number;
  payout_authority_units?: number;
};

type ActiveWithdrawalRow = {
  id: string;
  idempotency_key: string;
  destination: string;
  asset: string;
  amount_credits: number;
  payout_amount_units: number | null;
  payout_authority_version: number | null;
  payout_authority_asset: string | null;
  payout_authority_credits: number | null;
  payout_authority_units: number | null;
  status: "requested" | "held" | "submitted";
};

type FinalizeWithdrawalResult = {
  status?: string;
  external_id?: string | null;
};

type DispatchClaimResult = {
  status?: string;
  dispatch?: boolean;
  external_id?: string | null;
  retry_after_seconds?: number;
  attempt?: number;
};

async function finalize(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  withdrawalId: string,
  status: "submitted" | "paid" | "failed",
  externalId: string | null,
  message: string | null,
) {
  return admin.rpc("finalize_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_status: status,
    p_external_id: externalId,
    p_message: message,
  });
}

async function claimDispatch(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  withdrawalId: string,
) {
  return admin.rpc("claim_withdrawal_dispatch", {
    p_withdrawal_id: withdrawalId,
    p_retry_after_seconds: PAYOUT_DISPATCH_RETRY_SECONDS,
  });
}

function authoritativePaidSettlement(data: unknown, providerExternalId: string) {
  const settlement = (data ?? {}) as FinalizeWithdrawalResult;
  const settledExternalId = typeof settlement.external_id === "string" ? settlement.external_id.trim() : "";
  const expectedExternalId = providerExternalId.trim();
  return settlement.status === "paid"
    && Boolean(settledExternalId)
    && Boolean(expectedExternalId)
    && settledExternalId === expectedExternalId;
}

async function reservedMatchesCanonicalPayoutAuthority(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  reserved: ReservedWithdrawal,
) {
  const config = getFaucetPayPackConfig();
  if (!config.ready || !config.amountCredits || !config.amountSmallestUnits) return false;
  if (config.asset !== reserved.asset) return false;
  if (config.amountCredits !== Number(reserved.amount_credits)) return false;
  if (config.amountSmallestUnits !== Number(reserved.payout_amount_units)) return false;
  return hasCanonicalFaucetPayPackAuthority(admin, config);
}

async function reservedHasStoredPayoutAuthority(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  reserved: ReservedWithdrawal,
) {
  if (!reserved.withdrawal_id) return false;

  const version = Number(reserved.payout_authority_version);
  const asset = String(reserved.payout_authority_asset ?? "").trim().toUpperCase();
  const credits = Number(reserved.payout_authority_credits);
  const units = Number(reserved.payout_authority_units);

  if (!Number.isSafeInteger(version) || version <= 0) return false;
  if (!asset || asset !== String(reserved.asset ?? "").trim().toUpperCase()) return false;
  if (!Number.isSafeInteger(credits) || credits !== Number(reserved.amount_credits)) return false;
  if (!Number.isSafeInteger(units) || units !== Number(reserved.payout_amount_units)) return false;

  const { data, error } = await admin.rpc("withdrawal_payout_authority_snapshot_valid", {
    p_withdrawal_id: reserved.withdrawal_id,
  });
  return !error && data === true;
}

async function matchesCurrentPayoutAuthority(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  reserved: ReservedWithdrawal,
) {
  if (!(await reservedMatchesCanonicalPayoutAuthority(admin, reserved))) return false;
  const [readProof, sendScopeProof] = await Promise.all([
    hasCurrentFaucetPayReadProof(admin),
    hasCurrentFaucetPaySendScopeProof(admin),
  ]);
  return readProof && sendScopeProof;
}

async function hasLivePayoutPreflight(config: ReturnType<typeof getFaucetPayPackConfig>) {
  if (!config.ready || !config.amountCredits || !config.amountSmallestUnits) return false;
  const live = await getFaucetPayReadOnlyPreflight();
  return live.state === "READ_ONLY_VERIFIED"
    && live.asset === config.asset
    && live.configuredPackCredits === config.amountCredits
    && live.configuredPackUnits === config.amountSmallestUnits
    && typeof live.balanceSmallestUnits === "number"
    && live.balanceSmallestUnits >= config.amountSmallestUnits;
}

async function executeReservedPayout(
  request: NextRequest,
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  provider: FaucetPayProvider,
  userId: string,
  reserved: ReservedWithdrawal,
  ip: string | undefined,
  recovery: boolean,
) {
  if (!reserved.withdrawal_id || !reserved.idempotency_key || !reserved.destination || !reserved.asset || !reserved.payout_amount_units || !reserved.amount_credits) {
    return walletRedirect(request, "reserve-failed");
  }
  const submittedRecovery = recovery && reserved.status === "submitted";
  const authorityValid = submittedRecovery
    ? await reservedHasStoredPayoutAuthority(admin, reserved)
    : await reservedMatchesCanonicalPayoutAuthority(admin, reserved);
  if (!authorityValid) {
    return walletRedirect(request, "payout-not-configured");
  }

  const claimed = await claimDispatch(admin, reserved.withdrawal_id);
  if (claimed.error) return walletRedirect(request, "processing");

  const dispatch = (claimed.data ?? {}) as DispatchClaimResult;
  if (dispatch.status === "paid") {
    if (await matchesCurrentPayoutAuthority(admin, reserved)) {
      await recordFaucetPayPayoutProofById(admin, reserved.withdrawal_id);
    }
    return walletRedirect(request, "paid");
  }
  if (dispatch.status === "held") return walletRedirect(request, "held");
  if (dispatch.status === "pilot_restricted") return walletRedirect(request, "pilot-restricted");
  if (dispatch.status === "failed" || dispatch.status === "cancelled") return walletRedirect(request, "failed");
  if (dispatch.status !== "submitted" || dispatch.dispatch !== true) return walletRedirect(request, "processing");

  try {
    const payout = await provider.send({
      userId,
      destination: reserved.destination,
      asset: reserved.asset,
      amountCredits: Number(reserved.amount_credits),
      amountSmallestUnits: Number(reserved.payout_amount_units),
      idempotencyKey: reserved.idempotency_key,
      ipAddress: ip,
    });

    const finalized = await finalize(admin, reserved.withdrawal_id, "paid", payout.externalId, recovery ? "FaucetPay payout recovered with the original idempotency key" : "FaucetPay payout completed");
    if (finalized.error || !authoritativePaidSettlement(finalized.data, payout.externalId)) {
      return walletRedirect(request, "processing");
    }

    if (await matchesCurrentPayoutAuthority(admin, reserved)) {
      await recordFaucetPayPayoutProofById(admin, reserved.withdrawal_id);
    }
    return walletRedirect(request, "paid");
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Payout dispatch requires authoritative reconciliation";

    if (error instanceof FaucetPayApiError && !error.retryable) {
      const failed = await finalize(
        admin,
        reserved.withdrawal_id,
        "failed",
        null,
        message,
      );
      if (failed.error) return walletRedirect(request, "processing");
      return walletRedirect(request, "failed");
    }

    await finalize(
      admin,
      reserved.withdrawal_id,
      "submitted",
      null,
      message,
    );
    return walletRedirect(request, "processing");
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) return walletRedirect(request, "verification-failed");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return walletRedirect(request, "service-not-configured");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth?next=/wallet", request.url), 303);

  const formData = await readUrlEncodedFormWithLimit(request, 8_192);
  if (!formData) return walletRedirect(request, "verification-failed");
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip, { expectedAction: ["withdrawal", "withdrawal-retry"] });
  if (!verification.success) return walletRedirect(request, verification.missingConfig ? "verification-not-configured" : "verification-failed");

  const admin = createSupabaseAdminClient();
  if (!admin) return walletRedirect(request, "service-not-configured");
  await recordReleaseEvidence("turnstile");
  if (!(await hasWithdrawalPilotAccess(user.id, admin))) return walletRedirect(request, "pilot-restricted");

  const { data: activeData, error: activeError } = await admin
    .from("withdrawals")
    .select("id,idempotency_key,destination,asset,amount_credits,payout_amount_units,payout_authority_version,payout_authority_asset,payout_authority_credits,payout_authority_units,status")
    .eq("user_id", user.id)
    .in("status", ["requested", "held", "submitted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) return walletRedirect(request, "reserve-failed");
  const active = activeData as ActiveWithdrawalRow | null;

  if (active) {
    if (active.status === "held") return walletRedirect(request, "held");
    if (!process.env.FAUCETPAY_SCOPED_KEY?.trim()) return walletRedirect(request, "payout-not-configured");
    if (!(await hasCurrentFaucetPaySendScopeProof(admin))) return walletRedirect(request, "payout-not-configured");

    const reserved: ReservedWithdrawal = {
      status: active.status,
      withdrawal_id: active.id,
      idempotency_key: active.idempotency_key,
      destination: active.destination,
      asset: active.asset,
      amount_credits: active.amount_credits,
      payout_amount_units: active.payout_amount_units ?? undefined,
      payout_authority_version: active.payout_authority_version ?? undefined,
      payout_authority_asset: active.payout_authority_asset ?? undefined,
      payout_authority_credits: active.payout_authority_credits ?? undefined,
      payout_authority_units: active.payout_authority_units ?? undefined,
    };

    if (active.status === "requested") {
      const config = getFaucetPayPackConfig();
      const packStillMatches = Boolean(
        config.ready
        && config.amountCredits === active.amount_credits
        && config.amountSmallestUnits === active.payout_amount_units
        && config.asset === active.asset,
      );
      if (!packStillMatches) return walletRedirect(request, "payout-not-configured");
      if (!(await hasCanonicalFaucetPayPackAuthority(admin, config))) {
        return walletRedirect(request, "payout-not-configured");
      }
      if (!(await hasCurrentFaucetPayReadProof(admin))) return walletRedirect(request, "payout-not-configured");
      if (!(await hasLivePayoutPreflight(config))) return walletRedirect(request, "provider-temporary");

      try {
        await new FaucetPayProvider().validateDestination(active.destination, active.asset);
      } catch (error) {
        if (error instanceof FaucetPayApiError && error.retryable) return walletRedirect(request, "provider-temporary");
        return walletRedirect(request, "invalid-destination");
      }
    } else if (!(await reservedHasStoredPayoutAuthority(admin, reserved))) {
      return walletRedirect(request, "payout-not-configured");
    }

    return executeReservedPayout(request, admin, new FaucetPayProvider(), user.id, reserved, ip, true);
  }

  const config = getFaucetPayPackConfig();
  if (!config.ready || !config.amountCredits || !config.amountSmallestUnits) return walletRedirect(request, "payout-not-configured");
  if (!(await hasCanonicalFaucetPayPackAuthority(admin, config))) return walletRedirect(request, "payout-not-configured");
  if (!(await hasCurrentFaucetPayReadProof(admin))) return walletRedirect(request, "payout-not-configured");
  if (!(await hasCurrentFaucetPaySendScopeProof(admin))) return walletRedirect(request, "payout-not-configured");
  if (!(await hasLivePayoutPreflight(config))) return walletRedirect(request, "provider-temporary");

  const destination = String(formData.get("destination") ?? "").trim();
  if (!destination || destination.length > 200) return walletRedirect(request, "invalid-destination");

  const provider = new FaucetPayProvider();
  try {
    await provider.validateDestination(destination, config.asset);
  } catch (error) {
    if (error instanceof FaucetPayApiError && error.retryable) return walletRedirect(request, "provider-temporary");
    return walletRedirect(request, "invalid-destination");
  }

  const { data, error } = await admin.rpc("reserve_withdrawal", {
    p_user_id: user.id,
    p_idempotency_key: `wd-${randomUUID()}`,
    p_provider: provider.name,
    p_asset: config.asset,
    p_destination: destination,
    p_amount_credits: config.amountCredits,
    p_payout_amount_units: config.amountSmallestUnits,
  });

  if (error) return walletRedirect(request, "reserve-failed");
  const reserved = (data ?? {}) as ReservedWithdrawal;
  if (reserved.status === "insufficient") return walletRedirect(request, "insufficient");
  if (reserved.status === "free_window_used") return walletRedirect(request, "free-pass-used");
  if (reserved.status === "held") return walletRedirect(request, "held");
  if (reserved.status === "pilot_restricted") return walletRedirect(request, "pilot-restricted");
  if (
    reserved.status === "payout_authority_missing"
    || reserved.status === "payout_authority_mismatch"
    || reserved.status === "unsupported_provider"
  ) return walletRedirect(request, "payout-not-configured");

  return executeReservedPayout(request, admin, provider, user.id, reserved, ip, reserved.status === "active");
}
