"use server";

import { revalidatePath } from "next/cache";
import { calculateProspectFit, normalizeProspectDomain, type ProspectSegment, type ProspectStatus } from "@/lib/outbound-prospects";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Admin auth unavailable");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !adminEmails().has(user.email.toLowerCase())) throw new Error("Unauthorized");
  return user;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function safeSegment(value: string): ProspectSegment {
  return value === "mobile_game" || value === "consumer_app" || value === "saas" || value === "research" ? value : "other";
}

function safeStatus(value: string): ProspectStatus {
  return value === "researching" || value === "ready" || value === "contacted" || value === "replied" || value === "pilot" || value === "rejected" || value === "closed" ? value : "new";
}

export async function upsertProspect(formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Admin database unavailable");

  const companyName = String(formData.get("companyName") ?? "").trim().slice(0, 160);
  const website = String(formData.get("website") ?? "").trim().slice(0, 500);
  const sourceUrl = String(formData.get("sourceUrl") ?? website).trim().slice(0, 1000);
  const domain = normalizeProspectDomain(website || sourceUrl);
  if (!companyName || !domain || !website || !sourceUrl) throw new Error("Missing prospect identity");

  const segment = safeSegment(String(formData.get("segment") ?? "other"));
  const signals = {
    segment,
    liveProduct: checked(formData, "liveProduct"),
    measurableEvent: checked(formData, "measurableEvent"),
    publicContact: checked(formData, "publicContact"),
    paidUaSignal: checked(formData, "paidUaSignal"),
    growthWindow: checked(formData, "growthWindow"),
  };
  const fitScore = calculateProspectFit(signals);

  const payload = {
    company_name: companyName,
    domain,
    website,
    segment,
    country: String(formData.get("country") ?? "").trim().slice(0, 100) || null,
    public_contact_email: String(formData.get("publicContactEmail") ?? "").trim().toLowerCase().slice(0, 254) || null,
    source_url: sourceUrl,
    fit_score: fitScore,
    live_product: signals.liveProduct,
    measurable_event: signals.measurableEvent,
    public_contact: signals.publicContact,
    paid_ua_signal: signals.paidUaSignal,
    growth_window: signals.growthWindow,
    suggested_pilot: String(formData.get("suggestedPilot") ?? "").trim().slice(0, 500) || null,
    notes: String(formData.get("notes") ?? "").trim().slice(0, 2000) || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("advertiser_prospects").upsert(payload, { onConflict: "domain" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/prospects");
}

export async function updateProspectStatus(formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Admin database unavailable");

  const id = String(formData.get("id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid prospect");
  const status = safeStatus(String(formData.get("status") ?? "new"));
  const nextActionRaw = String(formData.get("nextActionAt") ?? "").trim();
  const nextActionAt = nextActionRaw ? new Date(nextActionRaw).toISOString() : null;

  const { error } = await admin.from("advertiser_prospects").update({
    status,
    next_action_at: nextActionAt,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/prospects");
}
