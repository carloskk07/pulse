import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

export async function hasWithdrawalPilotAccess(
  userId: string | null | undefined,
  adminClient?: AdminClient,
) {
  if (!userId) return false;
  const admin = adminClient ?? createSupabaseAdminClient();
  if (!admin) return false;

  const { data, error } = await admin.rpc("withdrawal_pilot_allowed", {
    p_user_id: userId,
  });

  return !error && data === true;
}
