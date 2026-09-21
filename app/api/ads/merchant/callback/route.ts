import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { recordVerifiedPulseAdPayment } from "@/lib/pulse-ads";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{8,256}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseCustom(value: string) {
  const [prefix, campaignId, checkoutReference] = value.split(":");
  if (prefix !== "ad" || !UUID_RE.test(campaignId ?? "") || !UUID_RE.test(checkoutReference ?? "")) return null;
  return { campaignId, checkoutReference };
}

function amountToMicros(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const micros = Math.round(amount * 1_000_000);
  return Number.isSafeInteger(micros) ? micros : null;
}

export async function POST(request: NextRequest) {
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ status: "unavailable" }, { status: 503 });

  const form = await request.formData();
  const token = String(form.get("token") ?? "").trim();
  const callbackTransactionId = String(form.get("transaction_id") ?? "").trim().slice(0, 160);
  const callbackCustom = String(form.get("custom") ?? "").trim().slice(0, 220);

  if (!TOKEN_RE.test(token)) return NextResponse.json({ status: "invalid" }, { status: 400 });
  const hash = tokenHash(token);

  const { data: existing } = await admin
    .from("pulse_ads_merchant_callbacks")
    .select("state,reason")
    .eq("token_hash", hash)
    .maybeSingle();

  if (existing?.state === "verified" || existing?.state === "rejected") {
    return NextResponse.json({ status: existing.state }, { status: 200 });
  }

  const { error: pendingError } = await admin.from("pulse_ads_merchant_callbacks").upsert({
    token_hash: hash,
    provider_transaction_id: callbackTransactionId || null,
    custom_reference: callbackCustom || null,
    state: "pending",
    updated_at: new Date().toISOString(),
  }, { onConflict: "token_hash" });

  if (pendingError) return NextResponse.json({ status: "unavailable" }, { status: 503 });

  const merchantUsername = process.env.PULSE_ADS_MERCHANT_USERNAME?.trim();
  if (!merchantUsername) {
    return NextResponse.json({ status: "merchant-not-configured" }, { status: 503 });
  }

  let verified: Record<string, unknown>;
  try {
    const response = await fetch(`https://faucetpay.io/merchant/get-payment/${encodeURIComponent(token)}`, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return NextResponse.json({ status: "verify-unavailable" }, { status: 503 });
    verified = await response.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ status: "verify-unavailable" }, { status: 503 });
  }

  const verifiedTransactionId = String(verified.transaction_id ?? "").trim().slice(0, 160);
  const verifiedMerchant = String(verified.merchant_username ?? "").trim();
  const verifiedCustom = String(verified.custom ?? "").trim().slice(0, 220);
  const pricingCurrency = String(verified.currency1 ?? "").trim().toUpperCase();
  const amountUsdMicros = amountToMicros(verified.amount1);
  const custom = parseCustom(verifiedCustom);

  const authoritative = verified.valid === true
    && verifiedTransactionId.length > 0
    && verifiedMerchant === merchantUsername
    && pricingCurrency === "USDT"
    && amountUsdMicros !== null
    && custom !== null
    && (!callbackTransactionId || callbackTransactionId === verifiedTransactionId)
    && (!callbackCustom || callbackCustom === verifiedCustom);

  if (!authoritative || !custom || amountUsdMicros === null) {
    await admin.from("pulse_ads_merchant_callbacks").update({
      state: "rejected",
      reason: "verification_mismatch",
      updated_at: new Date().toISOString(),
    }).eq("token_hash", hash);
    return NextResponse.json({ status: "rejected" }, { status: 200 });
  }

  const result = await recordVerifiedPulseAdPayment({
    campaignId: custom.campaignId,
    checkoutReference: custom.checkoutReference,
    transactionId: verifiedTransactionId,
    amountUsdMicros,
    pricingCurrency,
  });

  const resultStatus = String(result.status ?? "error");
  const paymentWasVerified = !["unavailable", "error"].includes(resultStatus);

  if (!paymentWasVerified) {
    return NextResponse.json({ status: "settlement-unavailable" }, { status: 503 });
  }

  await admin.from("pulse_ads_merchant_callbacks").update({
    state: "verified",
    provider_transaction_id: verifiedTransactionId,
    custom_reference: verifiedCustom,
    reason: resultStatus,
    updated_at: new Date().toISOString(),
  }).eq("token_hash", hash);

  return NextResponse.json({ status: resultStatus }, { status: 200 });
}
