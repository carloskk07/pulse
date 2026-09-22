import { createHash, randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const MARKETING_SESSION_COOKIE = "pc_growth";
export const MARKETING_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const MARKETING_EXPERIENCE_VERSION = "pulse-identity-v14-2";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_EVENTS = new Set<MarketingEventType>(["home_view", "faucet_view", "proof_view", "signup_view", "cta_click"]);
const CLICK_LABELS = new Set([
  "header_signup",
  "home_hero_signup",
  "home_hero_proof",
  "home_pillar_signup",
  "home_pillar_proof",
  "home_chamber_signup",
  "home_final_signup",
  "proof_hero_signup",
  "proof_final_signup",
  "faucet_signup",
  "faucet_proof",
]);

export type MarketingEventType = "home_view" | "faucet_view" | "proof_view" | "signup_view" | "signup_created" | "cta_click";

export type MarketingAttribution = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

export type MarketingSourceRow = {
  source: string;
  sessions: number;
  signups: number;
};

export type MarketingCtaRow = {
  label: string;
  clicks: number;
};

export type MarketingFunnelSnapshot = {
  available: boolean;
  days: number;
  fromDay: string | null;
  trackingStartedAt: string | null;
  homeSessions: number;
  faucetSessions: number;
  proofSessions: number;
  signupSessions: number;
  signupCreatedSessions: number;
  newUsers: number;
  firstPulseUsers: number;
  repeatPulseUsers: number;
  paidUsers: number;
  sources: MarketingSourceRow[];
  ctaClicks: number;
  ctaSurfaces: MarketingCtaRow[];
  experienceVersion: string;
};

export function cleanMarketingSessionId(value: string | null | undefined) {
  const candidate = value?.trim() ?? "";
  return UUID_PATTERN.test(candidate) ? candidate : null;
}

export function createMarketingSessionId() {
  return randomUUID();
}

export function isPublicMarketingEvent(value: unknown): value is Exclude<MarketingEventType, "signup_created"> {
  return typeof value === "string" && PUBLIC_EVENTS.has(value as MarketingEventType);
}

export function cleanMarketingEventLabel(value: string | null | undefined) {
  const candidate = value?.trim().toLowerCase() ?? "";
  return CLICK_LABELS.has(candidate) ? candidate : null;
}

function cleanMarketingUserId(value: string | null | undefined) {
  const candidate = value?.trim() ?? "";
  return UUID_PATTERN.test(candidate) ? candidate : null;
}

function cleanAttribution(value: string | null | undefined, maxLength: number) {
  const candidate = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!candidate) return null;
  return candidate.slice(0, maxLength);
}

function sessionHash(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex");
}

export async function recordMarketingEvent(
  sessionId: string,
  eventType: MarketingEventType,
  attribution: MarketingAttribution = {},
  details: { label?: string | null; userId?: string | null } = {},
) {
  const cleanSession = cleanMarketingSessionId(sessionId);
  if (!cleanSession) return false;

  const admin = createSupabaseAdminClient();
  if (!admin) return false;

  const label = eventType === "cta_click" ? cleanMarketingEventLabel(details.label) : null;
  if (eventType === "cta_click" && !label) return false;

  const userId = eventType === "signup_created" ? cleanMarketingUserId(details.userId) : null;
  if (eventType === "signup_created" && !userId) return false;

  const { error } = await admin.from("marketing_funnel_events").insert({
    session_hash: sessionHash(cleanSession),
    event_type: eventType,
    event_label: label,
    user_id: userId,
    utm_source: cleanAttribution(attribution.utmSource, 120),
    utm_medium: cleanAttribution(attribution.utmMedium, 120),
    utm_campaign: cleanAttribution(attribution.utmCampaign, 160),
    experience_version: MARKETING_EXPERIENCE_VERSION,
  });

  if (!error) return true;
  return error.code === "23505";
}

const EMPTY: MarketingFunnelSnapshot = {
  available: false,
  days: 30,
  fromDay: null,
  trackingStartedAt: null,
  homeSessions: 0,
  faucetSessions: 0,
  proofSessions: 0,
  signupSessions: 0,
  signupCreatedSessions: 0,
  newUsers: 0,
  firstPulseUsers: 0,
  repeatPulseUsers: 0,
  paidUsers: 0,
  sources: [],
  ctaClicks: 0,
  ctaSurfaces: [],
  experienceVersion: MARKETING_EXPERIENCE_VERSION,
};

export async function getMarketingFunnelSnapshot(days = 30): Promise<MarketingFunnelSnapshot> {
  const boundedDays = Math.max(1, Math.min(90, Math.floor(days)));
  const admin = createSupabaseAdminClient();
  if (!admin) return { ...EMPTY, days: boundedDays };

  const { data, error } = await admin.rpc("admin_marketing_funnel_snapshot_by_version", {
    p_days: boundedDays,
    p_experience_version: MARKETING_EXPERIENCE_VERSION,
  });
  if (error || !data || typeof data !== "object") return { ...EMPTY, days: boundedDays };

  const snapshot = data as Record<string, unknown>;
  const sources = Array.isArray(snapshot.sources)
    ? snapshot.sources.map((row) => {
        const item = (row ?? {}) as Record<string, unknown>;
        return {
          source: String(item.source ?? "direct"),
          sessions: Number(item.sessions ?? 0),
          signups: Number(item.signups ?? 0),
        };
      })
    : [];

  const ctaSurfaces = Array.isArray(snapshot.cta_surfaces)
    ? snapshot.cta_surfaces.map((row) => {
        const item = (row ?? {}) as Record<string, unknown>;
        return {
          label: String(item.label ?? "unknown"),
          clicks: Number(item.clicks ?? 0),
        };
      })
    : [];

  return {
    available: snapshot.status === "ok",
    days: Number(snapshot.days ?? boundedDays),
    fromDay: snapshot.from_day ? String(snapshot.from_day) : null,
    trackingStartedAt: snapshot.tracking_started_at ? String(snapshot.tracking_started_at) : null,
    homeSessions: Number(snapshot.home_sessions ?? 0),
    faucetSessions: Number(snapshot.faucet_sessions ?? 0),
    proofSessions: Number(snapshot.proof_sessions ?? 0),
    signupSessions: Number(snapshot.signup_sessions ?? 0),
    signupCreatedSessions: Number(snapshot.signup_created_sessions ?? 0),
    newUsers: Number(snapshot.new_users ?? 0),
    firstPulseUsers: Number(snapshot.first_pulse_users ?? 0),
    repeatPulseUsers: Number(snapshot.repeat_pulse_users ?? 0),
    paidUsers: Number(snapshot.paid_users ?? 0),
    sources,
    ctaClicks: Number(snapshot.cta_clicks ?? 0),
    ctaSurfaces,
    experienceVersion: String(snapshot.experience_version ?? MARKETING_EXPERIENCE_VERSION),
  };
}
