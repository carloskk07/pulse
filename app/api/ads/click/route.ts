import { NextRequest, NextResponse } from "next/server";
import { clickPulseAd } from "@/lib/pulse-ads";
import { isTrustedSameOriginMutation } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL("/dashboard", request.url), 303);

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = !claimsError && typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
  if (!userId) return NextResponse.redirect(new URL("/auth?next=/dashboard", request.url), 303);

  const formData = await request.formData();
  const campaignId = String(formData.get("campaign") ?? "").trim();
  if (!UUID_RE.test(campaignId)) return NextResponse.redirect(new URL("/dashboard", request.url), 303);

  const result = await clickPulseAd(campaignId, userId);
  const destination = typeof result.destination_url === "string" ? result.destination_url : "";

  try {
    const url = new URL(destination);
    if (url.protocol === "https:") return NextResponse.redirect(url, 303);
  } catch {
    // Fail closed to the product if a stored destination ever drifts.
  }

  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
