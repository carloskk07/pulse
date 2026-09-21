import { NextRequest, NextResponse } from "next/server";
import { isTrustedSameOriginMutation, readUrlEncodedFormWithLimit } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) return json(403, { status: "origin-rejected" });

  const formData = await readUrlEncodedFormWithLimit(request, 4_096);
  if (!formData) return json(400, { status: "invalid" });
  const campaignId = String(formData.get("campaign") ?? "").trim();
  const sourcePulseClaimId = String(formData.get("source_pulse_claim_id") ?? "").trim();
  const cleanSourcePulseClaimId = UUID_RE.test(sourcePulseClaimId) ? sourcePulseClaimId : null;
  if (!UUID_RE.test(campaignId)) return json(400, { status: "invalid" });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return json(503, { status: "service-unavailable" });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { status: "auth-required" });

  const admin = createSupabaseAdminClient();
  if (!admin) return json(503, { status: "service-unavailable" });

  const { data, error } = await admin.rpc("start_direct_campaign_session", {
    p_campaign_id: campaignId,
    p_user_id: user.id,
    p_ttl_minutes: 60,
  });

  if (error || !data || typeof data !== "object") return json(503, { status: "unavailable" });
  const result = data as Record<string, unknown>;
  const status = String(result.status ?? "unknown");

  if (status !== "reserved" && status !== "idempotent") {
    return json(409, { status });
  }

  const destination = String(result.destination_url ?? "");
  const sessionId = String(result.session_id ?? "");
  if (!UUID_RE.test(sessionId)) return json(500, { status: "session-error" });

  if (cleanSourcePulseClaimId) {
    // Attribution is evidence only. It must never block a funded reservation.
    await admin.rpc("attach_direct_session_to_pulse_claim", {
      p_session_id: sessionId,
      p_user_id: user.id,
      p_pulse_claim_id: cleanSourcePulseClaimId,
    });
  }

  let target: URL;
  try {
    target = new URL(destination);
  } catch {
    return json(400, { status: "destination-error" });
  }
  if (target.protocol !== "https:") return json(400, { status: "destination-error" });

  // Only pseudonymous campaign/session identifiers leave PulseCircuit.
  target.searchParams.set("pulse_session_id", sessionId);
  target.searchParams.set("pulse_campaign_id", campaignId);

  return json(200, {
    status,
    destination: target.toString(),
  });
}
