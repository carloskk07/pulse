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
  if (input.preview) {
    return {
      kind: "standby",
      eyebrow: "Hourly reward",
      title: "Hourly rewards are temporarily unavailable.",
      detail: "Your account remains unchanged. Check back soon.",
      actionLabel: "Check back soon",
      href: "/dashboard",
    };
  }

  if (!input.signedIn) {
    return {
      kind: "sign_in",
      eyebrow: "Start here",
      title: "Sign in to see your rewards.",
      detail: "See your next claim, balance, payout progress and extra earning options.",
      actionLabel: "Sign in",
      href: "/auth?next=/dashboard",
    };
  }

  if (!input.pulseFundingReady) {
    return {
      kind: "standby",
      eyebrow: "Hourly reward",
      title: "Rewards are paused for now.",
      detail: "Your balance and history are unchanged. Check back later.",
      actionLabel: "Refresh rewards",
      href: "/dashboard",
    };
  }

  if (input.claimReady) {
    return {
      kind: "claim",
      eyebrow: "Ready now",
      title: "Your next reward is ready.",
      detail: "Claim it now and add the value to your balance.",
      actionLabel: "Claim reward",
      href: "/dashboard",
    };
  }

  return {
    kind: "waiting",
    eyebrow: "Next claim",
    title: "Your next reward window is forming.",
    detail: input.nextClaimAt
      ? "Come back when the countdown reaches zero. Set a reminder if you want."
      : "Your next reward will appear here automatically.",
    actionLabel: "View reward",
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
  payoutPilotAllowed: boolean;
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
      eyebrow: "Balance",
      title: "Sign in to view your balance and payouts.",
      detail: "Your balance and payout progress appear after sign-in.",
      buttonLabel: "Sign in",
      destinationEnabled: false,
      submitEnabled: false,
    };
  }

  if (!input.payoutPilotAllowed) {
    return {
      eyebrow: "Payout access",
      title: "Payout access is opening gradually.",
      detail: "Your balance stays available while withdrawals remain limited.",
      buttonLabel: "Not available yet",
      destinationEnabled: false,
      submitEnabled: false,
    };
  }

  if (input.preview || !input.payoutPackReady || !input.readProofReady || !input.sendScopeProofReady) {
    return {
      eyebrow: "Payout",
      title: "Payouts are temporarily unavailable.",
      detail: "Your balance is unchanged. Try again later.",
      buttonLabel: "Withdrawal unavailable",
      destinationEnabled: false,
      submitEnabled: false,
    };
  }

  if (!input.payoutCredits || input.availableCredits < input.payoutCredits) {
    return {
      eyebrow: "Payout progress",
      title: "Keep building toward your payout.",
      detail: input.formattedMissingAmount
        ? `${input.formattedMissingAmount} remains to reach the current withdrawal target.`
        : "Your current payout target will appear automatically.",
      buttonLabel: input.formattedMissingAmount ? `${input.formattedMissingAmount} to go` : "Keep earning",
      destinationEnabled: false,
      submitEnabled: false,
    };
  }

  return {
    eyebrow: "Ready",
    title: "Your balance is ready to withdraw.",
    detail: "Enter your FaucetPay destination to continue.",
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
