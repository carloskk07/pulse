import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminAccessStatus = "authorized" | "unauthenticated" | "forbidden" | "unavailable";

export async function getAdminAccess() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { status: "unavailable" as AdminAccessStatus, user: null };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { status: "unauthenticated" as AdminAccessStatus, user: null };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { status: "unavailable" as AdminAccessStatus, user: null };
  }

  const { data: allowlisted, error: allowlistError } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (allowlistError) {
    console.error("PULSECIRCUIT_ADMIN_AUTHORITY_LOOKUP_FAILED", {
      code: allowlistError.code || "unknown",
    });
    return { status: "unavailable" as AdminAccessStatus, user: null };
  }

  if (!allowlisted) {
    return { status: "forbidden" as AdminAccessStatus, user };
  }

  return { status: "authorized" as AdminAccessStatus, user };
}
