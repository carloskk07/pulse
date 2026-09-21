import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PulseAdStatus =
  | "pending_review"
  | "approved"
  | "active"
  | "paused"
  | "exhausted"
  | "rejected"
  | "cancelled";

export type PulseAdCampaign = {
  id: string;
  checkoutReference: string;
  title: string;
  body: string;
  destinationUrl: string;
  status: PulseAdStatus;
  budgetUsdMicros: number;
  fundedUsdMicros: number;
  spentUsdMicros: number;
  pricePerClickUsdMicros: number;
  served: number;
  clicks: number;
  reviewNote: string | null;
  countryCodes?: string[];
  devicePlatforms?: string[];
  ownerUserId?: string;
  createdAt: string | null;
};

export type PulseAdPlacement = {
  id: string;
  title: string;
  body: string;
};

export type PulseAdsAdminSnapshot = {
  available: boolean;
  campaignCount: number;
  pendingReview: number;
  activeCount: number;
  fundedUsdMicros: number;
  spentUsdMicros: number;
  served: number;
  clicks: number;
  campaigns: PulseAdCampaign[];
};

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asStatus(value: unknown): PulseAdStatus {
  return value === "approved"
    || value === "active"
    || value === "paused"
    || value === "exhausted"
    || value === "rejected"
    || value === "cancelled"
    ? value
    : "pending_review";
}

function parseCampaign(value: unknown): PulseAdCampaign {
  const item = (value ?? {}) as Record<string, unknown>;
  return {
    id: String(item.id ?? ""),
    checkoutReference: String(item.checkout_reference ?? ""),
    title: String(item.title ?? "Sponsored"),
    body: String(item.body ?? ""),
    destinationUrl: String(item.destination_url ?? ""),
    status: asStatus(item.status),
    budgetUsdMicros: asNumber(item.budget_usd_micros),
    fundedUsdMicros: asNumber(item.funded_usd_micros),
    spentUsdMicros: asNumber(item.spent_usd_micros),
    pricePerClickUsdMicros: asNumber(item.price_per_click_usd_micros),
    served: asNumber(item.served),
    clicks: asNumber(item.clicks),
    reviewNote: item.review_note ? String(item.review_note) : null,
    countryCodes: Array.isArray(item.country_codes) ? item.country_codes.map(String) : undefined,
    devicePlatforms: Array.isArray(item.device_platforms) ? item.device_platforms.map(String) : undefined,
    ownerUserId: item.owner_user_id ? String(item.owner_user_id) : undefined,
    createdAt: item.created_at ? String(item.created_at) : null,
  };
}

export function formatUsdMicros(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 1_000_000);
}

export async function createPulseAdCampaign(input: {
  ownerUserId: string;
  title: string;
  body: string;
  destinationUrl: string;
  budgetUsdMicros: number;
  countryCodes: string[];
  devicePlatforms: string[];
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "unavailable" as const };

  const { data, error } = await admin.rpc("create_pulse_ads_campaign", {
    p_owner_user_id: input.ownerUserId,
    p_title: input.title,
    p_body: input.body,
    p_destination_url: input.destinationUrl,
    p_budget_usd_micros: Math.floor(input.budgetUsdMicros),
    p_country_codes: input.countryCodes,
    p_device_platforms: input.devicePlatforms,
  });

  if (error || !data || typeof data !== "object") return { status: "error" as const };
  return data as Record<string, unknown>;
}

export async function getUserPulseAds(userId: string): Promise<PulseAdCampaign[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data, error } = await admin.rpc("user_pulse_ads_snapshot", { p_user_id: userId });
  if (error || !data || typeof data !== "object") return [];

  const snapshot = data as Record<string, unknown>;
  return Array.isArray(snapshot.campaigns) ? snapshot.campaigns.map(parseCampaign) : [];
}

export async function getPulseAdPlacement(input: {
  userId: string;
  countryCode?: string | null;
  devicePlatform?: "mobile" | "desktop" | null;
}): Promise<PulseAdPlacement | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.rpc("serve_pulse_ad", {
    p_user_id: input.userId,
    p_country_code: input.countryCode ?? null,
    p_device_platform: input.devicePlatform ?? null,
  });
  if (error || !data || typeof data !== "object") return null;

  const item = data as Record<string, unknown>;
  if (item.status !== "served" || !item.campaign_id) return null;

  return {
    id: String(item.campaign_id),
    title: String(item.title ?? "Sponsored"),
    body: String(item.body ?? ""),
  };
}

export async function clickPulseAd(campaignId: string, userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "unavailable" as const };

  const { data, error } = await admin.rpc("click_pulse_ad", {
    p_campaign_id: campaignId,
    p_user_id: userId,
  });
  if (error || !data || typeof data !== "object") return { status: "error" as const };
  return data as Record<string, unknown>;
}

export async function reviewPulseAdCampaign(campaignId: string, approve: boolean, note?: string | null) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "unavailable" as const };

  const { data, error } = await admin.rpc("review_pulse_ads_campaign", {
    p_campaign_id: campaignId,
    p_approve: approve,
    p_note: note ?? null,
  });
  if (error || !data || typeof data !== "object") return { status: "error" as const };
  return data as Record<string, unknown>;
}

export async function recordVerifiedPulseAdPayment(input: {
  campaignId: string;
  checkoutReference: string;
  transactionId: string;
  amountUsdMicros: number;
  pricingCurrency: string;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "unavailable" as const };

  const { data, error } = await admin.rpc("record_verified_pulse_ads_payment", {
    p_campaign_id: input.campaignId,
    p_checkout_reference: input.checkoutReference,
    p_provider_transaction_id: input.transactionId,
    p_amount_usd_micros: Math.floor(input.amountUsdMicros),
    p_pricing_currency: input.pricingCurrency,
  });
  if (error || !data || typeof data !== "object") return { status: "error" as const };
  return data as Record<string, unknown>;
}

export async function getPulseAdsAdminSnapshot(): Promise<PulseAdsAdminSnapshot> {
  const admin = createSupabaseAdminClient();
  if (!admin) return {
    available: false,
    campaignCount: 0,
    pendingReview: 0,
    activeCount: 0,
    fundedUsdMicros: 0,
    spentUsdMicros: 0,
    served: 0,
    clicks: 0,
    campaigns: [],
  };

  const { data, error } = await admin.rpc("admin_pulse_ads_snapshot");
  if (error || !data || typeof data !== "object") return {
    available: false,
    campaignCount: 0,
    pendingReview: 0,
    activeCount: 0,
    fundedUsdMicros: 0,
    spentUsdMicros: 0,
    served: 0,
    clicks: 0,
    campaigns: [],
  };

  const snapshot = data as Record<string, unknown>;
  return {
    available: snapshot.status === "ok",
    campaignCount: asNumber(snapshot.campaign_count),
    pendingReview: asNumber(snapshot.pending_review),
    activeCount: asNumber(snapshot.active_count),
    fundedUsdMicros: asNumber(snapshot.funded_usd_micros),
    spentUsdMicros: asNumber(snapshot.spent_usd_micros),
    served: asNumber(snapshot.served),
    clicks: asNumber(snapshot.clicks),
    campaigns: Array.isArray(snapshot.campaigns) ? snapshot.campaigns.map(parseCampaign) : [],
  };
}
