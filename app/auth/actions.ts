"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  isPasswordRecoveryContext,
  MIN_PASSWORD_LENGTH,
  PASSWORD_RECOVERY_CONTEXT_OTP,
  PASSWORD_RECOVERY_CONTEXT_PKCE,
  PASSWORD_RECOVERY_COOKIE,
  safeAuthNext,
  validNewPassword,
} from "@/lib/auth-security";
import {
  finalizePasswordRecoveryProof,
  markPasswordRecoveryPasswordUpdated,
} from "@/lib/auth-recovery-proof";
import {
  cleanMarketingSessionId,
  createMarketingSessionId,
  MARKETING_SESSION_COOKIE,
  MARKETING_SESSION_MAX_AGE_SECONDS,
  recordMarketingEvent,
} from "@/lib/marketing-funnel";
import { checkPasswordBreach } from "@/lib/pwned-passwords";
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

function isAuthRateLimited(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const authError = error as { code?: unknown; status?: unknown };
  const code = String(authError.code ?? "");
  if (Number(authError.status ?? 0) === 429) return true;
  return new Set([
    "over_request_rate_limit",
    "over_email_send_rate_limit",
    "over_sms_send_rate_limit",
  ]).has(code);
}

async function requestIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
}

async function requireTurnstile(formData: FormData, expectedAction: string) {
  const verification = await verifyTurnstile(
    String(formData.get("cf-turnstile-response") ?? ""),
    await requestIp(),
    { expectedAction },
  );
  return verification;
}

async function recordSuccessfulSignup() {
  try {
    const cookieStore = await cookies();
    let sessionId = cleanMarketingSessionId(cookieStore.get(MARKETING_SESSION_COOKIE)?.value);
    if (!sessionId) {
      sessionId = createMarketingSessionId();
      cookieStore.set(MARKETING_SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: MARKETING_SESSION_MAX_AGE_SECONDS,
      });
    }
    await recordMarketingEvent(sessionId, "signup_created");
  } catch {
    console.warn("PULSECIRCUIT_SIGNUP_MARKETING_EVENT_FAILED");
  }
}

export async function signIn(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const next = safeNext(formData.get("next"));
  const ref = cleanReferralCode(formData.get("ref"));
  if (!supabase) redirect(authError("service-not-configured", next, ref));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect(authError("missing-credentials", next, ref));
  const verification = await requireTurnstile(formData, "signin");
  if (!verification.success) redirect(authError(turnstileAuthError(verification), next, ref));
  await recordReleaseEvidence("turnstile");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (isAuthRateLimited(error)) redirect(authError("auth-rate-limited", next, ref));
    const code = "code" in error ? String(error.code ?? "") : "";
    redirect(authError(code === "weak_password" ? "password-upgrade-required" : "invalid-credentials", next, ref));
  }

  const breach = await checkPasswordBreach(password);
  if (breach.state === "compromised") {
    await supabase.auth.signOut();
    redirect(authError("password-upgrade-required", next, ref));
  }
  if (breach.state === "safe") {
    await recordReleaseEvidence("supabase_auth_hardening");
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
  const verification = await requireTurnstile(formData, "signup");
  if (!verification.success) redirect(authError(turnstileAuthError(verification), next, ref));

  const breach = await checkPasswordBreach(password);
  if (breach.state === "compromised") redirect(authError("password-compromised", next, ref));
  if (breach.state === "unavailable") redirect(authError("password-security-unavailable", next, ref));

  await recordReleaseEvidence("turnstile");
  await recordReleaseEvidence("supabase_auth_hardening");
  const callback = new URL("/auth/callback", getCanonicalSiteUrl());
  callback.searchParams.set("next", next);
  if (ref) callback.searchParams.set("ref", ref);
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback.toString() } });
  if (error) {
    if (isAuthRateLimited(error)) redirect(authError("auth-rate-limited", next, ref));
    redirect(authError("signup-failed", next, ref));
  }
  if (data.user) await recordSuccessfulSignup();
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

  const verification = await requireTurnstile(formData, "password_recovery");
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
  if (!isPasswordRecoveryContext(recoveryContext)) redirect("/auth/recover?error=recovery-required");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/auth/update-password?error=service-not-configured");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/recover?error=recovery-required");

  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password !== confirmation) redirect("/auth/update-password?error=password-mismatch");
  if (!validNewPassword(password)) redirect(`/auth/update-password?error=password-policy&min=${MIN_PASSWORD_LENGTH}`);

  const breach = await checkPasswordBreach(password);
  if (breach.state === "compromised") redirect("/auth/update-password?error=password-compromised");
  if (breach.state === "unavailable") redirect("/auth/update-password?error=password-security-unavailable");
  await recordReleaseEvidence("supabase_auth_hardening");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/auth/update-password?error=password-update-failed");

  if (recoveryContext === PASSWORD_RECOVERY_CONTEXT_OTP) {
    await markPasswordRecoveryPasswordUpdated(user.id, "otp");
  } else if (recoveryContext === PASSWORD_RECOVERY_CONTEXT_PKCE) {
    await markPasswordRecoveryPasswordUpdated(user.id, "pkce");
  }

  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  // A recovery session proves control of the email link, not that the new
  // password can authenticate independently. End the recovery session and
  // require one normal password sign-in; signIn() will finalize the proof.
  await supabase.auth.signOut();
  redirect("/auth?message=password-updated&next=/dashboard");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
