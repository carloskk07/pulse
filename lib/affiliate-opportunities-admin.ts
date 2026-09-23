import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AffiliateOfferAdminItem = {
  id: string;
  provider: string;
  externalId: string;
  title: string;
  status: string;
  baseRewardCredits: number;
  refreshedAt: string;
  freshnessTtlMinutes: number;
  expiresAt: string | null;
  fresh: boolean;
};

export type AffiliateOfferAdminSnapshot = {
  available: boolean;
  cashbackEnabled: boolean;
  cashbackUserShareBps: number;
  callbackSecretConfigured: boolean;
  launchRequirementsReady: boolean;
  liveOfferCount: number;
  offers: AffiliateOfferAdminItem[];
};

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function getAffiliateOfferAdminSnapshot(): Promise<AffiliateOfferAdminSnapshot> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      available: false,
      cashbackEnabled: false,
      cashbackUserShareBps: 0,
      callbackSecretConfigured: Boolean(process.env.CASHBACK_CALLBACK_SECRET?.trim()),
      launchRequirementsReady: false,
      liveOfferCount: 0,
      offers: [],
    };
  }

  const [configResult, offersResult, readyResult] = await Promise.all([
    admin.from("app_config").select("value").eq("key", "pulse_economy_v13").maybeSingle(),
    admin
      .from("reward_opportunities")
      .select("id,provider,external_id,title,status,base_reward_credits,refreshed_at,freshness_ttl_minutes,expires_at")
      .eq("source_type", "affiliate")
      .order("refreshed_at", { ascending: false })
      .limit(20),
    admin.rpc("cashback_public_launch_requirements_ready", { p_economy: null }),
  ]);

  if (configResult.error || offersResult.error) {
    return {
      available: false,
      cashbackEnabled: false,
      cashbackUserShareBps: 0,
      callbackSecretConfigured: Boolean(process.env.CASHBACK_CALLBACK_SECRET?.trim()),
      launchRequirementsReady: false,
      liveOfferCount: 0,
      offers: [],
    };
  }

  const economy = objectValue(configResult.data?.value);
  const now = Date.now();
  const offers = (offersResult.data ?? []).map((row) => {
    const refreshedAt = String(row.refreshed_at ?? "");
    const ttlMinutes = Math.max(5, Math.min(10_080, Number(row.freshness_ttl_minutes ?? 1_440)));
    const refreshedMs = new Date(refreshedAt).getTime();
    const expiresAt = row.expires_at ? String(row.expires_at) : null;
    const expiresMs = expiresAt ? new Date(expiresAt).getTime() : null;
    const fresh = row.status === "active"
      && Number.isFinite(refreshedMs)
      && refreshedMs + ttlMinutes * 60_000 > now
      && (expiresMs === null || (Number.isFinite(expiresMs) && expiresMs > now));

    return {
      id: String(row.id),
      provider: String(row.provider ?? ""),
      externalId: String(row.external_id ?? ""),
      title: String(row.title ?? ""),
      status: String(row.status ?? "paused"),
      baseRewardCredits: Number(row.base_reward_credits ?? 0),
      refreshedAt,
      freshnessTtlMinutes: ttlMinutes,
      expiresAt,
      fresh,
    } satisfies AffiliateOfferAdminItem;
  });

  return {
    available: true,
    cashbackEnabled: String(economy.cashback_enabled ?? "false").toLowerCase() === "true",
    cashbackUserShareBps: Math.max(0, Math.min(7_500, Number(economy.cashback_user_share_bps ?? 0))),
    callbackSecretConfigured: Boolean(process.env.CASHBACK_CALLBACK_SECRET?.trim()),
    launchRequirementsReady: !readyResult.error && readyResult.data === true,
    liveOfferCount: offers.filter((offer) => offer.fresh).length,
    offers,
  };
}
