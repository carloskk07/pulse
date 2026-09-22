"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin-authorization";

const statuses = new Set(["open", "in_review", "resolved", "closed"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateSupportCase(formData: FormData) {
  const access = await getAdminAccess();
  if (access.status === "unauthenticated") redirect("/auth?next=/admin/support");
  if (access.status === "unavailable") redirect("/admin/support?state=unavailable");
  if (access.status !== "authorized") redirect("/dashboard");

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!UUID_RE.test(id) || !statuses.has(status)) redirect("/admin/support?state=invalid");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/support?state=unavailable");
  const { error } = await admin.from("support_cases").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  redirect(error ? "/admin/support?state=unavailable" : "/admin/support?state=updated");
}
