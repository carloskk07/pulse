import { NextRequest, NextResponse } from "next/server";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AyetProvider, isAyetRewardAmountAligned, isAyetRewardRateAligned } from "@/providers/ayet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const provider = new AyetProvider();
  const configuredAdslot = process.env.AYET_ADSLOT_ID?.trim();
  if (!process.env.AYET_API_KEY || !configuredAdslot || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return response({ ok: false, error: "provider-not-configured" }, 503);
  }

  if (!(await provider.verifyCallback(request))) {
    return response({ ok: false, ignored: "invalid-signature" });
  }

  // The publisher API key authenticates ayeT, but it can cover more than one
  // placement/adslot. Bind callback authority to the exact live earning route.
  const callbackAdslot = request.nextUrl.searchParams.get("adslot_id")?.trim();
  if (!callbackAdslot || callbackAdslot !== configuredAdslot) {
    return response({ ok: false, ignored: "invalid-adslot" });
  }

  let event;
  try {
    event = await provider.normalizeCallback(request);
  } catch (error) {
    return response({ ok: false, ignored: error instanceof Error ? error.message : "invalid-callback" });
  }

  // The offerwall must advertise the same exchange rate and exact event reward
  // that the server settles. This prevents a signed callback from promising one
  // amount in the ayeT UI while Pulse credits another amount to the ledger.
  if (event.callbackType === "conversion" && !isAyetRewardRateAligned(event.raw.currency_conversion_rate)) {
    return response({ ok: false, ignored: "reward-rate-mismatch" });
  }
  if (event.callbackType === "conversion" && !isAyetRewardAmountAligned(event.raw.currency_amount, event.rewardCredits)) {
    return response({ ok: false, ignored: "reward-amount-mismatch" });
  }

  // Sandbox is a non-financial provider preflight. Once HMAC, adslot binding,
  // reward alignment and callback parsing pass, persist a separate fingerprint
  // without creating any ledger authority.
  if (request.nextUrl.searchParams.get("is_sandbox") === "1") {
    if (event.callbackType !== "conversion") return response({ ok: true, status: "sandbox-ignored" });
    const recorded = await recordReleaseEvidence("ayet_transport");
    return response({ ok: true, status: recorded ? "sandbox-verified" : "sandbox-verified-evidence-unavailable" });
  }

  // Financial validation applies only to production callbacks. Sandbox
  // identifiers and fake payouts never need to look like authoritative users.
  if (event.callbackType === "conversion" && (!event.userId || !uuidPattern.test(event.userId))) return response({ ok: false, ignored: "invalid-user-id" });
  if (event.callbackType === "conversion" && (event.payoutUsdMicros <= 0 || event.rewardCredits <= 0)) return response({ ok: false, ignored: "non-positive-conversion" });

  const admin = createSupabaseAdminClient();
  if (!admin) return response({ ok: false, error: "database-not-configured" }, 503);

  const { data, error } = await admin.rpc("apply_monetization_callback", {
    p_provider: event.provider,
    p_external_id: event.externalId,
    p_original_external_id: event.originalExternalId ?? null,
    p_user_id: event.userId ?? null,
    p_callback_type: event.callbackType,
    p_payout_usd_micros: event.payoutUsdMicros,
    p_reward_credits: event.rewardCredits,
    p_occurred_at: event.occurredAt,
    p_payload: event.raw,
  });

  if (error) return response({ ok: false, error: "processing-failed" }, 500);
  const result = data as { status?: string } | null;
  if (result?.status === "orphan_chargeback") return response({ ok: false, error: "orphan-chargeback" }, 503);

  // Only a fresh production conversion that actually created authoritative
  // financial state may certify the current provider configuration. A duplicate
  // or sandbox callback is deliberately insufficient evidence.
  if (event.callbackType === "conversion" && result?.status === "credited") {
    await recordReleaseEvidence("ayet_callback");
  }

  return response({ ok: true, status: result?.status ?? "processed" });
}
