import Link from "next/link";
import { ArrowUpRight, Check, Shield, Spark, Trend } from "@/components/icons";
import { PulseCountdown } from "@/components/pulse-countdown";
import type { CircuitAchievement } from "@/lib/circuit-achievements";

function remainingLabel(achievement: CircuitAchievement) {
  const remaining = Math.max(0, achievement.remaining);
  const plural = remaining === 1 ? "" : "s";
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
  const canScheduleReturn = pulseFundingReady && !claimReady && Boolean(nextClaimAt);
  const primary = !pulseFundingReady
    ? {
        eyebrow: "Standby",
        title: "Your circuit is holding position.",
        detail: "History stays intact until funded rewards return.",
        action: "Check Pulse",
        icon: Shield,
      }
    : claimReady
      ? {
          eyebrow: "Ready now",
          title: "Your funded Pulse is waiting.",
          detail: `The ${claimIntervalMinutes}-minute rolling window is open.`,
          action: "Claim Pulse",
          icon: Spark,
        }
      : {
          eyebrow: "Next return",
          title: "Your next Pulse is forming.",
          detail: "The timer follows your last real claim.",
          action: "Open Pulse",
          icon: Trend,
        };
  const PrimaryIcon = primary.icon;

  return (
    <section className="pc-next-circuit pc-luxe-next-move" aria-labelledby="next-circuit-title">
      <div className="pc-next-circuit-head">
        <div>
          <span className="app-eyebrow">Next move</span>
          <h2 id="next-circuit-title">Keep the climb obvious.</h2>
        </div>
      </div>

      <div className="pc-next-circuit-grid">
        <article className={`pc-next-primary ${pulseFundingReady ? claimReady ? "is-ready" : "is-forming" : "is-standby"}`}>
          <div className="pc-next-primary-top"><span><PrimaryIcon /> {primary.eyebrow}</span><small>live state</small></div>
          <h3>{primary.title}</h3>
          {!pulseFundingReady ? <div className="pc-next-state-word">STANDBY</div> : claimReady ? <div className="pc-next-state-word ready">READY</div> : <div className="pc-next-countdown"><PulseCountdown target={nextClaimAt} /></div>}
          <p>{primary.detail}</p>
          <div className="pc-next-action-row">
            <Link className="pc-next-action" href="/dashboard">{primary.action} <ArrowUpRight /></Link>
            {canScheduleReturn ? <a className="pc-next-reminder" href="/api/return-reminder">Set reminder <ArrowUpRight /></a> : null}
          </div>
        </article>

        <div className="pc-next-secondary-stack">
          <article className="pc-next-secondary">
            <div className="pc-next-secondary-label"><Check /> Next seal</div>
            {nextAchievement ? (
              <>
                <div className="pc-next-secondary-title"><strong>{nextAchievement.title}</strong><span>{remainingLabel(nextAchievement)} left</span></div>
                <div className="pc-next-progress"><span style={{ width: `${nextAchievement.progress}%` }} /></div>
              </>
            ) : (
              <>
                <div className="pc-next-secondary-title"><strong>Collection complete</strong><span>6 / 6</span></div>
                <div className="pc-next-progress"><span style={{ width: "100%" }} /></div>
              </>
            )}
          </article>

          <article className="pc-next-secondary">
            <div className="pc-next-secondary-label"><Spark /> Rank</div>
            <div className="pc-next-secondary-title"><strong>{signalStage}</strong><span>{nextStageAt === null ? "top rank" : `${signalRemaining} Signal to rise`}</span></div>
            <div className="pc-next-progress"><span style={{ width: `${Math.max(0, Math.min(100, signal))}%` }} /></div>
          </article>
        </div>
      </div>
    </section>
  );
}
