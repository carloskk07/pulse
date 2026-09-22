import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminAccess =
  | { status: "authorized"; user: User }
  | { status: "forbidden"; user: User }
  | { status: "unauthenticated" | "unavailable"; user: null };

export type AdminAllowlistStatus = "authorized" | "forbidden" | "unavailable";

export const getAdminAllowlistStatus = cache(async (
  userId: string | null | undefined,
): Promise<AdminAllowlistStatus> => {
  const normalizedUserId = userId?.trim();
  if (!normalizedUserId) return "forbidden";

  const admin = createSupabaseAdminClient();
  if (!admin) return "unavailable";

  const { data: allowlisted, error: allowlistError } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", normalizedUserId)
    .maybeSingle();

  if (allowlistError) {
    console.error("PULSECIRCUIT_ADMIN_AUTHORITY_LOOKUP_FAILED", {
      code: allowlistError.code || "unknown",
    });
    return "unavailable";
  }

  return allowlisted ? "authorized" : "forbidden";
});

export async function getAdminAccess(): Promise<AdminAccess> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { status: "unavailable", user: null };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { status: "unauthenticated", user: null };
  }

  const allowlistStatus = await getAdminAllowlistStatus(user.id);
  if (allowlistStatus === "unavailable") {
    return { status: "unavailable", user: null };
  }
  if (allowlistStatus === "forbidden") {
    return { status: "forbidden", user };
  }

  return { status: "authorized", user };
}
