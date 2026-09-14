export const PASSWORD_RECOVERY_COOKIE = "pc_password_recovery";
export const PASSWORD_RECOVERY_MAX_AGE_SECONDS = 10 * 60;
export const MIN_PASSWORD_LENGTH = 12;

export function safeAuthNext(value: string | null | undefined, fallback = "/dashboard") {
  const next = value?.trim() || fallback;
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export function validNewPassword(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH;
}
