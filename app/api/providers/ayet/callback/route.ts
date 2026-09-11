import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AyetProvider } from "@/providers/ayet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const provider = new AyetProvider();
  if (!process.env.AYET_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return response({ ok: false, error: "provider-not-configured" }, 503);

  if (!(await provider.verifyCallback(request))) {
    // Do not create any financial state for unverifiable callbacks.
    // 200 prevents a retry storm from intentionally invalid traffic.
    return response({ ok: false, ignored: "invalid-signature" });
  }

  let event;
  try {
    event = await provider.normalizeCallback(request);
  } catch (error) {
    return response({ ok: false, ignored: error instanceof Error ? error.message : "invalid-callback" });
  }

  if (!uuidPattern.test(event.userId)) return response({ ok: false, ignored: "invalid-user-id" });
  if (event.callbackType === "conversion" && (event.payoutUsdMicros <= 0 || event.rewardCredits <= 0)) return response({ ok: false, ignored: "non-positive-conversion" });

  const admin = createSupabaseAdminClient();
  if (!admin) return response({ ok: false, error: "database-not-configured" }, 503);

  const { data, error } = await admin.rpc("apply_monetization_callback", {
    p_provider: event.provider,
    p_external_id: event.externalId,
    p_original_external_id: event.originalExternalId ?? null,
    p_user_id: event.userId,
    p_callback_type: event.callbackType,
    p_payout_usd_micros: event.payoutUsdMicros,
    p_reward_credits: event.rewardCredits,
    p_occurred_at: event.occurredAt,
    p_payload: event.raw,
  });

  if (error) return response({ ok: false, error: "processing-failed" }, 500);
  const result = data as { status?: string } | null;
  if (result?.status === "orphan_chargeback") return response({ ok: false, error: "orphan-chargeback" }, 503);

  return response({ ok: true, status: result?.status ?? "processed" });
}
