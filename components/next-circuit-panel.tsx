import Link from "next/link";
import { ArrowUpRight, Check, Shield, Spark, Trend } from "@/components/icons";
import { PulseCountdown } from "@/components/pulse-countdown";
import type { CircuitAchievement } from "@/lib/circuit-achievements";

function remainingLabel(achievement: CircuitAchievement) {
  const remaining = Math.max(0, achievement.remaining);
  const plural = remaining === 1 ? "" : achievement.unit === "day" ? "s" : "s";
  return `${remaining} ${achievement.unit}${plural}`;
}

export function NextCircuitPanel({
  signedIn,
  preview,
  pulseFundingReady,
  claimReady,
  nextClaimAt,
  claimIntervalMinutes,
  signal,
  signalStage,
  nextStageAt,
  nextAchievement,
}: {
  signedIn: boolean;
  preview: boolean;
  pulseFundingReady: boolean;
  claimReady: boolean;
  nextClaimAt: string | null;
  claimIntervalMinutes: number;
  signal: number;
  signalStage: string;
  nextStageAt: number | null;
  nextAchievement: CircuitAchievement | null;
}) {
  if (preview || !signedIn) return null;

  const signalRemaining = nextStageAt === null ? 0 : Math.max(0, nextStageAt - signal);
  const primary = !pulseFundingReady
    ? {
        eyebrow: "Safe standby",
        title: "No return promise while the reward rail is unfunded.",
        detail: "Pulsercuit will not manufacture a countdown around an unavailable reward. Your existing history stays intact.",
        action: "Open Pulse status",
        icon: Shield,
      }
    : claimReady
      ? {
          eyebrow: "Available now",
          title: "Your funded Pulse is the next move.",
          detail: `The rolling ${claimIntervalMinutes}-minute interval is complete. Claiming is still subject to the authoritative server checks.`,
          action: "Open your Pulse",
          icon: Spark,
        }
      : {
          eyebrow: "Next return",
          title: "Your next funded Pulse is forming.",
          detail: "This timer comes from your last authoritative claim and the live rolling interval — not from artificial urgency.",
          action: "Return to Pulse",
          icon: Trend,
        };
  const PrimaryIcon = primary.icon;

  return (
    <section className="pc-next-circuit" aria-labelledby="next-circuit-title">
      <div className="pc-next-circuit-head">
        <div>
          <span className="app-eyebrow">V4.3 · Next Circuit</span>
          <h2 id="next-circuit-title">One clear reason to return.</h2>
        </div>
        <p>Pulsercuit ranks only factual product state: the next funded window first, then the closest visible progress already supported by your history.</p>
      </div>

      <div className="pc-next-circuit-grid">
        <article className={`pc-next-primary ${pulseFundingReady ? claimReady ? "is-ready" : "is-forming" : "is-standby"}`}>
          <div className="pc-next-primary-top"><span><PrimaryIcon /> {primary.eyebrow}</span><small>server-derived</small></div>
          <h3>{primary.title}</h3>
          {!pulseFundingReady ? <div className="pc-next-state-word">STANDBY</div> : claimReady ? <div className="pc-next-state-word ready">READY</div> : <div className="pc-next-countdown"><PulseCountdown target={nextClaimAt} /></div>}
          <p>{primary.detail}</p>
          <Link className="pc-next-action" href="/dashboard">{primary.action} <ArrowUpRight /></Link>
        </article>

        <div className="pc-next-secondary-stack">
          <article className="pc-next-secondary">
            <div className="pc-next-secondary-label"><Check /> Closest factual milestone</div>
            {nextAchievement ? (
              <>
                <div className="pc-next-secondary-title"><strong>{nextAchievement.title}</strong><span>{remainingLabel(nextAchievement)} left</span></div>
                <div className="pc-next-progress"><span style={{ width: `${nextAchievement.progress}%` }} /></div>
                <p>{nextAchievement.description}</p>
              </>
            ) : (
              <>
                <div className="pc-next-secondary-title"><strong>Current achievement set complete</strong><span>6 / 6</span></div>
                <div className="pc-next-progress"><span style={{ width: "100%" }} /></div>
                <p>Your existing factual milestone set is complete. No synthetic target is added just to keep the meter moving.</p>
              </>
            )}
          </article>

          <article className="pc-next-secondary">
            <div className="pc-next-secondary-label"><Spark /> Circuit Signal</div>
            <div className="pc-next-secondary-title"><strong>{signal}/100 · {signalStage}</strong><span>{nextStageAt === null ? "top stage" : `${signalRemaining} points to next stage`}</span></div>
            <div className="pc-next-progress"><span style={{ width: `${Math.max(0, Math.min(100, signal))}%` }} /></div>
            <p>Signal remains display-only progress derived from real Pulse claims, rhythm and Trust history.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
