"use server";

import { redirect } from "next/navigation";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFaucetPayReadOnlyPreflight } from "@/providers/faucetpay-readonly";

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function resultUrl(code: string) {
  return `/admin/faucetpay?proof=${encodeURIComponent(code)}`;
}

export async function verifyAndRecordFaucetPayReadProof() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(resultUrl("auth-unavailable"));

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/faucetpay");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) redirect("/dashboard");

  const probe = await getFaucetPayReadOnlyPreflight();
  if (probe.state !== "READ_ONLY_VERIFIED") {
    redirect(resultUrl(probe.state.toLowerCase()));
  }

  const recorded = await recordReleaseEvidence("faucetpay_read");
  redirect(resultUrl(recorded ? "recorded" : "record-failed"));
}
