import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/current-user-context";
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

export async function GET(request: NextRequest) {
  const opportunityId = request.nextUrl.searchParams.get("opportunity")?.trim() ?? "";
  if (!UUID_RE.test(opportunityId)) {
    return NextResponse.redirect(new URL("/earn?cashback=invalid", request.url), 302);
  }

  const { user } = await getCurrentUserContext();
  if (!user) {
    const auth = new URL("/auth", request.url);
    auth.searchParams.set("next", `/api/cashback/start?opportunity=${encodeURIComponent(opportunityId)}`);
    return NextResponse.redirect(auth, 302);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.redirect(new URL("/earn?cashback=unavailable", request.url), 302);
  }

  const { data, error } = await admin.rpc("create_cashback_tracking_session", {
    p_user_id: user.id,
    p_opportunity_id: opportunityId,
  });

  if (error || !data || typeof data !== "object") {
    return NextResponse.redirect(new URL("/earn?cashback=unavailable", request.url), 302);
  }

  const result = data as TrackingResult;
  if (result.status !== "ready" || !UUID_RE.test(result.tracking_id ?? "")) {
    const reason = result.status === "cashback_disabled" ? "not-live" : "unavailable";
    return NextResponse.redirect(new URL(`/earn?cashback=${reason}`, request.url), 302);
  }

  const destination = safeDestination(result.destination_url ?? "");
  const trackingParam = result.tracking_param ?? "";
  if (!destination || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(trackingParam)) {
    return NextResponse.redirect(new URL("/earn?cashback=unavailable", request.url), 302);
  }

  destination.searchParams.set(trackingParam, result.tracking_id!);
  destination.searchParams.set("utm_source", "pulsercuit");
  destination.searchParams.set("utm_medium", "cashback");

  return NextResponse.redirect(destination, 302);
}
