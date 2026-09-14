import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function hasCurrentFaucetPayReadProof(
  admin: ReturnType<typeof createSupabaseAdminClient> = createSupabaseAdminClient(),
) {
  if (!admin) return false;
  const { data, error } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "release_external_proof")
    .maybeSingle();
  return !error && releaseEvidenceMatches(data?.value, "faucetpay_read");
}
