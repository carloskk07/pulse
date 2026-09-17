import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import {
  cleanReminderId,
  recordAttributedPulseCompletion,
  RETENTION_ATTRIBUTION_COOKIE,
} from "@/lib/retention-attribution";
import { isTrustedSameOriginMutation } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

function dashboardRedirect(request: NextRequest, state: string) {
  return NextResponse.redirect(new URL(`/dashboard?claim=${encodeURIComponent(state)}`, request.url), 303);
}

function revalidateRewardViews() {
  for (const path of ["/dashboard", "/dashboard/claimed", "/wallet", "/progress"]) {
    revalidatePath(path);
  }
}

async function claimReceiptRedirect(request: NextRequest, userId: string) {
  const reminderId = cleanReminderId(request.cookies.get(RETENTION_ATTRIBUTION_COOKIE)?.value);
  if (reminderId) await recordAttributedPulseCompletion(userId, reminderId);

  revalidateRewardViews();
  const response = NextResponse.redirect(new URL("/dashboard/claimed", request.url), 303);
  if (reminderId) {
    response.cookies.set(RETENTION_ATTRIBUTION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) return dashboardRedirect(request, "verification-failed");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return dashboardRedirect(request, "service-not-configured");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth?next=/dashboard", request.url), 303);

  const formData = await request.formData();
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip, { expectedAction: "hourly_pulse" });
  if (!verification.success) return dashboardRedirect(request, verification.missingConfig ? "verification-not-configured" : "verification-failed");

  const admin = createSupabaseAdminClient();
  if (!admin) return dashboardRedirect(request, "service-not-configured");

  await recordReleaseEvidence("turnstile");
  await admin.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  const { data, error } = await admin.rpc("claim_hourly_pulse", { p_user_id: user.id });
  if (error) return dashboardRedirect(request, "failed");

  const result = (data ?? {}) as { status?: string };
  if (result.status === "claimed") return claimReceiptRedirect(request, user.id);
  if (result.status === "not_ready") return dashboardRedirect(request, "not-ready");
  if (result.status === "risk_hold") return dashboardRedirect(request, "trust-review");
  if (["pilot_restricted", "treasury_closed", "treasury_missing", "budget_disabled", "insufficient_treasury", "daily_budget_exhausted", "user_daily_limit"].includes(result.status ?? "")) {
    return dashboardRedirect(request, "budget-paused");
  }

  return dashboardRedirect(request, "failed");
}
