import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isTrustedSameOriginMutation, readUrlEncodedFormWithLimit } from "@/lib/request-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const GOALS = new Set(["traffic", "verified_action", "not_sure"]);
const BUDGETS = new Set(["traffic_5_25", "traffic_25_100", "pilot_100_500", "not_sure"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function redirectState(request: NextRequest, state: string) {
  return NextResponse.redirect(new URL(`/advertise?interest=${encodeURIComponent(state)}#launch-interest`, request.url), 303);
}

function cleanText(form: URLSearchParams, key: string, max: number) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

function normalizeWebsite(raw: string) {
  try {
    const value = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    return url.toString().slice(0, 500);
  } catch {
    return null;
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) return redirectState(request, "verification-failed");

  const form = await readUrlEncodedFormWithLimit(request, 16_384);
  if (!form) return redirectState(request, "invalid");
  const ip = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? null;

  const verification = await verifyTurnstile(
    String(form.get("cf-turnstile-response") ?? ""),
    ip,
    { expectedAction: "pulse_ads_interest" },
  );

  if (!verification.success) {
    return redirectState(request, verification.missingConfig ? "verification-unavailable" : "verification-failed");
  }

  const company = cleanText(form, "company", 120);
  const contactName = cleanText(form, "contact_name", 120);
  const workEmail = cleanText(form, "work_email", 254).toLowerCase();
  const websiteRaw = cleanText(form, "website", 500);
  const website = websiteRaw ? normalizeWebsite(websiteRaw) : null;
  const goal = cleanText(form, "goal", 40);
  const budgetRange = cleanText(form, "budget_range", 40);
  const targetCountries = cleanText(form, "target_countries", 300);
  const message = cleanText(form, "message", 3000);

  if (
    company.length < 2
    || contactName.length < 2
    || !EMAIL_RE.test(workEmail)
    || !website
    || !GOALS.has(goal)
    || !BUDGETS.has(budgetRange)
  ) {
    return redirectState(request, "invalid");
  }

  const productInterest = goal === "traffic"
    ? "pulse_ads"
    : goal === "verified_action"
      ? "pulse_direct"
      : "not_sure";
  const objective = goal === "traffic" ? "website_traffic" : "custom";

  const admin = createSupabaseAdminClient();
  if (!admin) return redirectState(request, "service-unavailable");

  const day = new Date().toISOString().slice(0, 10);
  const dedupeKey = sha256(`${day}|advertise_interest|${workEmail}|${company.toLowerCase()}`);
  const secretSalt = process.env.TURNSTILE_SECRET_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? "pulse-advertise";
  const ipHash = ip ? sha256(`${secretSalt}|${ip}`) : null;

  const { error } = await admin.from("business_leads").upsert({
    company,
    contact_name: contactName,
    work_email: workEmail,
    website,
    objective,
    budget_range: budgetRange,
    target_countries: targetCountries,
    estimated_actions: null,
    message,
    product_interest: productInterest,
    status: "new",
    source: "advertise_interest",
    dedupe_key: dedupeKey,
    ip_hash: ipHash,
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });

  if (error) return redirectState(request, "failed");
  return redirectState(request, "received");
}
