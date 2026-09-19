import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUserIdentity = {
  id: string;
  email?: string;
};

export const getCurrentUserContext = cache(async () => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null as CurrentUserIdentity | null };

  const { data: { claims }, error } = await supabase.auth.getClaims();
  const id = !error && typeof claims?.sub === "string" ? claims.sub : "";
  if (!id) return { supabase, user: null as CurrentUserIdentity | null };

  const email = typeof claims?.email === "string" ? claims.email : undefined;
  return {
    supabase,
    user: {
      id,
      email,
    } satisfies CurrentUserIdentity,
  };
});
