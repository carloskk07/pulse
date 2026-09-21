import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { recordVerifiedPulseAdPayment } from "@/lib/pulse-ads";
import { verifyPulseAdsCheckoutCustom } from "@/lib/pulse-ads-checkout";
import { readRequestTextWithLimit } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{8,256}$/;
const MAX_CALLBACK_BODY_BYTES = 8_192;
const MERCHANT_VERIFY_TIMEOUT_MS = 7_000;

type PersistedCallback = {
  state?: string | null;
  reason?: string | null;
  provider_transaction_id?: string | null;
  custom_reference?: string | null;
  verified_campaign_id?: string | null;
  verified_checkout_reference?: string | null;
  verified_amount_usd_micros?: number | string | null;
  verified_pricing_currency?: string | null;
  provider_verified_at?: string | null;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function amountToMicros(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const micros = Math.round(amount * 1_000_000);
  return Number.isSafeInteger(micros) ? micros : null;
}

function persistedProof(row: PersistedCallback | null | undefined) {
  const amount = Number(row?.verified_amount_usd_micros ?? 0);
  if (
    !row?.provider_verified_at
    || !row.provider_transaction_id
    || !row.verified_campaign_id
    || !row.verified_checkout_reference
    || row.verified_pricing_currency !== "USDT"
    || !Number.isSafeInteger(amount)
    || amount <= 0
  ) {
    return null;
  }

  return {
    campaignId: row.verified_campaign_id,
    checkoutReference: row.verified_checkout_reference,
    transactionId: row.provider_transaction_id,
    amountUsdMicros: amount,
    pricingCurrency: "USDT",
  };
}

async function settlePersistedAuthority(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  hash: string,
  proof: NonNullable<ReturnType<typeof persistedProof>>,
) {
  const result = await recordVerifiedPulseAdPayment(proof);
  const resultStatus = String(result.status ?? "error");

  if (["unavailable", "error"].includes(resultStatus)) {
    return NextResponse.json({ status: "settlement-unavailable" }, { status: 503 });
  }

  const { error: stateError } = await admin
    .from("pulse_ads_merchant_callbacks")
    .update({
      state: "verified",
      reason: resultStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("token_hash", hash);

  if (stateError) {
    return NextResponse.json({ status: "settlement-state-unavailable" }, { status: 503 });
  }

  return NextResponse.json({ status: resultStatus }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ status: "unavailable" }, { status: 503 });

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") {
    return NextResponse.json({ status: "unsupported-content-type" }, { status: 415 });
  }

  const rawForm = await readRequestTextWithLimit(request, MAX_CALLBACK_BODY_BYTES);
  if (rawForm === null || rawForm.length === 0) {
    return NextResponse.json({ status: "invalid-payload" }, { status: 400 });
  }

  const form = new URLSearchParams(rawForm);
  const token = String(form.get("token") ?? "").trim();
  const callbackTransactionId = String(form.get("transaction_id") ?? "").trim().slice(0, 160);
  const callbackCustom = String(form.get("custom") ?? "").trim().slice(0, 220);
  const callbackAuthority = verifyPulseAdsCheckoutCustom(callbackCustom);

  // FaucetPay echoes the checkout custom value in the server callback. Require
  // Pulsercuit's HMAC authority before any database write or provider lookup so
  // arbitrary public POSTs cannot turn this route into an outbound-call/storage amplifier.
  if (!TOKEN_RE.test(token) || !callbackAuthority) {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }
  const hash = tokenHash(token);

  const { data: existingData, error: existingError } = await admin
    .from("pulse_ads_merchant_callbacks")
    .select(
      "state,reason,provider_transaction_id,custom_reference,verified_campaign_id,verified_checkout_reference,verified_amount_usd_micros,verified_pricing_currency,provider_verified_at",
    )
    .eq("token_hash", hash)
    .maybeSingle();

  if (existingError) return NextResponse.json({ status: "unavailable" }, { status: 503 });
  const existing = existingData as PersistedCallback | null;

  if (existing?.state === "verified" || existing?.state === "rejected") {
    return NextResponse.json({ status: existing.state, reason: existing.reason ?? undefined }, { status: 200 });
  }

  const retryProof = persistedProof(existing);
  if (retryProof) {
    if (
      retryProof.campaignId !== callbackAuthority.campaignId
      || retryProof.checkoutReference !== callbackAuthority.checkoutReference
    ) {
      return NextResponse.json({ status: "authority-mismatch" }, { status: 409 });
    }
    return settlePersistedAuthority(admin, hash, retryProof);
  }

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
      signal: AbortSignal.timeout(MERCHANT_VERIFY_TIMEOUT_MS),
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
  const custom = verifyPulseAdsCheckoutCustom(verifiedCustom);

  const authoritative = verified.valid === true
    && verifiedTransactionId.length > 0
    && verifiedMerchant === merchantUsername
    && pricingCurrency === "USDT"
    && amountUsdMicros !== null
    && custom !== null
    && custom.campaignId === callbackAuthority.campaignId
    && custom.checkoutReference === callbackAuthority.checkoutReference
    && callbackTransactionId === verifiedTransactionId
    && callbackCustom === verifiedCustom;

  if (!authoritative || !custom || amountUsdMicros === null) {
    return NextResponse.json({ status: "rejected" }, { status: 200 });
  }

  // The provider token is single-use. Persist only authoritative provider proof,
  // then allow internal settlement to retry from that durable record without
  // consuming the token again.
  const providerVerifiedAt = new Date().toISOString();
  const { error: proofError } = await admin
    .from("pulse_ads_merchant_callbacks")
    .upsert({
      token_hash: hash,
      state: "pending",
      provider_transaction_id: verifiedTransactionId,
      custom_reference: verifiedCustom,
      verified_campaign_id: custom.campaignId,
      verified_checkout_reference: custom.checkoutReference,
      verified_amount_usd_micros: amountUsdMicros,
      verified_pricing_currency: pricingCurrency,
      provider_verified_at: providerVerifiedAt,
      reason: "provider_verified",
      updated_at: providerVerifiedAt,
    }, { onConflict: "token_hash" });

  if (proofError) {
    return NextResponse.json({ status: "proof-persistence-unavailable" }, { status: 503 });
  }

  return settlePersistedAuthority(admin, hash, {
    campaignId: custom.campaignId,
    checkoutReference: custom.checkoutReference,
    transactionId: verifiedTransactionId,
    amountUsdMicros,
    pricingCurrency,
  });
}
