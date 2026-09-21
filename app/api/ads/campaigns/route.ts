import { NextRequest, NextResponse } from "next/server";
import { createPulseAdCampaign } from "@/lib/pulse-ads";
import { isTrustedSameOriginMutation } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

function redirectState(request: NextRequest, state: string) {
  return NextResponse.redirect(new URL(`/advertise?state=${encodeURIComponent(state)}`, request.url), 303);
}

function cleanHttpsUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function cleanCountries(value: string) {
  return [...new Set(
    value
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter((item) => /^[A-Z]{2}$/.test(item)),
  )].slice(0, 24);
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) return redirectState(request, "verification-failed");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return redirectState(request, "service-unavailable");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = !claimsError && typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
  if (!userId) return NextResponse.redirect(new URL("/auth?next=/advertise", request.url), 303);

  const formData = await request.formData();
  const ip = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  const verification = await verifyTurnstile(
    String(formData.get("cf-turnstile-response") ?? ""),
    ip,
    { expectedAction: "pulse_ads_create" },
  );
  if (!verification.success) {
    return redirectState(request, verification.missingConfig ? "verification-unavailable" : "verification-failed");
  }

  const title = String(formData.get("title") ?? "").trim().slice(0, 90);
  const body = String(formData.get("body") ?? "").trim().slice(0, 220);
  const destinationUrl = cleanHttpsUrl(String(formData.get("destinationUrl") ?? ""));
  const budgetUsd = Number(formData.get("budgetUsd"));
  const countryCodes = cleanCountries(String(formData.get("countryCodes") ?? ""));
  const devicePlatforms = ["mobile", "desktop"].filter((device) => formData.get(device) === "on");

  if (
    title.length < 3
    || !body
    || !destinationUrl
    || !Number.isFinite(budgetUsd)
    || budgetUsd < 5
    || budgetUsd > 5000
  ) {
    return redirectState(request, "invalid");
  }

  const result = await createPulseAdCampaign({
    ownerUserId: userId,
    title,
    body,
    destinationUrl,
    budgetUsdMicros: Math.round(budgetUsd * 1_000_000),
    countryCodes,
    devicePlatforms,
  });

  return redirectState(request, String(result.status ?? "failed"));
}
