export type OpportunityEvidenceTier = "proven" | "strong" | "limited" | "new" | "unknown";
export type OpportunityHealthState = "excellent" | "good" | "degraded" | "unknown" | "hidden";

export type RewardScoreInput = {
  rewardCredits: number;
  estimatedMinutes?: number | null;
  completionProbability?: number | null;
  trackingReliability?: number | null;
  payoutReliability?: number | null;
  reversalRate?: number | null;
  treasuryBoostCredits?: number | null;
  evidenceTier?: OpportunityEvidenceTier | null;
  healthState?: OpportunityHealthState | null;
};

export type RewardScoreResult = {
  score: number;
  expectedRewardCredits: number;
  expectedCreditsPerMinute: number | null;
  confidence: number;
  evidenceConfidence: number;
  dataCompleteness: number;
};

function clamp01(value: number | null | undefined, fallback: number) {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function evidenceFactor(tier: OpportunityEvidenceTier | null | undefined) {
  if (tier === "proven") return 1;
  if (tier === "strong") return 0.94;
  if (tier === "limited") return 0.82;
  if (tier === "new") return 0.68;
  return 0.52;
}

function healthFactor(state: OpportunityHealthState | null | undefined) {
  if (state === "excellent") return 1;
  if (state === "good") return 0.96;
  if (state === "degraded") return 0.72;
  if (state === "hidden") return 0;
  return 0.82;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function calculateRewardScore(input: RewardScoreInput): RewardScoreResult {
  const baseReward = Math.max(0, Number(input.rewardCredits) || 0);
  const boost = Math.max(0, Number(input.treasuryBoostCredits) || 0);
  const reward = baseReward + boost;

  const suppliedSignals = [
    input.completionProbability,
    input.trackingReliability,
    input.payoutReliability,
    input.reversalRate,
  ].filter((value) => value != null && Number.isFinite(Number(value))).length;
  const dataCompleteness = suppliedSignals / 4;

  // Unknown data is deliberately conservative. A large headline reward must not
  // outrank a proven opportunity merely because its quality signals are absent.
  const completion = clamp01(input.completionProbability, 0.35);
  const tracking = clamp01(input.trackingReliability, 0.6);
  const payout = clamp01(input.payoutReliability, 0.65);
  const reversal = clamp01(input.reversalRate, 0.12);
  const evidenceConfidence = evidenceFactor(input.evidenceTier) * (0.7 + dataCompleteness * 0.3);
  const operationalConfidence = tracking * payout * (1 - reversal) * healthFactor(input.healthState);
  const confidence = operationalConfidence * evidenceConfidence;
  const expectedRewardCredits = reward * completion * confidence;

  const minutes = Number(input.estimatedMinutes);
  const validMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.max(1, minutes) : null;
  const expectedCreditsPerMinute = validMinutes ? expectedRewardCredits / validMinutes : null;

  // Reward efficient use of time without allowing tiny duration estimates to
  // dominate. Evidence and health are already reflected in expected value.
  const score = validMinutes
    ? expectedRewardCredits * (1 + Math.log1p(30 / validMinutes))
    : expectedRewardCredits;

  return {
    score: round3(score),
    expectedRewardCredits: round3(expectedRewardCredits),
    expectedCreditsPerMinute: expectedCreditsPerMinute == null ? null : round3(expectedCreditsPerMinute),
    confidence: round3(confidence),
    evidenceConfidence: round3(evidenceConfidence),
    dataCompleteness: round3(dataCompleteness),
  };
}
