"use server";

import { redirect } from "next/navigation";
import { probePwnedPasswordProtection } from "@/lib/pwned-passwords";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/auth?next=/admin/product");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/product");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) redirect("/dashboard");
}

export async function verifyPasswordBreachProtection() {
  await requireAdmin();

  const live = await probePwnedPasswordProtection();
  if (!live) redirect("/admin/product?security=breach-probe-unavailable");

  const recorded = await recordReleaseEvidence("supabase_auth_hardening");
  redirect(`/admin/product?security=${recorded ? "breach-protection-proven" : "breach-proof-record-failed"}`);
}
