import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProspectSegment = "mobile_game" | "consumer_app" | "saas" | "research" | "other";
export type ProspectStatus = "new" | "researching" | "ready" | "contacted" | "replied" | "pilot" | "rejected" | "closed";

export type ProspectSignals = {
  segment: ProspectSegment;
  liveProduct: boolean;
  measurableEvent: boolean;
  publicContact: boolean;
  paidUaSignal: boolean;
  growthWindow: boolean;
};

export type AdvertiserProspect = {
  id: string;
  companyName: string;
  domain: string;
  website: string;
  segment: ProspectSegment;
  country: string | null;
  publicContactEmail: string | null;
  sourceUrl: string;
  fitScore: number;
  liveProduct: boolean;
  measurableEvent: boolean;
  publicContact: boolean;
  paidUaSignal: boolean;
  growthWindow: boolean;
  suggestedPilot: string | null;
  status: ProspectStatus;
  notes: string | null;
  nextActionAt: string | null;
  createdAt: string;
};

function bool(value: unknown) {
  return value === true;
}

function segmentBase(segment: ProspectSegment) {
  if (segment === "mobile_game") return 30;
  if (segment === "consumer_app") return 24;
  if (segment === "research") return 20;
  if (segment === "saas") return 18;
  return 8;
}

export function calculateProspectFit(signals: ProspectSignals) {
  let score = segmentBase(signals.segment);
  if (signals.liveProduct) score += 15;
  if (signals.measurableEvent) score += 20;
  if (signals.publicContact) score += 10;
  if (signals.paidUaSignal) score += 15;
  if (signals.growthWindow) score += 10;
  return Math.max(0, Math.min(100, score));
}

export function normalizeProspectUrl(raw: string, maxLength = 1000) {
  const value = raw.trim();
  if (!value) return null;

  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname || url.username || url.password) return null;
    const normalized = url.toString();
    return normalized.length <= maxLength ? normalized : null;
  } catch {
    return null;
  }
}

export function normalizeProspectDomain(raw: string) {
  const url = normalizeProspectUrl(raw, 2000);
  if (!url) return "";
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

export async function getOutboundProspects(): Promise<AdvertiserProspect[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("advertiser_prospects")
    .select("id,company_name,domain,website,segment,country,public_contact_email,source_url,fit_score,live_product,measurable_event,public_contact,paid_ua_signal,growth_window,suggested_pilot,status,notes,next_action_at,created_at")
    .order("fit_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: String(row.id),
    companyName: String(row.company_name),
    domain: String(row.domain),
    website: String(row.website),
    segment: String(row.segment) as ProspectSegment,
    country: row.country ? String(row.country) : null,
    publicContactEmail: row.public_contact_email ? String(row.public_contact_email) : null,
    sourceUrl: String(row.source_url),
    fitScore: Number(row.fit_score ?? 0),
    liveProduct: bool(row.live_product),
    measurableEvent: bool(row.measurable_event),
    publicContact: bool(row.public_contact),
    paidUaSignal: bool(row.paid_ua_signal),
    growthWindow: bool(row.growth_window),
    suggestedPilot: row.suggested_pilot ? String(row.suggested_pilot) : null,
    status: String(row.status) as ProspectStatus,
    notes: row.notes ? String(row.notes) : null,
    nextActionAt: row.next_action_at ? String(row.next_action_at) : null,
    createdAt: String(row.created_at),
  }));
}


export function buildProspectOutreachHref(prospect: AdvertiserProspect) {
  if (!prospect.publicContactEmail) return null;

  const subject = `Small verified-user pilot for ${prospect.companyName}`;
  const hypothesis = prospect.suggestedPilot
    ? `One pilot hypothesis I had: ${prospect.suggestedPilot}`
    : "I would keep the first test narrow: one measurable action, one market and a hard prefunded cap.";

  const body = [
    `Hi ${prospect.companyName} team,`,
    "",
    "I’m building PulseCircuit, a prefunded performance channel for verified user actions.",
    "",
    "Instead of paying only for raw traffic, a small pilot can settle after one milestone you choose and can verify. Budget and completion count are capped before launch.",
    "",
    hypothesis,
    "",
    "If this is relevant, I can outline a small 25–50 action test and the verification flow before any budget is requested.",
    "",
    "PulseCircuit for Business",
    "https://pulsercuit.pro/business",
  ].join("\n");

  return `mailto:${encodeURIComponent(prospect.publicContactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
