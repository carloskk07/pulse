export type UserNextActionKind =
  | "sign_in"
  | "claim"
  | "waiting"
  | "standby";

export type UserNextAction = {
  kind: UserNextActionKind;
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel: string;
  href: string;
};

export function getUserNextAction(input: {
  signedIn: boolean;
  preview: boolean;
  pulseFundingReady: boolean;
  claimReady: boolean;
  nextClaimAt: string | null;
}): UserNextAction {
  if (!input.signedIn) {
    return {
      kind: "sign_in",
      eyebrow: "Start here",
      title: "Enter your circuit.",
      detail: "Sign in once to see your real Pulse, progress and Vault state.",
      actionLabel: "Sign in",
      href: "/auth?next=/dashboard",
    };
  }

  if (!input.pulseFundingReady) {
    return {
      kind: "standby",
      eyebrow: "Pulse status",
      title: "Your history is safe while rewards are paused.",
      detail: "Nothing is lost and no action is required. Check again when funded Pulses return.",
      actionLabel: "Refresh Pulse",
      href: "/dashboard",
    };
  }

  if (input.claimReady) {
    return {
      kind: "claim",
      eyebrow: "Ready now",
      title: "Your next Pulse is ready.",
      detail: "Claim the funded reward and keep your real progress moving.",
      actionLabel: "Claim Pulse",
      href: "/dashboard",
    };
  }

  return {
    kind: "waiting",
    eyebrow: "Next Pulse",
    title: "Your next reward window is forming.",
    detail: input.nextClaimAt
      ? "Return when the live countdown reaches zero. You can set one reminder if useful."
      : "Your next eligibility window will appear here automatically.",
    actionLabel: "View Pulse",
    href: "/dashboard",
  };
}

export type WalletPresentation = {
  eyebrow: string;
  title: string;
  detail: string;
  buttonLabel: string;
  destinationEnabled: boolean;
  submitEnabled: boolean;
};

export function getWalletPresentation(input: {
  signedIn: boolean;
  preview: boolean;
  payoutPackReady: boolean;
  payoutCredits: number | null;
  availableCredits: number;
  readProofReady: boolean;
  sendScopeProofReady: boolean;
  activeWithdrawalStatus: "requested" | "held" | "submitted" | null;
  recoveryAuthorityReady: boolean;
  formattedMissingAmount: string | null;
}): WalletPresentation {
  if (input.activeWithdrawalStatus === "held") {
    return {
      eyebrow: "Payment protected",
      title: "Your payout is safely reserved.",
      detail: "No duplicate payment can be created while this request is under review.",
      buttonLabel: "Under review",
      destinationEnabled: false,
      submitEnabled: false,
    };
  }

  if (input.activeWithdrawalStatus) {
    return {
      eyebrow: "Payment in progress",
      title: "One payout. One protected request.",
      detail: input.recoveryAuthorityReady
        ? "Continue the same payout request without creating a duplicate."
        : "No new payment will be created while the current request is being resolved.",
      buttonLabel: input.recoveryAuthorityReady ? "Continue payout" : "Payment processing",
      destinationEnabled: false,
      submitEnabled: input.recoveryAuthorityReady,
    };
  }

  if (!input.signedIn) {
    return {
      eyebrow: "Vault",
      title: "Sign in to use your Vault.",
      detail: "Your live balance and withdrawal eligibility appear after sign-in.",
      buttonLabel: "Sign in required",
      destinationEnabled: false,
      submitEnabled: false,
    };
  }

  if (input.preview || !input.payoutPackReady || !input.readProofReady || !input.sendScopeProofReady) {
    return {
      eyebrow: "Vault protected",
      title: "Withdrawals are temporarily unavailable.",
      detail: "Your balance stays intact while the payout connection is being completed.",
      buttonLabel: "Withdrawal unavailable",
      destinationEnabled: false,
      submitEnabled: false,
    };
  }

  if (!input.payoutCredits || input.availableCredits < input.payoutCredits) {
    return {
      eyebrow: "Vault progress",
      title: "Keep building toward your payout.",
      detail: input.formattedMissingAmount
        ? `${input.formattedMissingAmount} remains to reach the current withdrawal target.`
        : "Your current payout target will appear automatically.",
      buttonLabel: input.formattedMissingAmount ? `${input.formattedMissingAmount} to go` : "Keep earning",
      destinationEnabled: true,
      submitEnabled: false,
    };
  }

  return {
    eyebrow: "Ready",
    title: "Your Vault is ready to withdraw.",
    detail: "Enter your FaucetPay destination. PulseCircuit verifies the protected payout path before reserving value.",
    buttonLabel: "Withdraw",
    destinationEnabled: true,
    submitEnabled: true,
  };
}

export type OperatorNextAction = {
  level: "action" | "review" | "clear";
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel: string;
  href: string;
};

export function getOperatorNextAction(input: {
  faucetPayConnected: boolean;
  paidWithdrawalCount: number;
  receiptProven: boolean;
  productReady: boolean;
  releaseReady: boolean;
}): OperatorNextAction {
  if (!input.faucetPayConnected) {
    return {
      level: "action",
      eyebrow: "Next action",
      title: "Complete FaucetPay connection.",
      detail: "One provider-side confirmation closes the protected payment authority setup. No payout is sent by this step.",
      actionLabel: "Open FaucetPay setup",
      href: "/admin/faucetpay",
    };
  }

  if (input.paidWithdrawalCount < 1) {
    return {
      level: "action",
      eyebrow: "Next action",
      title: "Prepare one controlled payout test.",
      detail: "The payment connection is ready. Review the smallest explicitly approved test before any real money movement.",
      actionLabel: "Review payout test",
      href: "/admin/faucetpay",
    };
  }

  if (!input.receiptProven) {
    return {
      level: "action",
      eyebrow: "Next action",
      title: "Confirm the exact destination receipt.",
      detail: "The real payout exists; the launch chain still needs proof that the same payment was actually received.",
      actionLabel: "Confirm receipt",
      href: "/admin/faucetpay",
    };
  }

  if (!input.productReady || !input.releaseReady) {
    return {
      level: "review",
      eyebrow: "Next action",
      title: "Close the remaining launch blockers.",
      detail: "The financial path is proven. Focus only on the remaining product or canonical release blockers.",
      actionLabel: "Open readiness",
      href: "/admin/product",
    };
  }

  return {
    level: "clear",
    eyebrow: "Operations",
    title: "Core launch gates are clear.",
    detail: "Keep monitoring real activity and only open growth systems deliberately.",
    actionLabel: "View operations",
    href: "/admin",
  };
}
