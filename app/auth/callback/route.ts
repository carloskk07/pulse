import { NextRequest, NextResponse } from "next/server";
import { PASSWORD_RECOVERY_CONTEXT_PKCE, PASSWORD_RECOVERY_COOKIE, recoveryCookieOptions, safeAuthNext } from "@/lib/auth-security";
import { beginPasswordRecoveryProofChallenge, hasRecentRecoverySend } from "@/lib/auth-recovery-proof";
import { bindReferralForUser, cleanReferralCode } from "@/lib/referrals";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const ref = cleanReferralCode(url.searchParams.get("ref"));
  const next = safeAuthNext(url.searchParams.get("next"));
  const flow = url.searchParams.get("flow");
  const supabase = await createSupabaseServerClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && ref) await bindReferralForUser(user.id, ref);

      const response = NextResponse.redirect(new URL(next, url.origin), 303);
      response.headers.set("Cache-Control", "private, no-store");
      if (flow === "recovery" && next === "/auth/update-password") {
        if (user) {
          const recoverySentAt = "recovery_sent_at" in user ? String(user.recovery_sent_at ?? "") : null;
          if (hasRecentRecoverySend(recoverySentAt)) {
            await beginPasswordRecoveryProofChallenge(user.id, "pkce");
          }
        }
        response.cookies.set(PASSWORD_RECOVERY_COOKIE, PASSWORD_RECOVERY_CONTEXT_PKCE, recoveryCookieOptions());
      }
      return response;
    }
  }

  const fallback = new URL("/auth", url.origin);
  fallback.searchParams.set("error", "callback-failed");
  fallback.searchParams.set("next", next);
  if (ref) fallback.searchParams.set("ref", ref);
  const response = NextResponse.redirect(fallback, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
