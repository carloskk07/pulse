import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DirectCampaignStatus = "draft" | "active" | "paused" | "exhausted" | "completed" | "cancelled";

export type DirectCampaignSnapshotItem = {
  id: string;
  advertiserName: string;
  title: string;
  actionType: string;
  status: DirectCampaignStatus;
  fundedUsdMicros: number;
  reservedUsdMicros: number;
  spentUsdMicros: number;
  pricePerActionUsdMicros: number;
  rewardCredits: number;
  completionCount: number;
  maxCompletions: number;
  startsAt: string | null;
  endsAt: string | null;
};

export type DirectCampaignSnapshot = {
  status: "ok" | "unavailable" | "error";
  campaignCount: number;
  activeCount: number;
  fundedUsdMicros: number;
  reservedUsdMicros: number;
  spentUsdMicros: number;
  grossContributionUsdMicros: number;
  campaigns: DirectCampaignSnapshotItem[];
};

type SnapshotRpc = {
  status?: string;
  campaign_count?: number | string;
  active_count?: number | string;
  funded_usd_micros?: number | string;
  reserved_usd_micros?: number | string;
  spent_usd_micros?: number | string;
  gross_contribution_usd_micros?: number | string;
  campaigns?: Array<Record<string, unknown>>;
};

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asStatus(value: unknown): DirectCampaignStatus {
  return value === "active" || value === "paused" || value === "exhausted" || value === "completed" || value === "cancelled" ? value : "draft";
}

export async function getDirectCampaignSnapshot(): Promise<DirectCampaignSnapshot> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "unavailable", campaignCount: 0, activeCount: 0, fundedUsdMicros: 0, reservedUsdMicros: 0, spentUsdMicros: 0, grossContributionUsdMicros: 0, campaigns: [] };

  // Keep abandoned start-session reservations from making the operator cockpit stale.
  await admin.rpc("release_expired_direct_campaign_reservations", { p_campaign_id: null });

  const { data, error } = await admin.rpc("direct_campaign_snapshot");
  if (error || !data || typeof data !== "object") {
    return { status: "error", campaignCount: 0, activeCount: 0, fundedUsdMicros: 0, reservedUsdMicros: 0, spentUsdMicros: 0, grossContributionUsdMicros: 0, campaigns: [] };
  }

  const row = data as SnapshotRpc;
  const campaigns = Array.isArray(row.campaigns) ? row.campaigns.map((item) => ({
    id: String(item.id ?? ""),
    advertiserName: String(item.advertiser_name ?? "Advertiser"),
    title: String(item.title ?? "Campaign"),
    actionType: String(item.action_type ?? "custom"),
    status: asStatus(item.status),
    fundedUsdMicros: asNumber(item.funded_usd_micros),
    reservedUsdMicros: asNumber(item.reserved_usd_micros),
    spentUsdMicros: asNumber(item.spent_usd_micros),
    pricePerActionUsdMicros: asNumber(item.price_per_action_usd_micros),
    rewardCredits: asNumber(item.reward_credits),
    completionCount: asNumber(item.completion_count),
    maxCompletions: asNumber(item.max_completions),
    startsAt: item.starts_at ? String(item.starts_at) : null,
    endsAt: item.ends_at ? String(item.ends_at) : null,
  })) : [];

  return {
    status: row.status === "ok" ? "ok" : "error",
    campaignCount: asNumber(row.campaign_count),
    activeCount: asNumber(row.active_count),
    fundedUsdMicros: asNumber(row.funded_usd_micros),
    reservedUsdMicros: asNumber(row.reserved_usd_micros),
    spentUsdMicros: asNumber(row.spent_usd_micros),
    grossContributionUsdMicros: asNumber(row.gross_contribution_usd_micros),
    campaigns,
  };
}

export async function createDirectCampaign(input: {
  advertiserName: string;
  title: string;
  description?: string;
  category?: string;
  actionType: "install" | "signup" | "trial" | "purchase" | "survey" | "milestone" | "custom";
  destinationUrl: string;
  pricePerActionUsdMicros: number;
  rewardCredits: number;
  maxCompletions: number;
  countryCodes?: string[];
  devicePlatforms?: string[];
  estimatedMinutes?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "unavailable" as const };
  const { data, error } = await admin.rpc("create_direct_campaign", {
    p_advertiser_name: input.advertiserName,
    p_title: input.title,
    p_description: input.description ?? "",
    p_category: input.category ?? "other",
    p_action_type: input.actionType,
    p_destination_url: input.destinationUrl,
    p_price_per_action_usd_micros: Math.floor(input.pricePerActionUsdMicros),
    p_reward_credits: Math.floor(input.rewardCredits),
    p_max_completions: Math.floor(input.maxCompletions),
    p_country_codes: input.countryCodes ?? [],
    p_device_platforms: input.devicePlatforms ?? [],
    p_estimated_minutes: input.estimatedMinutes ?? null,
    p_starts_at: input.startsAt ?? null,
    p_ends_at: input.endsAt ?? null,
  });
  if (error) return { status: "error" as const };
  return (data ?? { status: "unknown" }) as Record<string, unknown>;
}

export async function fundDirectCampaign(campaignId: string, amountUsdMicros: number, fundingReference: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "unavailable" as const };
  const { data, error } = await admin.rpc("fund_direct_campaign", {
    p_campaign_id: campaignId,
    p_amount_usd_micros: Math.floor(amountUsdMicros),
    p_funding_reference: fundingReference,
  });
  if (error) return { status: "error" as const };
  return (data ?? { status: "unknown" }) as Record<string, unknown>;
}

export async function activateDirectCampaign(campaignId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "unavailable" as const };
  const { data, error } = await admin.rpc("activate_direct_campaign", { p_campaign_id: campaignId });
  if (error) return { status: "error" as const };
  return (data ?? { status: "unknown" }) as Record<string, unknown>;
}

export async function pauseDirectCampaign(campaignId: string, reason?: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "unavailable" as const };
  const { data, error } = await admin.rpc("pause_direct_campaign", { p_campaign_id: campaignId, p_reason: reason ?? null });
  if (error) return { status: "error" as const };
  return (data ?? { status: "unknown" }) as Record<string, unknown>;
}
