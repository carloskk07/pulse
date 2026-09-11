import { NextRequest, NextResponse } from "next/server";
import { bindReferralForUser, cleanReferralCode } from "@/lib/referrals";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const ref = cleanReferralCode(url.searchParams.get("ref"));
  const rawNext = url.searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const supabase = await createSupabaseServerClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && ref) await bindReferralForUser(user.id, ref);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  const fallback = new URL("/auth", url.origin);
  fallback.searchParams.set("error", "callback-failed");
  fallback.searchParams.set("next", next);
  if (ref) fallback.searchParams.set("ref", ref);
  return NextResponse.redirect(fallback);
}
