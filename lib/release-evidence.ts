import { createHash } from "node:crypto";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const FAUCETPAY_READ_PROOF_SCHEMA = "faucetpay-read-proof-v2";
const SUPABASE_AUTH_HARDENING_PROOF_SCHEMA = "supabase-auth-hardening-proof-v1";
const PASSWORD_RECOVERY_PROOF_SCHEMA = "password-recovery-proof-v1";

export type ReleaseEvidenceKind =
  | "turnstile"
  | "ayet_transport"
  | "ayet_callback"
  | "faucetpay_read"
  | "faucetpay_payout"
  | "supabase_auth_hardening"
  | "password_recovery";

function configuredValues(kind: ReleaseEvidenceKind) {
  if (kind === "turnstile") {
    return [
      process.env.TURNSTILE_SECRET_KEY,
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.TURNSTILE_ALLOWED_HOSTNAMES?.trim() || "auto",
    ];
  }
  if (kind === "ayet_transport" || kind === "ayet_callback") {
    return [process.env.AYET_API_KEY, process.env.AYET_ADSLOT_ID, process.env.AYET_REWARD_SHARE_BPS ?? "7000"];
  }
  if (kind === "faucetpay_read") {
    return [
      FAUCETPAY_READ_PROOF_SCHEMA,
      process.env.FAUCETPAY_READ_KEY,
      process.env.FAUCETPAY_PAYOUT_CURRENCY ?? "USDT",
      process.env.FAUCETPAY_PAYOUT_CREDITS,
      process.env.FAUCETPAY_PAYOUT_UNITS,
      process.env.FAUCETPAY_PAYOUT_LABEL,
    ];
  }
  if (kind === "supabase_auth_hardening") {
    return [
      SUPABASE_AUTH_HARDENING_PROOF_SCHEMA,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ];
  }
  if (kind === "password_recovery") {
    return [
      PASSWORD_RECOVERY_PROOF_SCHEMA,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
      String(MIN_PASSWORD_LENGTH),
    ];
  }
  return [
    process.env.FAUCETPAY_SCOPED_KEY,
    process.env.FAUCETPAY_PAYOUT_CURRENCY ?? "USDT",
    process.env.FAUCETPAY_PAYOUT_CREDITS,
    process.env.FAUCETPAY_PAYOUT_UNITS,
    process.env.FAUCETPAY_PAYOUT_LABEL,
  ];
}

export function getReleaseEvidenceFingerprint(kind: ReleaseEvidenceKind) {
  const values = configuredValues(kind).map((value) => value?.trim() ?? "");
  if (values.some((value) => !value)) return null;
  return createHash("sha256").update(JSON.stringify([kind, ...values])).digest("hex");
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function releaseEvidenceMatches(value: unknown, kind: ReleaseEvidenceKind) {
  const expected = getReleaseEvidenceFingerprint(kind);
  if (!expected) return false;
  const evidence = objectValue(objectValue(value)[kind]);
  return evidence.fingerprint === expected && typeof evidence.verified_at === "string" && evidence.verified_at.length > 0;
}

export async function recordReleaseEvidence(kind: ReleaseEvidenceKind) {
  const fingerprint = getReleaseEvidenceFingerprint(kind);
  const admin = createSupabaseAdminClient();
  if (!fingerprint || !admin) return false;

  const { data, error } = await admin.rpc("record_release_evidence", {
    p_kind: kind,
    p_fingerprint: fingerprint,
  });

  return !error && data === true;
}
