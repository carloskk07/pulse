export type CoreProductPhase =
  | "preview"
  | "paused"
  | "ready"
  | "charging"
  | "building"
  | "processing"
  | "complete"
  | "live"
  | "idle";

export type CoreValueFlowStage = "earn" | "balance" | "payout";
export type CorePayoutFlowState = "building" | "ready" | "processing" | "paid" | "paused";

export type CoreProductEvent =
  | "none"
  | "reward-settled"
  | "payout-ready"
  | "payout-processing"
  | "payout-complete"
  | "network-live";

export function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function payoutProgressPercent(availableCredits: number, payoutCredits: number | null) {
  if (!payoutCredits || payoutCredits <= 0) return 0;
  return clampPercent((Math.max(0, availableCredits) / payoutCredits) * 100);
}

export function deriveEarningPhase(input: {
  preview: boolean;
  pulseFundingReady: boolean;
  claimReady: boolean;
}): CoreProductPhase {
  if (input.preview) return "preview";
  if (!input.pulseFundingReady) return "paused";
  return input.claimReady ? "ready" : "charging";
}

export function deriveEarningEvent(input: {
  claimResult?: string | null;
}): CoreProductEvent {
  return input.claimResult === "success" ? "reward-settled" : "none";
}

export function deriveWalletCore(input: {
  preview: boolean;
  payoutConfigured: boolean;
  canWithdraw: boolean;
  hasActiveWithdrawal: boolean;
  paid: boolean;
}): {
  payoutState: CorePayoutFlowState;
  stage: CoreValueFlowStage;
  surface: "balance" | "payout";
  phase: CoreProductPhase;
  event: CoreProductEvent;
} {
  const payoutState: CorePayoutFlowState = input.paid
    ? "paid"
    : input.hasActiveWithdrawal
      ? "processing"
      : input.canWithdraw
        ? "ready"
        : input.payoutConfigured
          ? "building"
          : "paused";

  const surface = payoutState === "ready" || payoutState === "processing" || payoutState === "paid"
    ? "payout"
    : "balance";
  const stage: CoreValueFlowStage = surface === "payout" ? "payout" : "balance";

  const phase: CoreProductPhase = input.preview
    ? "preview"
    : payoutState === "paid"
      ? "complete"
      : payoutState === "processing"
        ? "processing"
        : payoutState === "ready"
          ? "ready"
          : payoutState === "building"
            ? "building"
            : "paused";

  const event: CoreProductEvent = input.preview
    ? "none"
    : payoutState === "paid"
      ? "payout-complete"
      : payoutState === "processing"
        ? "payout-processing"
        : payoutState === "ready"
          ? "payout-ready"
          : "none";

  return { payoutState, stage, surface, phase, event };
}

export function deriveNetworkEvent(input: {
  signedIn: boolean;
  active: number;
}): CoreProductEvent {
  return input.signedIn && input.active > 0 ? "network-live" : "none";
}
