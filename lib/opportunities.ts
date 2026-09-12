import "server-only";
import { calculateRewardScore } from "@/lib/reward-score";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RankedOpportunity = {
  id: string;
  provider: string;
  externalId: string;
  title: string;
  category: string;
  payoutUsdMicros: number;
  baseRewardCredits: number;
  estimatedMinutes: number | null;
  score: number;
  expectedRewardCredits: number;
  expectedCreditsPerMinute: number | null;
  confidence: number;
};

export async function getRankedOpportunities(limit = 24): Promise<RankedOpportunity[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("reward_opportunities")
    .select("id,provider,external_id,title,category,payout_usd_micros,base_reward_credits,estimated_minutes,completion_probability,tracking_reliability,payout_reliability,reversal_rate")
    .eq("status", "active")
    .order("refreshed_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit * 4, 100)));

  if (error) return [];

  return (data ?? [])
    .map((row) => {
      const result = calculateRewardScore({
        rewardCredits: Number(row.base_reward_credits ?? 0),
        estimatedMinutes: row.estimated_minutes == null ? null : Number(row.estimated_minutes),
        completionProbability: row.completion_probability == null ? null : Number(row.completion_probability),
        trackingReliability: row.tracking_reliability == null ? null : Number(row.tracking_reliability),
        payoutReliability: row.payout_reliability == null ? null : Number(row.payout_reliability),
        reversalRate: row.reversal_rate == null ? null : Number(row.reversal_rate),
      });

      return {
        id: String(row.id),
        provider: String(row.provider),
        externalId: String(row.external_id),
        title: String(row.title),
        category: String(row.category),
        payoutUsdMicros: Number(row.payout_usd_micros ?? 0),
        baseRewardCredits: Number(row.base_reward_credits ?? 0),
        estimatedMinutes: row.estimated_minutes == null ? null : Number(row.estimated_minutes),
        ...result,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
