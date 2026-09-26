import { NextRequest, NextResponse } from "next/server";
import { getProductRouteHref } from "@/lib/route-semantics";
import { getCurrentUserContext } from "@/lib/current-user-context";
import { isTrustedSameOriginMutation, readUrlEncodedFormWithLimit } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TrackingResult = {
  status?: string;
  tracking_id?: string;
  destination_url?: string;
  tracking_param?: string;
};

function safeDestination(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || !hostname
      || hostname === "localhost"
      || hostname.endsWith(".local")
    ) return null;
    return url;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) {
    return NextResponse.json({ status: "origin-rejected" }, { status: 403 });
  }

  const form = await readUrlEncodedFormWithLimit(request, 1_024);
  const opportunityId = form?.get("opportunity")?.trim() ?? "";
  if (!UUID_RE.test(opportunityId)) {
    return NextResponse.redirect(new URL(getProductRouteHref("earn", "?cashback=invalid"), request.url), 303);
  }

  const { user } = await getCurrentUserContext();
  if (!user) {
    const auth = new URL("/auth", request.url);
    auth.searchParams.set("next", "/earn");
    return NextResponse.redirect(auth, 303);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.redirect(new URL(getProductRouteHref("earn", "?cashback=unavailable"), request.url), 303);
  }

  const { data, error } = await admin.rpc("create_cashback_tracking_session", {
    p_user_id: user.id,
    p_opportunity_id: opportunityId,
  });

  if (error || !data || typeof data !== "object") {
    return NextResponse.redirect(new URL(getProductRouteHref("earn", "?cashback=unavailable"), request.url), 303);
  }

  const result = data as TrackingResult;
  if (result.status !== "ready" || !UUID_RE.test(result.tracking_id ?? "")) {
    const reason = result.status === "cashback_disabled" ? "not-live" : "unavailable";
    return NextResponse.redirect(new URL(getProductRouteHref("earn", `?cashback=${reason}`), request.url), 303);
  }

  const destination = safeDestination(result.destination_url ?? "");
  const trackingParam = result.tracking_param ?? "";
  if (!destination || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(trackingParam)) {
    return NextResponse.redirect(new URL(getProductRouteHref("earn", "?cashback=unavailable"), request.url), 303);
  }

  destination.searchParams.set(trackingParam, result.tracking_id!);
  destination.searchParams.set("utm_source", "pulsercuit");
  destination.searchParams.set("utm_medium", "cashback");

  return NextResponse.redirect(destination, 303);
}
