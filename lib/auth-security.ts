export const PASSWORD_RECOVERY_COOKIE = "pc_password_recovery";
export const PASSWORD_RECOVERY_MAX_AGE_SECONDS = 10 * 60;
export const PASSWORD_RECOVERY_CONTEXT_LEGACY = "1";
export const PASSWORD_RECOVERY_CONTEXT_PKCE = "pkce";
export const PASSWORD_RECOVERY_CONTEXT_OTP = "otp";
export const MIN_PASSWORD_LENGTH = 12;

const AUTH_REDIRECT_BASE = "https://pulsercuit.invalid";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function normalizeInternalPath(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return null;
  if (candidate.includes("\\") || CONTROL_CHARACTERS.test(candidate)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return null;
  }

  if (decoded.startsWith("//") || decoded.includes("\\") || CONTROL_CHARACTERS.test(decoded)) return null;

  try {
    const resolved = new URL(candidate, AUTH_REDIRECT_BASE);
    if (resolved.origin !== AUTH_REDIRECT_BASE) return null;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

export function safeAuthNext(value: string | null | undefined, fallback = "/dashboard") {
  return normalizeInternalPath(value) ?? normalizeInternalPath(fallback) ?? "/dashboard";
}

export function validNewPassword(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export function recoveryCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: PASSWORD_RECOVERY_MAX_AGE_SECONDS,
  };
}
