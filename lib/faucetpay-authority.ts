import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function hasCurrentFaucetPayEvidence(
  kind: "faucetpay_read" | "faucetpay_send_scope",
  admin: ReturnType<typeof createSupabaseAdminClient> = createSupabaseAdminClient(),
) {
  if (!admin) return false;
  const { data, error } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "release_external_proof")
    .maybeSingle();
  return !error && releaseEvidenceMatches(data?.value, kind);
}

export async function hasCurrentFaucetPayReadProof(
  admin: ReturnType<typeof createSupabaseAdminClient> = createSupabaseAdminClient(),
) {
  return hasCurrentFaucetPayEvidence("faucetpay_read", admin);
}

export async function hasCurrentFaucetPaySendScopeProof(
  admin: ReturnType<typeof createSupabaseAdminClient> = createSupabaseAdminClient(),
) {
  return hasCurrentFaucetPayEvidence("faucetpay_send_scope", admin);
}
