import Link from "next/link";
import type { CSSProperties } from "react";
import type { ProductJourney } from "@/lib/product-experience";

export function ValueFlow({ journey }: { journey: ProductJourney }) {
  const { stage, balance, payoutProgress, payoutState, payoutLabel } = journey;
  const progress = Math.max(0, Math.min(100, Math.round(payoutProgress)));
  const style = { "--pc-value-progress": `${progress}%` } as CSSProperties;

  return (
    <nav
      className={`pc-value-flow is-${stage} payout-${payoutState}`}
      aria-label="Reward value path"
      style={style}
    >
      <Link className={stage === "earn" ? "active" : ""} href="/earn" aria-current={stage === "earn" ? "step" : undefined}>
        <span className="pc-value-flow-index">01</span>
        <span className="pc-value-flow-copy">
          <small>Earn</small>
          <strong>Build value</strong>
        </span>
      </Link>

      <span className="pc-value-flow-line" aria-hidden="true"><i /></span>

      <Link className={stage === "balance" ? "active" : ""} href="/wallet" aria-current={stage === "balance" ? "step" : undefined}>
        <span className="pc-value-flow-index">02</span>
        <span className="pc-value-flow-copy">
          <small>Balance</small>
          <strong>{balance}</strong>
        </span>
      </Link>

      <span className="pc-value-flow-line is-payout" aria-hidden="true"><i /></span>

      <Link className={stage === "payout" ? "active" : ""} href="/wallet" aria-current={stage === "payout" ? "step" : undefined}>
        <span className="pc-value-flow-index">03</span>
        <span className="pc-value-flow-copy">
          <small>Payout</small>
          <strong>{payoutLabel}</strong>
        </span>
      </Link>
    </nav>
  );
}
