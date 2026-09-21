import { NextRequest, NextResponse } from "next/server";
import { isTrustedSameOriginMutation } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function earnRedirect(request: NextRequest, state: string, sourcePulseClaimId?: string | null) {
  const target = new URL("/earn", request.url);
  target.searchParams.set("direct", state);
  if (sourcePulseClaimId && UUID_RE.test(sourcePulseClaimId)) {
    target.searchParams.set("claim", sourcePulseClaimId);
  }
  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) return earnRedirect(request, "origin-rejected");

  const formData = await request.formData();
  const campaignId = String(formData.get("campaign") ?? "").trim();
  const sourcePulseClaimId = String(formData.get("source_pulse_claim_id") ?? "").trim();
  const cleanSourcePulseClaimId = UUID_RE.test(sourcePulseClaimId) ? sourcePulseClaimId : null;
  if (!UUID_RE.test(campaignId)) return earnRedirect(request, "invalid", cleanSourcePulseClaimId);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return earnRedirect(request, "service-unavailable", cleanSourcePulseClaimId);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth?next=/earn", request.url), 303);

  const admin = createSupabaseAdminClient();
  if (!admin) return earnRedirect(request, "service-unavailable", cleanSourcePulseClaimId);

  const { data, error } = await admin.rpc("start_direct_campaign_session", {
    p_campaign_id: campaignId,
    p_user_id: user.id,
    p_ttl_minutes: 60,
  });

  if (error || !data || typeof data !== "object") return earnRedirect(request, "unavailable", cleanSourcePulseClaimId);
  const result = data as Record<string, unknown>;
  const status = String(result.status ?? "unknown");

  if (status === "already_completed") return earnRedirect(request, "already-completed", cleanSourcePulseClaimId);
  if (status !== "reserved" && status !== "idempotent") return earnRedirect(request, status, cleanSourcePulseClaimId);

  const destination = String(result.destination_url ?? "");
  const sessionId = String(result.session_id ?? "");
  if (!UUID_RE.test(sessionId)) return earnRedirect(request, "session-error", cleanSourcePulseClaimId);

  if (cleanSourcePulseClaimId) {
    // Attribution must never block a funded user action. The RPC validates that
    // the claim belongs to this user and is recent before attaching it.
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
    return earnRedirect(request, "destination-error", cleanSourcePulseClaimId);
  }
  if (target.protocol !== "https:") return earnRedirect(request, "destination-error", cleanSourcePulseClaimId);

  // Only a pseudonymous session identifier leaves Pulse. The advertiser does not receive
  // the user's Pulse account id, email or balance identity.
  target.searchParams.set("pulse_session_id", sessionId);
  target.searchParams.set("pulse_campaign_id", campaignId);

  // 303 intentionally converts the POST into a GET when the user leaves Pulse.
  return NextResponse.redirect(target, 303);
}
