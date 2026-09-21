import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type HourlyValueSnapshot = {
  available: boolean;
  claims: number;
  claimRewardCredits: number;
  basePulseCostUsdMicros: number;
  sponsoredServes: number;
  sponsoredClicks: number;
  sponsoredFillRate: number;
  sponsoredCtr: number;
  sponsoredRevenueUsdMicros: number;
  directStarts: number;
  directCompletions: number;
  directRevenueUsdMicros: number;
  directRewardCredits: number;
  monetizedClaims: number;
  monetizedClaimRate: number;
  pulseSupportUsdMicros: number;
  grossContributionUsdMicros: number;
  supportPerClaimUsdMicros: number;
  baseCostPerClaimUsdMicros: number;
  selfSufficiencyRatio: number;
  unfilledClaims: number;
  unmonetizedClaims: number;
  from: string | null;
  to: string | null;
};

const EMPTY: HourlyValueSnapshot = {
  available: false,
  claims: 0,
  claimRewardCredits: 0,
  basePulseCostUsdMicros: 0,
  sponsoredServes: 0,
  sponsoredClicks: 0,
  sponsoredFillRate: 0,
  sponsoredCtr: 0,
  sponsoredRevenueUsdMicros: 0,
  directStarts: 0,
  directCompletions: 0,
  directRevenueUsdMicros: 0,
  directRewardCredits: 0,
  monetizedClaims: 0,
  monetizedClaimRate: 0,
  pulseSupportUsdMicros: 0,
  grossContributionUsdMicros: 0,
  supportPerClaimUsdMicros: 0,
  baseCostPerClaimUsdMicros: 0,
  selfSufficiencyRatio: 0,
  unfilledClaims: 0,
  unmonetizedClaims: 0,
  from: null,
  to: null,
};

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parse(value: unknown): HourlyValueSnapshot {
  if (!value || typeof value !== "object") return EMPTY;
  const row = value as Record<string, unknown>;
  if (row.status !== "ok") return EMPTY;

  return {
    available: true,
    claims: num(row.claims),
    claimRewardCredits: num(row.claim_reward_credits),
    basePulseCostUsdMicros: num(row.base_pulse_cost_usd_micros),
    sponsoredServes: num(row.sponsored_serves),
    sponsoredClicks: num(row.sponsored_clicks),
    sponsoredFillRate: num(row.sponsored_fill_rate),
    sponsoredCtr: num(row.sponsored_ctr),
    sponsoredRevenueUsdMicros: num(row.sponsored_revenue_usd_micros),
    directStarts: num(row.direct_starts),
    directCompletions: num(row.direct_completions),
    directRevenueUsdMicros: num(row.direct_revenue_usd_micros),
    directRewardCredits: num(row.direct_reward_credits),
    monetizedClaims: num(row.monetized_claims),
    monetizedClaimRate: num(row.monetized_claim_rate),
    pulseSupportUsdMicros: num(row.pulse_support_usd_micros),
    grossContributionUsdMicros: num(row.gross_contribution_usd_micros),
    supportPerClaimUsdMicros: num(row.support_per_claim_usd_micros),
    baseCostPerClaimUsdMicros: num(row.base_cost_per_claim_usd_micros),
    selfSufficiencyRatio: num(row.self_sufficiency_ratio),
    unfilledClaims: num(row.unfilled_claims),
    unmonetizedClaims: num(row.unmonetized_claims),
    from: typeof row.from === "string" ? row.from : null,
    to: typeof row.to === "string" ? row.to : null,
  };
}

export async function getHourlyValueSnapshot(): Promise<HourlyValueSnapshot> {
  const admin = createSupabaseAdminClient();
  if (!admin) return EMPTY;

  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);

  const { data, error } = await admin.rpc("admin_hourly_value_snapshot", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error) return EMPTY;
  return parse(data);
}
