import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { PASSWORD_RECOVERY_CONTEXT_OTP, PASSWORD_RECOVERY_COOKIE, recoveryCookieOptions, safeAuthNext } from "@/lib/auth-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const defaultNext = type === "recovery" ? "/auth/update-password" : "/dashboard";
  const next = safeAuthNext(request.nextUrl.searchParams.get("next"), defaultNext);
  const supabase = await createSupabaseServerClient();

  if (tokenHash && type && supabase) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const response = NextResponse.redirect(new URL(next, request.url), 303);
      response.headers.set("Cache-Control", "private, no-store");
      if (type === "recovery" && next === "/auth/update-password") {
        response.cookies.set(PASSWORD_RECOVERY_COOKIE, PASSWORD_RECOVERY_CONTEXT_OTP, recoveryCookieOptions());
      }
      return response;
    }
  }

  const fallback = new URL("/auth", request.url);
  fallback.searchParams.set("error", "callback-failed");
  const response = NextResponse.redirect(fallback, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
