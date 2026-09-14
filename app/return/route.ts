import { NextRequest, NextResponse } from "next/server";
import {
  cleanReminderId,
  recordReminderReturn,
  RETENTION_ATTRIBUTION_COOKIE,
  RETENTION_ATTRIBUTION_MAX_AGE_SECONDS,
} from "@/lib/retention-attribution";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function dashboardRedirect(request: NextRequest, state: string) {
  const url = new URL("/dashboard", request.url);
  url.searchParams.set("return", state);
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const reminderId = cleanReminderId(request.nextUrl.searchParams.get("rid"));
  if (!reminderId) return dashboardRedirect(request, "invalid");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return dashboardRedirect(request, "unavailable");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const authUrl = new URL("/auth", request.url);
    authUrl.searchParams.set("next", `/return?rid=${encodeURIComponent(reminderId)}`);
    const response = NextResponse.redirect(authUrl, 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const recorded = await recordReminderReturn(user.id, reminderId);
  if (!recorded) return dashboardRedirect(request, "expired");

  const response = dashboardRedirect(request, "calendar");
  response.cookies.set(RETENTION_ATTRIBUTION_COOKIE, reminderId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: RETENTION_ATTRIBUTION_MAX_AGE_SECONDS,
  });
  return response;
}
