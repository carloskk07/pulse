import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const REFERRAL_CODE = /^[a-f0-9]{16}$/i;

export function cleanReferralCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase();
  return REFERRAL_CODE.test(code) ? code : null;
}

export async function bindReferralForUser(userId: string, rawCode: unknown) {
  const code = cleanReferralCode(rawCode);
  if (!code) return { status: "no_code" };

  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "service_not_configured" };

  const { data, error } = await admin.rpc("bind_referral", {
    p_invitee_id: userId,
    p_referral_code: code,
  });

  if (error) return { status: "error" };
  return (data ?? { status: "unknown" }) as { status?: string };
}
