import { NextRequest, NextResponse } from "next/server";
import { clickPulseAd } from "@/lib/pulse-ads";
import { isTrustedSameOriginMutation } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(status: number) {
  return NextResponse.json({ ok: false }, { status });
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) return failure(403);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure(503);

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = !claimsError && typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
  if (!userId) return failure(401);

  const formData = await request.formData();
  const campaignId = String(formData.get("campaign") ?? "").trim();
  if (!UUID_RE.test(campaignId)) return failure(400);

  const result = await clickPulseAd(campaignId, userId);
  const destination = typeof result.destination_url === "string" ? result.destination_url : "";

  try {
    const url = new URL(destination);
    if (url.protocol === "https:") {
      return NextResponse.json({ ok: true, destination: url.toString() });
    }
  } catch {
    // Fail closed if a stored destination ever drifts.
  }

  return failure(400);
}
