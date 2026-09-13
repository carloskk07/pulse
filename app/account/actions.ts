"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateHandle(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/account?state=unavailable");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/account");

  const handle = String(formData.get("handle") ?? "").trim();
  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(handle)) redirect("/account?state=invalid-handle");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/account?state=unavailable");
  const { error } = await admin.from("profiles").update({ handle, updated_at: new Date().toISOString() }).eq("id", user.id);
  redirect(error ? "/account?state=handle-unavailable" : "/account?state=profile-updated");
}
