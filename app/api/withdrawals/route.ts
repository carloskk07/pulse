import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hasCurrentFaucetPayReadProof } from "@/lib/faucetpay-authority";
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

type ActiveWithdrawalRow = {
  id: string;
  idempotency_key: string;
  destination: string;
  asset: string;
  amount_credits: number;
  payout_amount_units: number | null;
  status: "requested" | "held" | "submitted";
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

async function matchesCurrentPayoutAuthority(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  reserved: ReservedWithdrawal,
) {
  const config = getFaucetPayPackConfig();
  if (!config.ready || !config.amountCredits || !config.amountSmallestUnits) return false;
  if (config.asset !== reserved.asset) return false;
  if (config.amountCredits !== Number(reserved.amount_credits)) return false;
  if (config.amountSmallestUnits !== Number(reserved.payout_amount_units)) return false;
  return hasCurrentFaucetPayReadProof(admin);
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
    if (finalized.error) return walletRedirect(request, "processing");

    // Recovery is allowed to finish a payout created under an older pack, but
    // that historical payout must never mint proof for the current release
    // configuration. Only record release evidence when the exact reserved
    // asset/credits/provider units still match the current read-proven pack.
    if (await matchesCurrentPayoutAuthority(admin, reserved)) {
      await recordReleaseEvidence("faucetpay_payout");
    }
    return walletRedirect(request, "paid");
  } catch (error) {
    if (recovery || (error instanceof FaucetPayApiError && error.retryable)) {
      await finalize(admin, reserved.withdrawal_id, "submitted", null, error instanceof Error ? error.message : "Payout state is still unknown");
      return walletRedirect(request, "processing");
    }

    await finalize(admin, reserved.withdrawal_id, "failed", null, error instanceof Error ? error.message : "Payout failed");
    return walletRedirect(request, "failed");
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return walletRedirect(request, "service-not-configured");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth?next=/wallet", request.url), 303);

  const formData = await request.formData();
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip, { expectedAction: ["withdrawal", "withdrawal-retry"] });
  if (!verification.success) return walletRedirect(request, verification.missingConfig ? "verification-not-configured" : "verification-failed");

  const admin = createSupabaseAdminClient();
  if (!admin) return walletRedirect(request, "service-not-configured");
  await recordReleaseEvidence("turnstile");

  const { data: activeData, error: activeError } = await admin
    .from("withdrawals")
    .select("id,idempotency_key,destination,asset,amount_credits,payout_amount_units,status")
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

    if (active.status === "requested") {
      const config = getFaucetPayPackConfig();
      const packStillMatches = Boolean(
        config.ready
        && config.amountCredits === active.amount_credits
        && config.amountSmallestUnits === active.payout_amount_units
        && config.asset === active.asset,
      );
      if (!packStillMatches) return walletRedirect(request, "payout-not-configured");
      if (!(await hasCurrentFaucetPayReadProof(admin))) return walletRedirect(request, "payout-not-configured");
    }

    const reserved: ReservedWithdrawal = {
      status: active.status,
      withdrawal_id: active.id,
      idempotency_key: active.idempotency_key,
      destination: active.destination,
      asset: active.asset,
      amount_credits: active.amount_credits,
      payout_amount_units: active.payout_amount_units ?? undefined,
    };

    // A submitted payout may already have reached FaucetPay. Reconciliation must
    // keep using the original idempotency key even if current configuration later drifts.
    return executeReservedPayout(request, admin, new FaucetPayProvider(), user.id, reserved, ip, true);
  }

  const config = getFaucetPayPackConfig();
  if (!config.ready || !config.amountCredits || !config.amountSmallestUnits) return walletRedirect(request, "payout-not-configured");
  if (!(await hasCurrentFaucetPayReadProof(admin))) return walletRedirect(request, "payout-not-configured");

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
  if (reserved.status === "held") return walletRedirect(request, "held");

  return executeReservedPayout(request, admin, provider, user.id, reserved, ip, reserved.status === "active");
}
