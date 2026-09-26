import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  cleanReminderId,
  recordAttributedPulseCompletion,
  RETENTION_ATTRIBUTION_COOKIE,
} from "@/lib/retention-attribution";
import { isTrustedSameOriginMutation, readUrlEncodedFormWithLimit } from "@/lib/request-security";
import { getProductRouteHref } from "@/lib/route-semantics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureFreshTreasuryBacking } from "@/lib/treasury-backing";
import { verifyTurnstile } from "@/lib/turnstile";

function dashboardRedirect(request: NextRequest, state: string) {
  return NextResponse.redirect(new URL(getProductRouteHref("home", `?claim=${encodeURIComponent(state)}`), request.url), 303);
}

function revalidateRewardViews() {
  for (const path of ["/dashboard", "/dashboard/claimed", "/wallet", "/progress"]) {
    revalidatePath(path);
  }
}

async function claimReceiptRedirect(request: NextRequest, userId: string) {
  const reminderId = cleanReminderId(request.cookies.get(RETENTION_ATTRIBUTION_COOKIE)?.value);

  if (reminderId) {
    try {
      await recordAttributedPulseCompletion(userId, reminderId);
    } catch {
      console.warn("PULSECIRCUIT_POST_CLAIM_RETENTION_FAILED");
    }
  }

  try {
    revalidateRewardViews();
  } catch {
    console.warn("PULSECIRCUIT_POST_CLAIM_REVALIDATION_FAILED");
  }

  const response = NextResponse.redirect(new URL("/dashboard/claimed", request.url), 303);
  if (reminderId) {
    try {
      response.cookies.set(RETENTION_ATTRIBUTION_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    } catch {
      console.warn("PULSECIRCUIT_POST_CLAIM_COOKIE_CLEAR_FAILED");
    }
  }
  return response;
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) return dashboardRedirect(request, "verification-failed");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return dashboardRedirect(request, "service-not-configured");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const subject = claimsData?.claims?.sub;
  const userId = !claimsError && typeof subject === "string" ? subject : "";
  if (!userId) return NextResponse.redirect(new URL("/auth?next=/dashboard", request.url), 303);

  const formData = await readUrlEncodedFormWithLimit(request, 8_192);
  if (!formData) return dashboardRedirect(request, "verification-failed");
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip, { expectedAction: "hourly_pulse" });
  if (!verification.success) return dashboardRedirect(request, verification.missingConfig ? "verification-not-configured" : "verification-failed");

  const admin = createSupabaseAdminClient();
  if (!admin) return dashboardRedirect(request, "service-not-configured");

  // Let the claim decide eligibility first. The pulse_claims backing trigger
  // remains the final fail-closed authority. Only an otherwise eligible claim
  // can therefore pay the cost of a stale-backing refresh.
  let { data, error } = await admin.rpc("claim_hourly_pulse", { p_user_id: userId });

  // Profiles are normally created by the auth.users trigger. Keep a bounded
  // self-heal only for legacy/exceptional rows instead of writing on every claim.
  if (!error && (data as { status?: string } | null)?.status === "unknown_user") {
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
    if (profileError) return dashboardRedirect(request, "failed");

    ({ data, error } = await admin.rpc("claim_hourly_pulse", { p_user_id: userId }));
  }

  if (
    error
    && String(error.message ?? "").includes("pulse_backing_guard:backing_refresh_required")
  ) {
    const backing = await ensureFreshTreasuryBacking("launch", admin);
    if (backing === "backing_refreshing") return dashboardRedirect(request, "backing-refreshing");
    if (backing === "backing_insufficient") return dashboardRedirect(request, "budget-paused");
    if (backing !== "backing_ready") return dashboardRedirect(request, "budget-paused");

    // One bounded retry after authoritative backing refresh. The DB trigger
    // still revalidates backing during the retried insert.
    ({ data, error } = await admin.rpc("claim_hourly_pulse", { p_user_id: userId }));
  }

  if (error) {
    if (String(error.message ?? "").includes("pulse_backing_guard:")) {
      return dashboardRedirect(request, "budget-paused");
    }
    return dashboardRedirect(request, "failed");
  }

  const result = (data ?? {}) as { status?: string };
  if (result.status === "claimed") return claimReceiptRedirect(request, userId);
  if (result.status === "claim_in_progress") return dashboardRedirect(request, "claim-in-progress");
  if (result.status === "public_fair_share_required") return dashboardRedirect(request, "budget-paused");
  if (result.status === "not_ready") return dashboardRedirect(request, "not-ready");
  if (result.status === "risk_hold") return dashboardRedirect(request, "trust-review");
  if (["pilot_restricted", "treasury_closed", "treasury_missing", "budget_disabled", "insufficient_treasury", "daily_budget_exhausted", "user_daily_limit"].includes(result.status ?? "")) {
    return dashboardRedirect(request, "budget-paused");
  }

  return dashboardRedirect(request, "failed");
}
