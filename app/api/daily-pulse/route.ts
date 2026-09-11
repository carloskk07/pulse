import { NextRequest, NextResponse } from "next/server";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

function dashboardRedirect(request: NextRequest, state: string) {
  return NextResponse.redirect(new URL(`/dashboard?claim=${encodeURIComponent(state)}`, request.url), 303);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return dashboardRedirect(request, "service-not-configured");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth?next=/dashboard", request.url), 303);

  const formData = await request.formData();
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip, { expectedAction: "daily_pulse" });
  if (!verification.success) return dashboardRedirect(request, verification.missingConfig ? "verification-not-configured" : "verification-failed");

  const admin = createSupabaseAdminClient();
  if (!admin) return dashboardRedirect(request, "service-not-configured");
  await recordReleaseEvidence("turnstile");

  await admin.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
  const { error } = await admin.rpc("claim_daily_pulse", { p_user_id: user.id });

  if (error) {
    if (error.message.includes("DAILY_PULSE_ALREADY_CLAIMED")) return dashboardRedirect(request, "already-claimed");
    return dashboardRedirect(request, "failed");
  }

  return dashboardRedirect(request, "success");
}
