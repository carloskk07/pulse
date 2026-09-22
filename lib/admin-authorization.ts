import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminAccess =
  | { status: "authorized"; user: User }
  | { status: "forbidden"; user: User }
  | { status: "unauthenticated" | "unavailable"; user: null };

export async function getAdminAccess(): Promise<AdminAccess> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { status: "unavailable", user: null };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { status: "unauthenticated", user: null };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { status: "unavailable", user: null };
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
    return { status: "unavailable", user: null };
  }

  if (!allowlisted) {
    return { status: "forbidden", user };
  }

  return { status: "authorized", user };
}
