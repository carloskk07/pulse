"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calculateProspectFit, normalizeProspectDomain, normalizeProspectUrl, type ProspectSegment, type ProspectStatus } from "@/lib/outbound-prospects";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEGMENTS = new Set<ProspectSegment>(["mobile_game", "consumer_app", "saas", "research", "other"]);
const STATUSES = new Set<ProspectStatus>(["new", "researching", "ready", "contacted", "replied", "pilot", "rejected", "closed"]);

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

function prospectUrl(state: string) {
  return `/admin/prospects?state=${encodeURIComponent(state)}`;
}

function parseSegment(value: string) {
  return SEGMENTS.has(value as ProspectSegment) ? value as ProspectSegment : null;
}

function parseStatus(value: string) {
  return STATUSES.has(value as ProspectStatus) ? value as ProspectStatus : null;
}

function parseOptionalDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export async function upsertProspect(formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) redirect(prospectUrl("unavailable"));

  const companyName = String(formData.get("companyName") ?? "").trim().slice(0, 160);
  const website = normalizeProspectUrl(String(formData.get("website") ?? ""), 500);
  const sourceUrl = normalizeProspectUrl(String(formData.get("sourceUrl") ?? ""), 1000);
  const domain = website ? normalizeProspectDomain(website) : "";
  const segment = parseSegment(String(formData.get("segment") ?? ""));
  const publicContactEmail = String(formData.get("publicContactEmail") ?? "").trim().toLowerCase().slice(0, 254);

  if (!companyName || !domain || !website || !sourceUrl || !segment) redirect(prospectUrl("invalid"));
  if (publicContactEmail && !EMAIL_RE.test(publicContactEmail)) redirect(prospectUrl("invalid"));

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
    public_contact_email: publicContactEmail || null,
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
  if (error) redirect(prospectUrl("unavailable"));
  revalidatePath("/admin/prospects");
  redirect(prospectUrl("saved"));
}

export async function updateProspectStatus(formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) redirect(prospectUrl("unavailable"));

  const id = String(formData.get("id") ?? "").trim();
  const status = parseStatus(String(formData.get("status") ?? ""));
  const nextActionRaw = String(formData.get("nextActionAt") ?? "").trim();
  const nextActionAt = parseOptionalDate(nextActionRaw);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !status || nextActionAt === undefined) redirect(prospectUrl("invalid"));

  const { error } = await admin.from("advertiser_prospects").update({
    status,
    next_action_at: nextActionAt,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) redirect(prospectUrl("unavailable"));
  revalidatePath("/admin/prospects");
  redirect(prospectUrl("updated"));
}
