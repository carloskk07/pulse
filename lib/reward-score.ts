export type RewardScoreInput = {
  rewardCredits: number;
  estimatedMinutes?: number | null;
  completionProbability?: number | null;
  trackingReliability?: number | null;
  payoutReliability?: number | null;
  reversalRate?: number | null;
  treasuryBoostCredits?: number | null;
};

export type RewardScoreResult = {
  score: number;
  expectedRewardCredits: number;
  expectedCreditsPerMinute: number | null;
  confidence: number;
};

function clamp01(value: number | null | undefined, fallback: number) {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

export function calculateRewardScore(input: RewardScoreInput): RewardScoreResult {
  const baseReward = Math.max(0, Number(input.rewardCredits) || 0);
  const boost = Math.max(0, Number(input.treasuryBoostCredits) || 0);
  const reward = baseReward + boost;
  const completion = clamp01(input.completionProbability, 0.5);
  const tracking = clamp01(input.trackingReliability, 0.75);
  const payout = clamp01(input.payoutReliability, 0.75);
  const reversal = clamp01(input.reversalRate, 0.05);
  const confidence = tracking * payout * (1 - reversal);
  const expectedRewardCredits = reward * completion * confidence;

  const minutes = Number(input.estimatedMinutes);
  const validMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.max(1, minutes) : null;
  const expectedCreditsPerMinute = validMinutes ? expectedRewardCredits / validMinutes : null;

  // When duration is unknown, rank on risk-adjusted expected value. When known,
  // reward efficient use of the user's time without allowing tiny durations to explode.
  const score = validMinutes
    ? expectedRewardCredits * (1 + Math.log1p(30 / validMinutes))
    : expectedRewardCredits;

  return {
    score: Math.round(score * 1000) / 1000,
    expectedRewardCredits: Math.round(expectedRewardCredits * 1000) / 1000,
    expectedCreditsPerMinute: expectedCreditsPerMinute == null ? null : Math.round(expectedCreditsPerMinute * 1000) / 1000,
    confidence: Math.round(confidence * 1000) / 1000,
  };
}
