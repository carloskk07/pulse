import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readRequestTextWithLimit } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 16_384;

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function postbackSecret() {
  const value = process.env.CASHBACK_ADMITAD_POSTBACK_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

function secureEqual(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function normalizedStatus(value: string): "pending" | "confirmed" | "reversed" | null {
  const status = value.trim().toLowerCase();
  if (status === "new" || status === "pending") return "pending";
  if (status === "approved") return "confirmed";
  if (status === "declined") return "reversed";
  return null;
}

function parseUsdMicros(value: string) {
  const raw = value.trim().replace(",", ".");
  const match = raw.match(/^(\d{1,9})(?:\.(\d{1,6}))?$/);
  if (!match) return null;
  const micros = Number(match[1]) * 1_000_000 + Number((match[2] ?? "").padEnd(6, "0"));
  return Number.isSafeInteger(micros) && micros > 0 ? micros : null;
}

function bounded(value: string | null, max: number) {
  const clean = value?.trim() ?? "";
  return clean ? clean.slice(0, max) : null;
}

async function readParams(request: NextRequest) {
  if (request.method === "GET") return request.nextUrl.searchParams;

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") return null;

  const raw = await readRequestTextWithLimit(request, MAX_BODY_BYTES);
  if (!raw) return null;
  return new URLSearchParams(raw);
}

async function handle(request: NextRequest) {
  const expected = postbackSecret();
  if (!expected) return response({ status: "not-configured" }, 503);

  const params = await readParams(request);
  if (!params) return response({ status: "unsupported-content-type" }, 415);

  const suppliedSecret = params.get("key")?.trim() ?? "";
  if (!suppliedSecret || suppliedSecret.length > 512 || !secureEqual(expected, suppliedSecret)) {
    return response({ status: "unauthorized" }, 401);
  }

  const trackingId = params.get("subid4")?.trim() ?? "";
  const externalId = params.get("admitad_id")?.trim() ?? "";
  const sourceStatus = params.get("payment_status")?.trim() ?? "";
  const eventStatus = normalizedStatus(sourceStatus);
  const currency = (params.get("currency") ?? "").trim().toUpperCase();

  if (
    !UUID_RE.test(trackingId)
    || !externalId
    || externalId.length > 200
    || !eventStatus
  ) {
    return response({ status: "invalid-request" }, 400);
  }

  if (eventStatus !== "reversed" && currency !== "USD") {
    return response({ status: "unsupported-currency", currency }, 422);
  }

  const commissionUsdMicros = eventStatus === "reversed"
    ? 0
    : parseUsdMicros(params.get("payment_sum") ?? "");
  if (eventStatus !== "reversed" && !commissionUsdMicros) {
    return response({ status: "invalid-commission" }, 400);
  }

  const metadata = {
    source: "admitad-postback",
    payment_status: sourceStatus.slice(0, 32),
    currency: currency.slice(0, 8),
    offer_id: bounded(params.get("offer_id"), 120),
    order_id: bounded(params.get("order_id"), 160),
    action: bounded(params.get("action"), 120),
    action_id: bounded(params.get("action_id"), 120),
    country_code: bounded(params.get("country_code"), 8),
  };

  const admin = createSupabaseAdminClient();
  if (!admin) return response({ status: "service-unavailable" }, 503);

  const { data, error } = await admin.rpc("apply_cashback_attributed_event", {
    p_provider: "admitad",
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

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
