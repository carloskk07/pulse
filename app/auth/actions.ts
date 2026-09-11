"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/dashboard";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function authError(code: string, next: string) {
  return `/auth?error=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
}

export async function signIn(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const next = safeNext(formData.get("next"));
  if (!supabase) redirect(authError("service-not-configured", next));

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect(authError("missing-credentials", next));

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(authError("invalid-credentials", next));

  redirect(next);
}

export async function signUp(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const next = safeNext(formData.get("next"));
  if (!supabase) redirect(authError("service-not-configured", next));

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) redirect(authError("invalid-signup", next));

  const requestHeaders = await headers();
  const ip = requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip);
  if (!verification.success) redirect(authError(verification.missingConfig ? "verification-not-configured" : "verification-failed", next));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error) redirect(authError("signup-failed", next));
  if (data.session) redirect(next);

  redirect(`/auth?message=check-email&next=${encodeURIComponent(next)}`);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
