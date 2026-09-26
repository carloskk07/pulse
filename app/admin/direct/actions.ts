"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-authorization";
import { getProductRouteHref } from "@/lib/route-semantics";
import {
  activateDirectCampaign,
  createDirectCampaign,
  fundDirectCampaign,
  pauseDirectCampaign,
} from "@/lib/direct-campaigns";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION_TYPES = new Set(["install","signup","trial","purchase","survey","milestone","custom"]);

export type DirectCreateState = {
  status: "idle" | "error" | "created";
  message: string;
  campaignId?: string;
  callbackSecret?: string;
};

async function requireAdmin() {
  const access = await getAdminAccess();
  if (access.status === "unauthenticated") redirect("/auth?next=/admin/direct");
  if (access.status !== "authorized") redirect(getProductRouteHref("home"));
}

function textValue(formData: FormData, key: string, max: number) {
  const value = String(formData.get(key) ?? "").trim();
  return value && value.length <= max ? value : null;
}

function positiveInt(formData: FormData, key: string, max: number) {
  const value = Number(String(formData.get(key) ?? "").trim());
  return Number.isSafeInteger(value) && value > 0 && value <= max ? value : null;
}

function parseUsdMicros(rawValue: FormDataEntryValue | null) {
  const raw = String(rawValue ?? "").trim();
  const match = raw.match(/^(\d{1,7})(?:\.(\d{1,6}))?$/);
  if (!match) return null;
  const micros = Number(match[1]) * 1_000_000 + Number((match[2] ?? "").padEnd(6, "0"));
  return Number.isSafeInteger(micros) && micros > 0 ? micros : null;
}

function csv(raw: FormDataEntryValue | null, pattern: RegExp, maxItems: number) {
  const items = String(raw ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (items.length > maxItems || items.some((item) => !pattern.test(item))) return null;
  return [...new Set(items)];
}

function safeHttps(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || !host
      || host === "localhost"
      || host.endsWith(".local")
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function createDirectCampaignAction(
  _previous: DirectCreateState,
  formData: FormData,
): Promise<DirectCreateState> {
  await requireAdmin();

  const advertiserName = textValue(formData, "advertiser_name", 160);
  const title = textValue(formData, "title", 180);
  const description = String(formData.get("description") ?? "").trim().slice(0, 1_500);
  const category = textValue(formData, "category", 80) ?? "other";
  const actionType = String(formData.get("action_type") ?? "").trim();
  const destinationRaw = textValue(formData, "destination_url", 2_000);
  const destinationUrl = destinationRaw ? safeHttps(destinationRaw) : null;
  const pricePerActionUsdMicros = parseUsdMicros(formData.get("price_per_action_usd"));
  const rewardCredits = positiveInt(formData, "reward_credits", 1_000_000);
  const maxCompletions = positiveInt(formData, "max_completions", 1_000_000);
  const estimatedMinutes = positiveInt(formData, "estimated_minutes", 10_080);
  const countryCodes = csv(formData.get("country_codes"), /^[A-Z]{2}$/, 40);
  const devicePlatforms = csv(formData.get("device_platforms"), /^(web|desktop|mobile|android|ios)$/, 10);

  if (
    !advertiserName
    || !title
    || !ACTION_TYPES.has(actionType)
    || !destinationUrl
    || !pricePerActionUsdMicros
    || !rewardCredits
    || !maxCompletions
    || !countryCodes
    || !devicePlatforms
    || pricePerActionUsdMicros < rewardCredits * 1_000
  ) {
    return { status: "error", message: "Check the campaign fields. Price per action must cover the user reward." };
  }

  const result = await createDirectCampaign({
    advertiserName,
    title,
    description,
    category,
    actionType: actionType as "install" | "signup" | "trial" | "purchase" | "survey" | "milestone" | "custom",
    destinationUrl,
    pricePerActionUsdMicros,
    rewardCredits,
    maxCompletions,
    countryCodes,
    devicePlatforms,
    estimatedMinutes,
  });

  const status = String(result.status ?? "");
  const campaignId = String(result.campaign_id ?? "");
  const callbackSecret = String(result.callback_secret ?? "");

  if (status !== "created" || !UUID_RE.test(campaignId) || callbackSecret.length < 32) {
    return { status: "error", message: "Campaign creation did not complete safely." };
  }

  revalidatePath("/admin/direct");
  return {
    status: "created",
    message: "Campaign created. Copy the callback secret now; Pulsercuit stores only its hash.",
    campaignId,
    callbackSecret,
  };
}

export async function fundDirectCampaignAction(formData: FormData) {
  await requireAdmin();
  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const amountUsdMicros = parseUsdMicros(formData.get("amount_usd"));
  const fundingReference = textValue(formData, "funding_reference", 240);

  if (!UUID_RE.test(campaignId) || !amountUsdMicros || !fundingReference) {
    redirect("/admin/direct?direct=funding-invalid");
  }

  const result = await fundDirectCampaign(campaignId, amountUsdMicros, fundingReference);
  const status = String(result.status ?? "");
  revalidatePath("/admin/direct");
  redirect(`/admin/direct?direct=${encodeURIComponent(status === "funded" ? "funded" : status || "funding-failed")}`);
}

export async function activateDirectCampaignAction(formData: FormData) {
  await requireAdmin();
  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  if (!UUID_RE.test(campaignId)) redirect("/admin/direct?direct=invalid");

  const result = await activateDirectCampaign(campaignId);
  const status = String(result.status ?? "");
  revalidatePath("/admin/direct");
  redirect(`/admin/direct?direct=${encodeURIComponent(status === "active" ? "activated" : status || "activate-failed")}`);
}

export async function pauseDirectCampaignAction(formData: FormData) {
  await requireAdmin();
  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  if (!UUID_RE.test(campaignId)) redirect("/admin/direct?direct=invalid");

  const result = await pauseDirectCampaign(campaignId, "Operator pause from launch cockpit");
  const status = String(result.status ?? "");
  revalidatePath("/admin/direct");
  redirect(`/admin/direct?direct=${encodeURIComponent(status === "paused" ? "paused" : status || "pause-failed")}`);
}
