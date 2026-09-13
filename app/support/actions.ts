"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

const categories = new Set(["earning", "withdrawal", "account", "privacy", "other"]);

function supportUrl(state: string, id?: string) {
  const params = new URLSearchParams({ state });
  if (id) params.set("case", id);
  return `/support?${params.toString()}`;
}

export async function createSupportCase(formData: FormData) {
  const category = String(formData.get("category") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 120);
  const message = String(formData.get("message") ?? "").trim().slice(0, 4000);
  const suppliedEmail = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 320);

  if (!categories.has(category) || subject.length < 3 || message.length < 10) redirect(supportUrl("invalid"));

  const requestHeaders = await headers();
  const ip = requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip, { expectedAction: "support" });
  if (!verification.success) redirect(supportUrl("verification-failed"));

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const email = (user?.email ?? suppliedEmail).trim().toLowerCase();
  if (!email || !email.includes("@")) redirect(supportUrl("invalid-email"));

  const admin = createSupabaseAdminClient();
  if (!admin) redirect(supportUrl("unavailable"));

  const { data, error } = await admin
    .from("support_cases")
    .insert({ user_id: user?.id ?? null, email, category, subject, message, status: "open" })
    .select("id")
    .single();

  if (error || !data?.id) redirect(supportUrl("unavailable"));
  redirect(supportUrl("created", String(data.id).split("-")[0]));
}
