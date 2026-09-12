import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const secret = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!secret || secret.length > 256) return json(401, { status: "unauthorized" });

  const raw = await request.text();
  if (!raw || raw.length > 32_768) return json(400, { status: "invalid_payload" });

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json(400, { status: "invalid_payload" });
    payload = parsed as Record<string, unknown>;
  } catch {
    return json(400, { status: "invalid_json" });
  }

  const campaignId = String(payload.campaignId ?? "").trim();
  const sessionId = String(payload.sessionId ?? "").trim();
  const externalEventId = String(payload.externalEventId ?? "").trim();
  if (!UUID_RE.test(campaignId) || !UUID_RE.test(sessionId) || !externalEventId || externalEventId.length > 200) {
    return json(400, { status: "invalid_request" });
  }

  let occurredAt = new Date();
  if (payload.occurredAt != null) {
    const candidate = new Date(String(payload.occurredAt));
    if (!Number.isFinite(candidate.getTime())) return json(400, { status: "invalid_occurred_at" });
    occurredAt = candidate;
  }

  const eventPayload = payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
    ? payload.metadata as Record<string, unknown>
    : {};

  const admin = createSupabaseAdminClient();
  if (!admin) return json(503, { status: "service_unavailable" });

  const { data, error } = await admin.rpc("settle_direct_campaign_completion", {
    p_campaign_id: campaignId,
    p_session_id: sessionId,
    p_external_event_id: externalEventId,
    p_secret: secret,
    p_payload: eventPayload,
    p_occurred_at: occurredAt.toISOString(),
  });

  if (error || !data || typeof data !== "object") return json(500, { status: "settlement_error" });
  const result = data as Record<string, unknown>;
  const status = String(result.status ?? "unknown");

  if (status === "unauthorized") return json(401, { status });
  if (status === "unknown_session" || status === "not_found") return json(404, { status });
  if (status === "session_expired" || status === "session_not_reserved") return json(409, { status });
  if (status === "duplicate_event" || status === "session_already_settled") return json(409, { status });
  if (status === "invalid_request") return json(400, { status });
  if (status === "credited" || status === "idempotent") return json(200, result);

  return json(409, result);
}
