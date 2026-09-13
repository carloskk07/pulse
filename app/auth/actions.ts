"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { bindReferralForUser, cleanReferralCode } from "@/lib/referrals";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/dashboard";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function authError(code: string, next: string, ref?: string | null) {
  const params = new URLSearchParams({ error: code, next });
  if (ref) params.set("ref", ref);
  return `/auth?${params.toString()}`;
}

function turnstileAuthError(verification: Awaited<ReturnType<typeof verifyTurnstile>>) {
  if (verification.missingConfig) return "verification-not-configured";
  const codes = new Set(verification.errorCodes ?? []);
  if (codes.has("missing-token") || codes.has("missing-input-response")) return "verification-token-missing";
  if (codes.has("timeout-or-duplicate")) return "verification-expired";
  if (codes.has("invalid-input-secret") || codes.has("missing-input-secret")) return "verification-key-mismatch";
  if (codes.has("hostname-mismatch")) return "verification-hostname";
  if (codes.has("action-mismatch")) return "verification-action";
  if (codes.has("verification-unavailable") || codes.has("internal-error")) return "verification-unavailable";
  if (codes.has("invalid-input-response") || codes.has("bad-request")) return "verification-token-invalid";
  return "verification-failed";
}

export async function signIn(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const next = safeNext(formData.get("next"));
  const ref = cleanReferralCode(formData.get("ref"));
  if (!supabase) redirect(authError("service-not-configured", next, ref));

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect(authError("missing-credentials", next, ref));

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(authError("invalid-credentials", next, ref));
  if (data.user && ref) await bindReferralForUser(data.user.id, ref);
  redirect(next);
}

export async function signUp(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const next = safeNext(formData.get("next"));
  const ref = cleanReferralCode(formData.get("ref"));
  if (!supabase) redirect(authError("service-not-configured", next, ref));

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) redirect(authError("invalid-signup", next, ref));

  const requestHeaders = await headers();
  const ip = requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip, { expectedAction: "signup" });
  if (!verification.success) redirect(authError(turnstileAuthError(verification), next, ref));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callback = new URL("/auth/callback", siteUrl);
  callback.searchParams.set("next", next);
  if (ref) callback.searchParams.set("ref", ref);

  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback.toString() } });
  if (error) redirect(authError("signup-failed", next, ref));
  if (data.session && data.user) {
    if (ref) await bindReferralForUser(data.user.id, ref);
    redirect(next);
  }

  const params = new URLSearchParams({ message: "check-email", next });
  if (ref) params.set("ref", ref);
  redirect(`/auth?${params.toString()}`);
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/auth?error=service-not-configured");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) redirect("/auth?error=invalid-recovery-email");

  const requestHeaders = await headers();
  const ip = requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip, { expectedAction: "password_reset" });
  if (!verification.success) redirect("/auth?error=verification-failed");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callback = new URL("/auth/callback", siteUrl);
  callback.searchParams.set("next", "/account?reset=1");
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
  redirect("/auth?message=recovery-sent");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
