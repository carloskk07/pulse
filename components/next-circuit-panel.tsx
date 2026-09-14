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
        eyebrow: "Safe standby",
        title: "Your history stays ready even while rewards are paused.",
        detail: "No fake countdown appears when the reward rail is unfunded. Your existing momentum stays intact until funding returns.",
        action: "Check Pulse status",
        icon: Shield,
      }
    : claimReady
      ? {
          eyebrow: "Ready now",
          title: "Your funded Pulse is the next move.",
          detail: `Your rolling ${claimIntervalMinutes}-minute window is open. Final eligibility is still confirmed by the live server before value is written.`,
          action: "Claim your Pulse",
          icon: Spark,
        }
      : {
          eyebrow: "Next return",
          title: "Your next Pulse is forming.",
          detail: "The countdown follows your last real claim and the live rolling interval, so the timing belongs to your actual history.",
          action: "Open Pulse",
          icon: Trend,
        };
  const PrimaryIcon = primary.icon;

  return (
    <section className="pc-next-circuit pc-v5-next-circuit" aria-labelledby="next-circuit-title">
      <div className="pc-next-circuit-head">
        <div>
          <span className="app-eyebrow">Your next move</span>
          <h2 id="next-circuit-title">Keep momentum obvious.</h2>
        </div>
        <p>See the next funded action first, then the closest milestone already supported by your real history.</p>
      </div>

      <div className="pc-next-circuit-grid">
        <article className={`pc-next-primary ${pulseFundingReady ? claimReady ? "is-ready" : "is-forming" : "is-standby"}`}>
          <div className="pc-next-primary-top"><span><PrimaryIcon /> {primary.eyebrow}</span><small>live state</small></div>
          <h3>{primary.title}</h3>
          {!pulseFundingReady ? <div className="pc-next-state-word">STANDBY</div> : claimReady ? <div className="pc-next-state-word ready">READY</div> : <div className="pc-next-countdown"><PulseCountdown target={nextClaimAt} /></div>}
          <p>{primary.detail}</p>
          <div className="pc-next-action-row">
            <Link className="pc-next-action" href="/dashboard">{primary.action} <ArrowUpRight /></Link>
            {canScheduleReturn ? <a className="pc-next-reminder" href="/api/return-reminder">Remind me <ArrowUpRight /></a> : null}
          </div>
          {canScheduleReturn ? <small className="pc-next-reminder-note">Calendar reminder only. It marks the eligibility window, not a guaranteed reward.</small> : null}
        </article>

        <div className="pc-next-secondary-stack">
          <article className="pc-next-secondary">
            <div className="pc-next-secondary-label"><Check /> Closest milestone</div>
            {nextAchievement ? (
              <>
                <div className="pc-next-secondary-title"><strong>{nextAchievement.title}</strong><span>{remainingLabel(nextAchievement)} left</span></div>
                <div className="pc-next-progress"><span style={{ width: `${nextAchievement.progress}%` }} /></div>
                <p>{nextAchievement.description}</p>
              </>
            ) : (
              <>
                <div className="pc-next-secondary-title"><strong>Current set complete</strong><span>6 / 6</span></div>
                <div className="pc-next-progress"><span style={{ width: "100%" }} /></div>
                <p>You reached every current milestone. Pulsercuit does not invent a target just to keep a meter moving.</p>
              </>
            )}
          </article>

          <article className="pc-next-secondary">
            <div className="pc-next-secondary-label"><Spark /> Circuit Signal</div>
            <div className="pc-next-secondary-title"><strong>{signal}/100 · {signalStage}</strong><span>{nextStageAt === null ? "top stage" : `${signalRemaining} points to next stage`}</span></div>
            <div className="pc-next-progress"><span style={{ width: `${Math.max(0, Math.min(100, signal))}%` }} /></div>
            <p>Signal turns real Pulse, rhythm and Trust history into visible momentum. It never changes your balance.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
