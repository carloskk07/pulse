import { NextRequest, NextResponse } from "next/server";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function back(request: NextRequest, state: string) {
  return NextResponse.redirect(new URL(`/admin/product?turnstile=${encodeURIComponent(state)}`, request.url), 303);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return back(request, "service-not-configured");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth?next=/admin/product", request.url), 303);
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) return new NextResponse(null, { status: 404 });

  const formData = await request.formData();
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip, { expectedAction: "readiness" });

  if (!verification.success) {
    return back(request, verification.missingConfig ? "not-configured" : "failed");
  }

  await recordReleaseEvidence("turnstile");
  return back(request, "verified");
}
