import "server-only";
import {
  calculateRewardScore,
  type OpportunityEvidenceTier,
  type OpportunityHealthState,
} from "@/lib/reward-score";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OpportunitySourceType = "partner" | "direct" | "affiliate" | "research";

export type RankedOpportunity = {
  id: string;
  provider: string;
  externalId: string;
  title: string;
  category: string;
  sourceType: OpportunitySourceType;
  evidenceTier: OpportunityEvidenceTier;
  healthState: OpportunityHealthState;
  payoutUsdMicros: number;
  baseRewardCredits: number;
  estimatedMinutes: number | null;
  freshnessMinutes: number;
  quickWin: boolean;
  actionHref: string | null;
  pulseProtected: boolean;
  score: number;
  expectedRewardCredits: number;
  expectedCreditsPerMinute: number | null;
  confidence: number;
  evidenceConfidence: number;
  dataCompleteness: number;
  publicRewardLabel: string | null;
};

type OpportunityRow = {
  id?: unknown;
  provider?: unknown;
  external_id?: unknown;
  title?: unknown;
  category?: unknown;
  source_type?: unknown;
  evidence_tier?: unknown;
  health_state?: unknown;
  payout_usd_micros?: unknown;
  base_reward_credits?: unknown;
  estimated_minutes?: unknown;
  completion_probability?: unknown;
  tracking_reliability?: unknown;
  payout_reliability?: unknown;
  reversal_rate?: unknown;
  refreshed_at?: unknown;
  freshness_ttl_minutes?: unknown;
  expires_at?: unknown;
  metadata?: unknown;
};

function asEvidenceTier(value: unknown): OpportunityEvidenceTier {
  return value === "proven" || value === "strong" || value === "limited" || value === "new" ? value : "unknown";
}

function asHealthState(value: unknown): OpportunityHealthState {
  return value === "excellent" || value === "good" || value === "degraded" || value === "hidden" ? value : "unknown";
}

function asSourceType(value: unknown): OpportunitySourceType {
  return value === "direct" || value === "affiliate" || value === "research" ? value : "partner";
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function opportunityFreshness(row: OpportunityRow, nowMs: number) {
  const refreshedMs = new Date(String(row.refreshed_at ?? "")).getTime();
  if (!Number.isFinite(refreshedMs)) return null;

  const ttlMinutes = Math.max(5, Math.min(10080, finiteNumber(row.freshness_ttl_minutes, 1440)));
  const freshnessMinutes = Math.max(0, (nowMs - refreshedMs) / 60_000);
  const expiresMs = row.expires_at ? new Date(String(row.expires_at)).getTime() : null;
  if (expiresMs != null && Number.isFinite(expiresMs) && expiresMs <= nowMs) return null;
  if (freshnessMinutes > ttlMinutes) return null;

  const declaredHealth = asHealthState(row.health_state);
  if (declaredHealth === "hidden") return null;

  const effectiveHealth: OpportunityHealthState = freshnessMinutes > ttlMinutes * 0.75
    ? "degraded"
    : declaredHealth;

  return { freshnessMinutes, effectiveHealth };
}

export async function getRankedOpportunities(limit = 24): Promise<RankedOpportunity[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("reward_opportunities")
    .select("id,provider,external_id,title,category,source_type,evidence_tier,health_state,payout_usd_micros,base_reward_credits,estimated_minutes,completion_probability,tracking_reliability,payout_reliability,reversal_rate,refreshed_at,freshness_ttl_minutes,expires_at,metadata")
    .eq("status", "active")
    .neq("health_state", "hidden")
    .order("refreshed_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit * 6, 144)));

  if (error) return [];
  const nowMs = Date.now();

  return ((data ?? []) as OpportunityRow[])
    .flatMap((row) => {
      const freshness = opportunityFreshness(row, nowMs);
      if (!freshness) return [];

      const evidenceTier = asEvidenceTier(row.evidence_tier);
      const sourceType = asSourceType(row.source_type);
      const externalId = String(row.external_id);
      const result = calculateRewardScore({
        rewardCredits: finiteNumber(row.base_reward_credits),
        estimatedMinutes: row.estimated_minutes == null ? null : finiteNumber(row.estimated_minutes),
        completionProbability: row.completion_probability == null ? null : finiteNumber(row.completion_probability),
        trackingReliability: row.tracking_reliability == null ? null : finiteNumber(row.tracking_reliability),
        payoutReliability: row.payout_reliability == null ? null : finiteNumber(row.payout_reliability),
        reversalRate: row.reversal_rate == null ? null : finiteNumber(row.reversal_rate),
        evidenceTier,
        healthState: freshness.effectiveHealth,
      });
      const estimatedMinutes = row.estimated_minutes == null ? null : finiteNumber(row.estimated_minutes);
      const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {};
      const publicRewardLabel = typeof metadata.public_reward_label === "string"
        && metadata.public_reward_label.trim()
        && metadata.public_reward_label.trim().length <= 80
        ? metadata.public_reward_label.trim()
        : null;

      return [{
        id: String(row.id),
        provider: String(row.provider),
        externalId,
        title: String(row.title),
        category: String(row.category),
        sourceType,
        evidenceTier,
        healthState: freshness.effectiveHealth,
        payoutUsdMicros: finiteNumber(row.payout_usd_micros),
        baseRewardCredits: finiteNumber(row.base_reward_credits),
        estimatedMinutes,
        freshnessMinutes: Math.round(freshness.freshnessMinutes),
        quickWin: estimatedMinutes != null && estimatedMinutes > 0 && estimatedMinutes <= 10,
        actionHref: sourceType === "direct" ? `/api/direct/start?campaign=${encodeURIComponent(externalId)}` : null,
        pulseProtected: sourceType === "direct",
        publicRewardLabel,
        ...result,
      } satisfies RankedOpportunity];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
