export type OpportunityEconomics = {
  payoutUsd: number;
  conversionRate: number;
  chargebackRate: number;
  rewardUsd: number;
  fraudReserveUsd?: number;
  paymentCostUsd?: number;
  retentionValueUsd?: number;
};

export function expectedContribution(input: OpportunityEconomics): number {
  const expectedRevenue = input.payoutUsd * input.conversionRate * (1 - input.chargebackRate);
  return (
    expectedRevenue -
    input.rewardUsd * input.conversionRate -
    (input.fraudReserveUsd ?? 0) -
    (input.paymentCostUsd ?? 0) +
    (input.retentionValueUsd ?? 0)
  );
}

export function rewardCeiling(params: {
  confirmedPayoutUsd: number;
  targetMarginRate: number;
  chargebackReserveRate: number;
  referralRate: number;
  paymentCostRate: number;
}): number {
  const retainedRate =
    1 -
    params.targetMarginRate -
    params.chargebackReserveRate -
    params.referralRate -
    params.paymentCostRate;

  return Math.max(0, params.confirmedPayoutUsd * retainedRate);
}
