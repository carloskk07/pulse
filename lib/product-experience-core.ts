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

export type CoreProductResidue =
  | "none"
  | "reward-history"
  | "balance-funded"
  | "payout-ready"
  | "payout-processing"
  | "payout-paid"
  | "rank-spark"
  | "rank-flow"
  | "rank-rhythm"
  | "rank-circuit"
  | "rank-resonance"
  | "network-waiting"
  | "network-active";

export type CoreRankStage = "Spark" | "Flow" | "Rhythm" | "Circuit" | "Resonance";

export const NETWORK_RESIDUE_MILESTONE = 10;

export function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function payoutProgressPercent(availableCredits: number, payoutCredits: number | null) {
  if (!payoutCredits || payoutCredits <= 0) return 0;
  return clampPercent((Math.max(0, availableCredits) / payoutCredits) * 100);
}

export function isRecentAuthoritativeEvent(
  timestamp: string | null | undefined,
  nowMs: number,
  windowMs = 5 * 60_000,
) {
  if (!timestamp || !Number.isFinite(nowMs) || !Number.isFinite(windowMs) || windowMs <= 0) return false;
  const eventMs = new Date(timestamp).getTime();
  if (!Number.isFinite(eventMs)) return false;
  const age = nowMs - eventMs;
  return age >= 0 && age <= windowMs;
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
  claimSettled: boolean;
}): CoreProductEvent {
  return input.claimSettled ? "reward-settled" : "none";
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


export function deriveEarningResidue(input: {
  preview: boolean;
  availableCredits: number;
  claimCount: number;
}): CoreProductResidue {
  if (input.preview) return "none";
  if (Number(input.availableCredits) > 0) return "balance-funded";
  if (Number(input.claimCount) > 0) return "reward-history";
  return "none";
}

export function deriveWalletResidue(input: {
  preview: boolean;
  payoutState: CorePayoutFlowState;
  availableCredits: number;
}): CoreProductResidue {
  if (input.preview) return "none";
  if (input.payoutState === "paid") return "payout-paid";
  if (input.payoutState === "processing") return "payout-processing";
  if (input.payoutState === "ready") return "payout-ready";
  return Number(input.availableCredits) > 0 ? "balance-funded" : "none";
}

export function deriveProgressResidue(input: {
  preview: boolean;
  signedIn: boolean;
  stage: CoreRankStage;
}): CoreProductResidue {
  if (input.preview || !input.signedIn) return "none";
  if (input.stage === "Resonance") return "rank-resonance";
  if (input.stage === "Circuit") return "rank-circuit";
  if (input.stage === "Rhythm") return "rank-rhythm";
  if (input.stage === "Flow") return "rank-flow";
  return "rank-spark";
}

export function deriveNetworkResidue(input: {
  signedIn: boolean;
  active: number;
  waiting: number;
}): CoreProductResidue {
  if (!input.signedIn) return "none";
  if (Number(input.active) > 0) return "network-active";
  if (Number(input.waiting) > 0) return "network-waiting";
  return "none";
}


export function deriveEarningResidueStrength(input: {
  preview: boolean;
  availableCredits: number;
  payoutCredits: number | null;
}): number {
  if (input.preview) return 0;
  return payoutProgressPercent(input.availableCredits, input.payoutCredits);
}

export function deriveWalletResidueStrength(input: {
  preview: boolean;
  payoutState: CorePayoutFlowState;
  availableCredits: number;
  payoutCredits: number | null;
}): number {
  if (input.preview) return 0;
  if (input.payoutState === "ready" || input.payoutState === "processing" || input.payoutState === "paid") return 100;
  return payoutProgressPercent(input.availableCredits, input.payoutCredits);
}

export function deriveProgressResidueStrength(input: {
  preview: boolean;
  signedIn: boolean;
  signal: number;
}): number {
  if (input.preview || !input.signedIn) return 0;
  return clampPercent(input.signal);
}

export function deriveNetworkResidueStrength(input: {
  signedIn: boolean;
  active: number;
  waiting: number;
}): number {
  if (!input.signedIn) return 0;
  const depth = Number(input.active) > 0 ? Number(input.active) : Number(input.waiting);
  if (!Number.isFinite(depth) || depth <= 0) return 0;
  return clampPercent((depth / NETWORK_RESIDUE_MILESTONE) * 100);
}
