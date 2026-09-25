import { formatUsdFromCredits, type RewardSnapshot } from "@/lib/reward-state";
import {
  deriveEarningEvent,
  deriveEarningPhase,
  deriveNetworkEvent,
  deriveWalletCore,
  payoutProgressPercent,
  type CorePayoutFlowState,
  type CoreProductEvent,
  type CoreProductPhase,
  type CoreValueFlowStage,
} from "@/lib/product-experience-core";

export type ProductSurface = "reward" | "earn" | "balance" | "payout" | "progress" | "network";
export type ProductPhase = CoreProductPhase;
export type ProductEvent = CoreProductEvent;
export type ValueFlowStage = CoreValueFlowStage;
export type PayoutFlowState = CorePayoutFlowState;

export type ProductJourney = {
  stage: ValueFlowStage;
  balance: string;
  payoutProgress: number;
  payoutState: PayoutFlowState;
  payoutLabel: string;
};

export type ProductExperience = {
  surface: ProductSurface;
  phase: ProductPhase;
  event: ProductEvent;
  journey?: ProductJourney;
};

function journeyBalance(snapshot: RewardSnapshot) {
  return snapshot.preview ? "—" : formatUsdFromCredits(snapshot.availableCredits);
}

function buildJourney(
  snapshot: RewardSnapshot,
  payoutCredits: number | null,
  stage: ValueFlowStage,
  payoutState: PayoutFlowState,
  payoutLabel: string,
): ProductJourney {
  return {
    stage,
    balance: journeyBalance(snapshot),
    payoutProgress: snapshot.preview ? 0 : payoutProgressPercent(snapshot.availableCredits, payoutCredits),
    payoutState: snapshot.preview ? "paused" : payoutState,
    payoutLabel: snapshot.preview ? "Preparing" : payoutLabel,
  };
}

export function getEarningExperience({
  surface,
  snapshot,
  payoutCredits,
  claimSettled,
}: {
  surface: "reward" | "earn";
  snapshot: RewardSnapshot;
  payoutCredits: number | null;
  claimSettled?: boolean;
}): ProductExperience {
  const progress = payoutProgressPercent(snapshot.availableCredits, payoutCredits);
  const payoutState: PayoutFlowState = snapshot.preview || !payoutCredits
    ? "paused"
    : progress >= 100
      ? "ready"
      : "building";
  const payoutLabel = !payoutCredits
    ? "Preparing"
    : progress >= 100
      ? "Ready"
      : `${progress}% to target`;

  return {
    surface,
    phase: deriveEarningPhase({
      preview: snapshot.preview,
      pulseFundingReady: snapshot.pulseFundingReady,
      claimReady: snapshot.claimReady,
    }),
    event: snapshot.preview ? "none" : deriveEarningEvent({ claimSettled: Boolean(claimSettled) }),
    journey: buildJourney(snapshot, payoutCredits, "earn", payoutState, payoutLabel),
  };
}

export function getWalletExperience({
  snapshot,
  payoutCredits,
  canWithdraw,
  hasActiveWithdrawal,
  paid,
  payoutReadyEvent = false,
}: {
  snapshot: RewardSnapshot;
  payoutCredits: number | null;
  canWithdraw: boolean;
  hasActiveWithdrawal: boolean;
  paid: boolean;
  payoutReadyEvent?: boolean;
}): ProductExperience {
  const progress = payoutProgressPercent(snapshot.availableCredits, payoutCredits);
  const core = deriveWalletCore({
    preview: snapshot.preview,
    payoutConfigured: Boolean(payoutCredits),
    canWithdraw,
    hasActiveWithdrawal,
    paid,
  });
  const payoutLabel = core.payoutState === "paid"
    ? "Paid"
    : core.payoutState === "processing"
      ? "In progress"
      : core.payoutState === "ready"
        ? "Ready"
        : payoutCredits
          ? `${progress}% to target`
          : "Preparing";

  const event: CoreProductEvent = paid
    ? "payout-complete"
    : hasActiveWithdrawal
      ? "payout-processing"
      : payoutReadyEvent
        ? "payout-ready"
        : "none";

  return {
    surface: core.surface,
    phase: core.phase,
    event,
    journey: buildJourney(snapshot, payoutCredits, core.stage, core.payoutState, payoutLabel),
  };
}

export function getProgressExperience(snapshot: RewardSnapshot): ProductExperience {
  return {
    surface: "progress",
    phase: snapshot.preview ? "preview" : snapshot.signedIn ? "live" : "idle",
    event: "none",
  };
}

export function getNetworkExperience({
  signedIn,
  active,
  waiting,
  referralConfirmed = false,
}: {
  signedIn: boolean;
  active: number;
  waiting: number;
  referralConfirmed?: boolean;
}): ProductExperience {
  return {
    surface: "network",
    phase: !signedIn ? "idle" : active > 0 || waiting > 0 ? "live" : "idle",
    event: deriveNetworkEvent({ signedIn, active: referralConfirmed ? 1 : 0 }),
  };
}

export { payoutProgressPercent };
