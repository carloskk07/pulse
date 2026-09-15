"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RECOVERY_CONTEXT_LEGACY,
  PASSWORD_RECOVERY_CONTEXT_OTP,
  PASSWORD_RECOVERY_CONTEXT_PKCE,
  PASSWORD_RECOVERY_COOKIE,
  safeAuthNext,
  validNewPassword,
} from "@/lib/auth-security";
import {
  armPasswordRecoveryProofChallenge,
  finalizePasswordRecoveryProof,
  hasRecentRecoverySend,
} from "@/lib/auth-recovery-proof";
import { bindReferralForUser, cleanReferralCode } from "@/lib/referrals";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

function safeNext(value: FormDataEntryValue | null) {
  return safeAuthNext(typeof value === "string" ? value : null);
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
  if (error) {
    const code = "code" in error ? String(error.code ?? "") : "";
    redirect(authError(code === "weak_password" ? "password-upgrade-required" : "invalid-credentials", next, ref));
  }
  if (data.user) {
    await finalizePasswordRecoveryProof(data.user.id);
    if (ref) await bindReferralForUser(data.user.id, ref);
  }
  redirect(next);
}

export async function signUp(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const next = safeNext(formData.get("next"));
  const ref = cleanReferralCode(formData.get("ref"));
  if (!supabase) redirect(authError("service-not-configured", next, ref));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !validNewPassword(password)) redirect(authError("invalid-signup", next, ref));
  const requestHeaders = await headers();
  const ip = requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip, { expectedAction: "signup" });
  if (!verification.success) redirect(authError(turnstileAuthError(verification), next, ref));
  await recordReleaseEvidence("turnstile");
  const callback = new URL("/auth/callback", getCanonicalSiteUrl());
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
  if (!supabase) redirect("/auth/recover?error=service-not-configured");

  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/auth/recover?error=missing-email");

  const requestHeaders = await headers();
  const ip = requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verification = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip, { expectedAction: "password_recovery" });
  if (!verification.success) redirect(`/auth/recover?error=${encodeURIComponent(turnstileAuthError(verification))}`);
  await recordReleaseEvidence("turnstile");

  const callback = new URL("/auth/callback", getCanonicalSiteUrl());
  callback.searchParams.set("flow", "recovery");
  callback.searchParams.set("next", "/auth/update-password");

  // Intentionally return the same result whether or not the address exists.
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
  redirect("/auth/recover?message=check-email");
}

export async function updateRecoveredPassword(formData: FormData) {
  const cookieStore = await cookies();
  const recoveryContext = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value;
  const validRecoveryContexts = new Set([
    PASSWORD_RECOVERY_CONTEXT_LEGACY,
    PASSWORD_RECOVERY_CONTEXT_PKCE,
    PASSWORD_RECOVERY_CONTEXT_OTP,
  ]);
  if (!recoveryContext || !validRecoveryContexts.has(recoveryContext)) redirect("/auth/recover?error=recovery-required");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/auth/update-password?error=service-not-configured");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/recover?error=recovery-required");

  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password !== confirmation) redirect("/auth/update-password?error=password-mismatch");
  if (!validNewPassword(password)) redirect(`/auth/update-password?error=password-policy&min=${MIN_PASSWORD_LENGTH}`);

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/auth/update-password?error=password-update-failed");

  if (recoveryContext === PASSWORD_RECOVERY_CONTEXT_OTP) {
    await armPasswordRecoveryProofChallenge(user.id, "otp");
  } else if (recoveryContext === PASSWORD_RECOVERY_CONTEXT_PKCE) {
    const recoverySentAt = "recovery_sent_at" in user ? String(user.recovery_sent_at ?? "") : null;
    if (hasRecentRecoverySend(recoverySentAt)) {
      await armPasswordRecoveryProofChallenge(user.id, "pkce");
    }
  }

  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  redirect("/dashboard?security=password-updated");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
