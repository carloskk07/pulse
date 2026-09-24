import { formatUsdFromCredits, type RewardSnapshot } from "@/lib/reward-state";

export type ProductSurface = "reward" | "earn" | "balance" | "payout" | "progress" | "network";
export type ProductPhase = "preview" | "paused" | "ready" | "charging" | "building" | "processing" | "complete" | "live" | "idle";
export type ValueFlowStage = "earn" | "balance" | "payout";
export type PayoutFlowState = "building" | "ready" | "processing" | "paid" | "paused";

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
  journey?: ProductJourney;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function payoutProgressPercent(availableCredits: number, payoutCredits: number | null) {
  if (!payoutCredits || payoutCredits <= 0) return 0;
  return clampPercent((Math.max(0, availableCredits) / payoutCredits) * 100);
}

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
}: {
  surface: "reward" | "earn";
  snapshot: RewardSnapshot;
  payoutCredits: number | null;
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

  const phase: ProductPhase = snapshot.preview
    ? "preview"
    : !snapshot.pulseFundingReady
      ? "paused"
      : snapshot.claimReady
        ? "ready"
        : "charging";

  return {
    surface,
    phase,
    journey: buildJourney(snapshot, payoutCredits, "earn", payoutState, payoutLabel),
  };
}

export function getWalletExperience({
  snapshot,
  payoutCredits,
  canWithdraw,
  hasActiveWithdrawal,
  paid,
}: {
  snapshot: RewardSnapshot;
  payoutCredits: number | null;
  canWithdraw: boolean;
  hasActiveWithdrawal: boolean;
  paid: boolean;
}): ProductExperience {
  const progress = payoutProgressPercent(snapshot.availableCredits, payoutCredits);
  const payoutState: PayoutFlowState = paid
    ? "paid"
    : hasActiveWithdrawal
      ? "processing"
      : canWithdraw
        ? "ready"
        : payoutCredits
          ? "building"
          : "paused";

  const surface: ProductSurface = payoutState === "ready" || payoutState === "processing" || payoutState === "paid"
    ? "payout"
    : "balance";
  const stage: ValueFlowStage = surface === "payout" ? "payout" : "balance";
  const phase: ProductPhase = snapshot.preview
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
  const payoutLabel = payoutState === "paid"
    ? "Paid"
    : payoutState === "processing"
      ? "In progress"
      : payoutState === "ready"
        ? "Ready"
        : payoutCredits
          ? `${progress}% to target`
          : "Preparing";

  return {
    surface,
    phase,
    journey: buildJourney(snapshot, payoutCredits, stage, payoutState, payoutLabel),
  };
}

export function getProgressExperience(snapshot: RewardSnapshot): ProductExperience {
  return {
    surface: "progress",
    phase: snapshot.preview ? "preview" : snapshot.signedIn ? "live" : "idle",
  };
}

export function getNetworkExperience({
  signedIn,
  active,
  waiting,
}: {
  signedIn: boolean;
  active: number;
  waiting: number;
}): ProductExperience {
  return {
    surface: "network",
    phase: !signedIn ? "idle" : active > 0 || waiting > 0 ? "live" : "idle",
  };
}
