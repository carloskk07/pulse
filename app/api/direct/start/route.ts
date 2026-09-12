import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function earnRedirect(request: NextRequest, state: string) {
  return NextResponse.redirect(new URL(`/earn?direct=${encodeURIComponent(state)}`, request.url), 303);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return earnRedirect(request, "origin-rejected");

  const formData = await request.formData();
  const campaignId = String(formData.get("campaign") ?? "").trim();
  if (!UUID_RE.test(campaignId)) return earnRedirect(request, "invalid");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return earnRedirect(request, "service-unavailable");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth?next=/earn", request.url), 303);

  const admin = createSupabaseAdminClient();
  if (!admin) return earnRedirect(request, "service-unavailable");

  const { data, error } = await admin.rpc("start_direct_campaign_session", {
    p_campaign_id: campaignId,
    p_user_id: user.id,
    p_ttl_minutes: 60,
  });

  if (error || !data || typeof data !== "object") return earnRedirect(request, "unavailable");
  const result = data as Record<string, unknown>;
  const status = String(result.status ?? "unknown");

  if (status === "already_completed") return earnRedirect(request, "already-completed");
  if (status !== "reserved" && status !== "idempotent") return earnRedirect(request, status);

  const destination = String(result.destination_url ?? "");
  const sessionId = String(result.session_id ?? "");
  if (!UUID_RE.test(sessionId)) return earnRedirect(request, "session-error");

  let target: URL;
  try {
    target = new URL(destination);
  } catch {
    return earnRedirect(request, "destination-error");
  }
  if (target.protocol !== "https:") return earnRedirect(request, "destination-error");

  // Only a pseudonymous session identifier leaves Pulse. The advertiser does not receive
  // the user's Pulse account id, email or balance identity.
  target.searchParams.set("pulse_session_id", sessionId);
  target.searchParams.set("pulse_campaign_id", campaignId);

  // 303 intentionally converts the POST into a GET when the user leaves Pulse.
  return NextResponse.redirect(target, 303);
}
