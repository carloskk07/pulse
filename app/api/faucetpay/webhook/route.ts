import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32_768;
const EVENT_ID_RE = /^[A-Za-z0-9._:-]{8,200}$/;
const ASSET_RE = /^[A-Z0-9]{2,16}$/;
const PAYOUT_ID_RE = /^[A-Za-z0-9._:-]{1,200}$/;
const SIGNATURE_RE = /^sha256=[0-9a-f]{64}$/i;

type JsonRecord = Record<string, unknown>;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function verifySignature(rawBody: string, signature: string, secret: string) {
  if (!SIGNATURE_RE.test(signature)) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");

  const suppliedBytes = Buffer.from(signature.toLowerCase(), "utf8");
  const expectedBytes = Buffer.from(expected.toLowerCase(), "utf8");
  return suppliedBytes.length === expectedBytes.length
    && timingSafeEqual(suppliedBytes, expectedBytes);
}

function positiveSafeInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.FAUCETPAY_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret || secret.length > 512) {
    return json(503, { status: "webhook-not-configured" });
  }

  const signature = request.headers.get("x-faucetpay-signature")?.trim() ?? "";
  if (!signature) return json(401, { status: "missing-signature" });

  const rawBody = await request.text();
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return json(400, { status: "invalid-payload" });
  }

  // FaucetPay signs the exact raw request body. Verify before JSON parsing.
  if (!verifySignature(rawBody, signature, secret)) {
    return json(401, { status: "invalid-signature" });
  }

  let payload: JsonRecord;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    const body = record(parsed);
    if (!body) return json(400, { status: "invalid-json" });
    payload = body;
  } catch {
    return json(400, { status: "invalid-json" });
  }

  const data = record(payload.data);
  if (!data) return json(400, { status: "invalid-data" });

  const eventId = String(payload.id ?? "").trim();
  const eventType = String(payload.event ?? "").trim();
  const faucetId = positiveSafeInteger(payload.faucet_id);
  const createdAtSeconds = positiveSafeInteger(payload.created_at);
  const destination = String(data.to ?? "").trim();
  const amountUnits = positiveSafeInteger(data.amount);
  const asset = String(data.currency ?? "").trim().toUpperCase();
  const providerPayoutIdRaw = String(data.payout_id ?? "").trim();
  const providerPayoutId = providerPayoutIdRaw || null;
  const providerMessage = String(data.message ?? "").trim().slice(0, 500);

  if (
    !EVENT_ID_RE.test(eventId)
    || (eventType !== "payout.sent" && eventType !== "payout.failed")
    || !faucetId
    || !createdAtSeconds
    || !destination
    || destination.length > 200
    || !amountUnits
    || !ASSET_RE.test(asset)
    || (providerPayoutId !== null && !PAYOUT_ID_RE.test(providerPayoutId))
    || (eventType === "payout.sent" && providerPayoutId === null)
  ) {
    return json(400, { status: "invalid-event" });
  }

  const eventCreatedAt = new Date(createdAtSeconds * 1000);
  if (!Number.isFinite(eventCreatedAt.getTime())) {
    return json(400, { status: "invalid-created-at" });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return json(503, { status: "database-not-configured" });

  const destinationHash = createHash("sha256").update(destination).digest("hex");
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  const { data: reconciliation, error } = await admin.rpc(
    "reconcile_faucetpay_payout_webhook",
    {
      p_event_id: eventId,
      p_event_type: eventType,
      p_faucet_id: faucetId,
      p_destination: destination,
      p_destination_sha256: destinationHash,
      p_amount_units: amountUnits,
      p_asset: asset,
      p_provider_payout_id: providerPayoutId,
      p_event_created_at: eventCreatedAt.toISOString(),
      p_payload_sha256: payloadHash,
      p_message: providerMessage || null,
    },
  );

  if (error || !reconciliation || typeof reconciliation !== "object") {
    return json(503, { status: "reconciliation-unavailable" });
  }

  const result = reconciliation as JsonRecord;
  const status = String(result.status ?? "unknown");

  if (status === "disabled") return json(503, { status });
  if (status === "faucet_mismatch") return json(403, { status });
  if (status === "invalid" || status === "invalid_payout_id") return json(400, { status });
  if (status === "event_id_payload_mismatch") return json(409, { status });
  if (status === "retry") return json(503, result);

  // Signed but stale/unmatched/ambiguous events are acknowledged without
  // changing a withdrawal. Their evidence remains auditable in the database
  // when applicable; only a unique submitted match can settle.
  if (
    status === "stale_event"
    || status === "accepted"
    || status === "conflict"
    || status === "duplicate"
    || status === "idempotent"
    || status === "processed"
  ) {
    return json(200, result);
  }

  return json(409, result);
}
