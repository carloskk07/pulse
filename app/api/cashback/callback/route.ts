import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readRequestTextWithLimit } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDER_RE = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const MAX_BODY_BYTES = 16_384;

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function callbackSecret() {
  const value = process.env.CASHBACK_CALLBACK_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

function authorized(request: NextRequest) {
  const expected = callbackSecret();
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!supplied || supplied.length > 512) return false;

  const expectedHash = createHash("sha256").update(expected).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

export async function POST(request: NextRequest) {
  if (!callbackSecret()) return response({ status: "not-configured" }, 503);
  if (!authorized(request)) return response({ status: "unauthorized" }, 401);

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return response({ status: "unsupported-content-type" }, 415);

  const raw = await readRequestTextWithLimit(request, MAX_BODY_BYTES);
  if (!raw) return response({ status: "invalid-payload" }, 400);

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return response({ status: "invalid-payload" }, 400);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return response({ status: "invalid-json" }, 400);
  }

  const provider = String(payload.provider ?? "").trim().toLowerCase();
  const trackingId = String(payload.trackingId ?? "").trim();
  const externalId = String(payload.externalId ?? "").trim();
  const eventStatus = String(payload.status ?? "").trim().toLowerCase();
  const commissionUsdMicros = Number(payload.commissionUsdMicros ?? 0);
  const metadata = payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
    ? payload.metadata as Record<string, unknown>
    : {};

  if (
    !PROVIDER_RE.test(provider)
    || !UUID_RE.test(trackingId)
    || !externalId
    || externalId.length > 200
    || !["pending", "confirmed", "reversed"].includes(eventStatus)
    || (eventStatus !== "reversed" && (!Number.isSafeInteger(commissionUsdMicros) || commissionUsdMicros <= 0))
  ) {
    return response({ status: "invalid-request" }, 400);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return response({ status: "service-unavailable" }, 503);

  const { data, error } = await admin.rpc("apply_cashback_attributed_event", {
    p_provider: provider,
    p_tracking_id: trackingId,
    p_external_id: externalId,
    p_status: eventStatus,
    p_commission_usd_micros: eventStatus === "reversed" ? 0 : commissionUsdMicros,
    p_payload: metadata,
  });

  if (error || !data || typeof data !== "object") {
    return response({ status: "processing-failed" }, 500);
  }

  const result = data as Record<string, unknown>;
  const status = String(result.status ?? "unknown");

  if (["pending", "confirmed", "reversed", "idempotent"].includes(status)) {
    return response({ ok: true, status }, 200);
  }
  if (["unknown_tracking", "orphan_reversal"].includes(status)) {
    return response({ ok: false, status }, 404);
  }
  if (["provider_mismatch", "tracking_already_bound", "economics_mismatch", "invalid_transition"].includes(status)) {
    return response({ ok: false, status }, 409);
  }
  if (status === "cashback_disabled") {
    return response({ ok: false, status }, 503);
  }
  if (["invalid", "invalid_commission", "reward_below_one_credit", "unknown_user"].includes(status)) {
    return response({ ok: false, status }, 400);
  }

  return response({ ok: false, status }, 409);
}
