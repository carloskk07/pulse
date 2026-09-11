import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { FaucetPayApiError, FaucetPayProvider, getFaucetPayPackConfig } from "@/providers/faucetpay";

export const runtime = "nodejs";

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

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return walletRedirect(request, "service-not-configured");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth?next=/wallet", request.url), 303);

  const config = getFaucetPayPackConfig();
  if (!config.ready || !config.amountCredits || !config.amountSmallestUnits) return walletRedirect(request, "payout-not-configured");

  const formData = await request.formData();
  const destination = String(formData.get("destination") ?? "").trim();
  if (!destination || destination.length > 200) return walletRedirect(request, "invalid-destination");

  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip);
  if (!verification.success) return walletRedirect(request, verification.missingConfig ? "verification-not-configured" : "verification-failed");

  const provider = new FaucetPayProvider();
  try {
    await provider.validateDestination(destination, config.asset);
  } catch (error) {
    if (error instanceof FaucetPayApiError && error.retryable) return walletRedirect(request, "provider-temporary");
    return walletRedirect(request, "invalid-destination");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return walletRedirect(request, "service-not-configured");
  await recordReleaseEvidence("turnstile");

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
  if (reserved.status === "held") return walletRedirect(request, "held");
  if (!reserved.withdrawal_id || !reserved.idempotency_key || !reserved.destination || !reserved.asset || !reserved.payout_amount_units || !reserved.amount_credits) return walletRedirect(request, "reserve-failed");
  if (reserved.status === "active" && reserved.destination !== destination) return walletRedirect(request, "already-processing");

  try {
    const payout = await provider.send({
      userId: user.id,
      destination: reserved.destination,
      asset: reserved.asset,
      amountCredits: Number(reserved.amount_credits),
      amountSmallestUnits: Number(reserved.payout_amount_units),
      idempotencyKey: reserved.idempotency_key,
      ipAddress: ip,
    });

    const finalized = await finalize(admin, reserved.withdrawal_id, "paid", payout.externalId, "FaucetPay payout completed");
    if (finalized.error) return walletRedirect(request, "processing");
    await recordReleaseEvidence("faucetpay_payout");
    return walletRedirect(request, "paid");
  } catch (error) {
    if (error instanceof FaucetPayApiError && error.retryable) {
      await finalize(admin, reserved.withdrawal_id, "submitted", null, error.message);
      return walletRedirect(request, "processing");
    }

    await finalize(admin, reserved.withdrawal_id, "failed", null, error instanceof Error ? error.message : "Payout failed");
    return walletRedirect(request, "failed");
  }
}
