"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin-authorization";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const STATUSES = new Set(["new","qualified","contacted","pilot","rejected","closed"]);

async function requireAdmin() {
  const access = await getAdminAccess();
  if (access.status === "unavailable") throw new Error("Admin auth unavailable");
  if (access.status !== "authorized") throw new Error("Unauthorized");
}

function leadUrl(state: string) {
  return `/admin/leads?state=${encodeURIComponent(state)}`;
}

function parseOptionalUtc(value: string) {
  if (!value) return null;
  if (!LOCAL_DATETIME_RE.test(value)) return undefined;
  const date = new Date(`${value}:00Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export async function updateBusinessLead(formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) redirect(leadUrl("unavailable"));

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const nextActionAt = parseOptionalUtc(String(formData.get("next_action_at") ?? "").trim());
  const operatorNote = String(formData.get("operator_note") ?? "").trim().slice(0, 2000) || null;

  if (!UUID_RE.test(id) || !STATUSES.has(status) || nextActionAt === undefined) {
    redirect(leadUrl("invalid"));
  }

  const { error } = await admin.from("business_leads").update({
    status,
    next_action_at: nextActionAt,
    operator_note: operatorNote,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) redirect(leadUrl("unavailable"));

  revalidatePath("/admin/leads");
  revalidatePath("/admin/ads");
  redirect(leadUrl("updated"));
}
