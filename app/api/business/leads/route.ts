import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const OBJECTIVES = new Set(["app_install", "registration", "trial", "purchase", "survey", "custom"]);
const BUDGETS = new Set(["pilot_100_500", "growth_500_2500", "scale_2500_10000", "enterprise_10000_plus", "not_sure"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSITIVE_INTEGER_RE = /^\d+$/;

function businessRedirect(request: NextRequest, state: string) {
  return NextResponse.redirect(new URL(`/business?lead=${encodeURIComponent(state)}#pilot`, request.url), 303);
}

function text(form: FormData, key: string, max: number) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

function normalizeWebsite(raw: string) {
  if (!raw) return null;
  try {
    const value = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString().slice(0, 500);
  } catch {
    return null;
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const verification = await verifyTurnstile(String(form.get("cf-turnstile-response") ?? ""), ip, { expectedAction: "business_lead" });
  if (!verification.success) return businessRedirect(request, verification.missingConfig ? "verification-not-configured" : "verification-failed");

  const company = text(form, "company", 120);
  const contactName = text(form, "contact_name", 120);
  const email = text(form, "work_email", 254).toLowerCase();
  const websiteRaw = text(form, "website", 500);
  const website = normalizeWebsite(websiteRaw);
  const objective = text(form, "objective", 40);
  const budgetRange = text(form, "budget_range", 40);
  const targetCountries = text(form, "target_countries", 300);
  const message = text(form, "message", 3000);
  const estimatedActionsRaw = text(form, "estimated_actions", 12);
  const estimatedActions = estimatedActionsRaw && POSITIVE_INTEGER_RE.test(estimatedActionsRaw)
    ? Number(estimatedActionsRaw)
    : null;

  if (company.length < 2 || contactName.length < 2 || !EMAIL_RE.test(email)) return businessRedirect(request, "invalid");
  if (!OBJECTIVES.has(objective) || !BUDGETS.has(budgetRange)) return businessRedirect(request, "invalid");
  if (websiteRaw && !website) return businessRedirect(request, "invalid");
  if (estimatedActionsRaw && estimatedActions == null) return businessRedirect(request, "invalid");
  if (estimatedActions != null && (!Number.isSafeInteger(estimatedActions) || estimatedActions <= 0 || estimatedActions > 10_000_000)) return businessRedirect(request, "invalid");

  const admin = createSupabaseAdminClient();
  if (!admin) return businessRedirect(request, "service-unavailable");

  const day = new Date().toISOString().slice(0, 10);
  const dedupeKey = sha256(`${day}|${email}|${company.toLowerCase()}`);
  const secretSalt = process.env.TURNSTILE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "pulse-business";
  const ipHash = ip ? sha256(`${secretSalt}|${ip}`) : null;

  const { error } = await admin.from("business_leads").upsert({
    company,
    contact_name: contactName,
    work_email: email,
    website,
    objective,
    budget_range: budgetRange,
    target_countries: targetCountries,
    estimated_actions: estimatedActions,
    message,
    status: "new",
    source: "business_page",
    dedupe_key: dedupeKey,
    ip_hash: ipHash,
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });

  if (error) return businessRedirect(request, "failed");
  return businessRedirect(request, "received");
}
