import { NextRequest, NextResponse } from "next/server";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AyetProvider, isAyetRewardEconomicallyAligned, isAyetRewardRateAligned } from "@/providers/ayet";

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

  // The signed ayeT amount is the user-facing reward authority. Pulse requires
  // a 0-decimal adslot so currency_amount is a whole credit, then verifies that
  // the configured rate and payout economics differ by less than one credit.
  if (event.callbackType === "conversion" && !isAyetRewardRateAligned(event.raw.currency_conversion_rate)) {
    return response({ ok: false, ignored: "reward-rate-mismatch" });
  }
  if (event.callbackType === "conversion" && !isAyetRewardEconomicallyAligned(event.payoutUsdMicros, event.rewardCredits)) {
    return response({ ok: false, ignored: "reward-amount-mismatch" });
  }

  // Sandbox is a non-financial provider preflight. Once HMAC, adslot binding,
  // whole-credit reward authority and economic alignment pass, persist a
  // separate fingerprint without creating any ledger authority.
  if (request.nextUrl.searchParams.get("is_sandbox") === "1") {
    if (event.callbackType !== "conversion") return response({ ok: true, status: "sandbox-ignored" });
    const recorded = await recordReleaseEvidence("ayet_transport");
    return response({ ok: true, status: recorded ? "sandbox-verified" : "sandbox-verified-evidence-unavailable" });
  }

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

  if (event.callbackType === "conversion" && result?.status === "credited") {
    await recordReleaseEvidence("ayet_callback");
  }

  return response({ ok: true, status: result?.status ?? "processed" });
}
