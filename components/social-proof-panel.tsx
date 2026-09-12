import { Check, Shield, Spark, Trend } from "@/components/icons";
import type { PublicSocialProof } from "@/lib/social-proof";

function compact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "verified";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(timestamp));
}

function metricsFor(proof: PublicSocialProof) {
  if (proof.stage === "early") {
    return [
      { value: "Early access", label: "Founding cohort is live", icon: Spark },
      { value: proof.rewardEventCount > 0 ? "Verified" : "Ready", label: "Ledger-backed rewards", icon: Check },
      proof.paidWithdrawalCount > 0
        ? { value: compact(proof.paidWithdrawalCount), label: "Paid withdrawals", icon: Trend }
        : { value: "Protected", label: "Payout state machine", icon: Shield },
    ];
  }

  return [
    { value: compact(proof.memberCount), label: "Verified members", icon: Spark },
    { value: compact(proof.rewardEventCount), label: "Verified reward events", icon: Check },
    proof.paidWithdrawalCount > 0
      ? { value: compact(proof.paidWithdrawalCount), label: "Paid withdrawals", icon: Trend }
      : { value: "Protected", label: "Payout state machine", icon: Shield },
  ];
}

export function SocialProofPanel({ proof }: { proof: PublicSocialProof }) {
  const metrics = metricsFor(proof);
  const hasActivity = proof.recentActivity.length > 0;

  return (
    <section className="social-proof-section shell" aria-labelledby="social-proof-title">
      <div className="social-proof-head">
        <div>
          <span className="section-kicker">Live proof · no vanity numbers</span>
          <h2 id="social-proof-title">Real activity, shown only when it is real.</h2>
        </div>
        <p>
          We never inflate online users, earnings or payout counts. The proof layer upgrades itself automatically as verified activity grows.
        </p>
      </div>

      <div className="social-proof-grid">
        <div className="proof-metrics">
          {metrics.map(({ value, label, icon: Icon }) => (
            <article className="proof-metric" key={label}>
              <span className="proof-icon"><Icon /></span>
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>

        <article className="proof-feed">
          <div className="proof-feed-head">
            <div><span className="live-dot" /><strong>Recent verified activity</strong></div>
            <small>Anonymous by design</small>
          </div>

          {hasActivity ? (
            <div className="proof-feed-list">
              {proof.recentActivity.map((activity, index) => (
                <div className="proof-feed-row" key={`${activity.occurredAt}-${index}`}>
                  <span className="proof-feed-check"><Check /></span>
                  <div><strong>{activity.label}</strong><small>{activity.credits.toLocaleString("en-US")} credits</small></div>
                  <time dateTime={activity.occurredAt}>{relativeTime(activity.occurredAt)}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="proof-feed-empty">
              <Spark />
              <div><strong>Founding activity is opening now.</strong><span>The public feed appears automatically after the first verified reward.</span></div>
            </div>
          )}

          <div className="proof-contract"><Shield /><span>Public proof never exposes user IDs, emails or destinations.</span></div>
        </article>
      </div>
    </section>
  );
}
