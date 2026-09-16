import { PASSWORD_RECOVERY_MAX_AGE_SECONDS } from "@/lib/auth-security";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PasswordRecoveryProofSource = "otp" | "pkce";

const RECOVERY_SENT_CLOCK_SKEW_SECONDS = 5 * 60;
const PROOF_CHALLENGE_MAX_AGE_MS = 60 * 60 * 1000;

export function hasRecentRecoverySend(recoverySentAt: string | null | undefined, now = Date.now()) {
  if (!recoverySentAt) return false;
  const sentAt = Date.parse(recoverySentAt);
  if (!Number.isFinite(sentAt)) return false;
  const age = now - sentAt;
  const maxAge = (PASSWORD_RECOVERY_MAX_AGE_SECONDS + RECOVERY_SENT_CLOCK_SKEW_SECONDS) * 1000;
  return age >= 0 && age <= maxAge;
}

export async function beginPasswordRecoveryProofChallenge(userId: string, source: PasswordRecoveryProofSource) {
  const admin = createSupabaseAdminClient();
  if (!admin || !userId) return false;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PROOF_CHALLENGE_MAX_AGE_MS);
  const { error } = await admin.from("auth_recovery_proof_challenges").upsert({
    user_id: userId,
    source,
    armed_at: now.toISOString(),
    password_updated_at: null,
    expires_at: expiresAt.toISOString(),
  });

  return !error;
}

export async function markPasswordRecoveryPasswordUpdated(userId: string, source: PasswordRecoveryProofSource) {
  const admin = createSupabaseAdminClient();
  if (!admin || !userId) return false;

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("auth_recovery_proof_challenges")
    .update({ password_updated_at: now })
    .eq("user_id", userId)
    .eq("source", source)
    .is("password_updated_at", null)
    .gt("expires_at", now)
    .select("user_id")
    .maybeSingle();

  return !error && Boolean(data?.user_id);
}

export async function finalizePasswordRecoveryProof(userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin || !userId) return false;

  const { data, error } = await admin
    .from("auth_recovery_proof_challenges")
    .select("user_id,password_updated_at,expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (
    error
    || !data
    || !data.password_updated_at
    || Date.parse(data.password_updated_at) > Date.now()
    || Date.parse(data.expires_at) <= Date.now()
  ) return false;

  const recorded = await recordReleaseEvidence("password_recovery");
  if (!recorded) return false;

  await admin.from("auth_recovery_proof_challenges").delete().eq("user_id", userId);
  return true;
}
