import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Check, Shield, Spark, Trend, Users } from "@/components/icons";
import { CircuitShareStudio } from "@/components/circuit-share-studio";
import { NextCircuitPanel } from "@/components/next-circuit-panel";
import { getCircuitAchievements, getNextCircuitAchievement } from "@/lib/circuit-achievements";
import { getCircuitProgress } from "@/lib/circuit-progress";
import { getRewardSnapshot, trustLabel } from "@/lib/reward-state";
import { getWeeklyPulseSummary } from "@/lib/retention-summary";
import { getPublicSocialProof } from "@/lib/social-proof";

export const metadata = { title: "Momentum" };
export const dynamic = "force-dynamic";

function trendCopy(trend: "starting" | "rising" | "steady" | "cooling") {
  if (trend === "rising") return "You are building more momentum than the previous seven days.";
  if (trend === "steady") return "Your rhythm is holding steady. The next milestone is still moving closer.";
  if (trend === "cooling") return "Your recent rhythm is quieter. One funded Pulse starts the next cycle.";
  return "Your first real Pulse starts the pattern.";
}

export default async function ProgressPage() {
  const [state, weekly, community] = await Promise.all([
    getRewardSnapshot(),
    getWeeklyPulseSummary(),
    getPublicSocialProof(),
  ]);

  const signal = getCircuitProgress({
    hourlyClaimCount: state.hourlyClaimCount,
    streakDays: state.streakDays,
    trustLevel: state.trustLevel,
  });
  const trust = trustLabel(state.trustLevel);
  const achievements = getCircuitAchievements({
    hourlyClaimCount: state.hourlyClaimCount,
    streakDays: state.streakDays,
    trustLevel: state.trustLevel,
    signal: signal.signal,
  });
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked);
  const unlocked = unlockedAchievements.length;
  const strongestAchievement = unlockedAchievements.at(-1)?.title ?? null;
  const nextAchievement = getNextCircuitAchievement(achievements);

  return (
    <AppShell active="progress">
      <div className="app-page-head pc-progress-head pc-v5-progress-head">
        <div>
          <span className="app-eyebrow">Your momentum</span>
          <h1>See what your consistency is becoming.</h1>
          <p>Every funded Pulse leaves a real trace. Rhythm shows return, Signal shows momentum and achievements mark the milestones you actually reached.</p>
        </div>
        {!state.preview && state.signedIn ? <Link className="button pc-v5-primary" href="#circuit-moments">Share a milestone</Link> : <Link className="button pc-v5-primary" href="/auth?next=/progress">Build your circuit</Link>}
      </div>

      <section className="pc-progress-hero pc-v5-progress-hero">
        <article className="pc-identity-card pc-v5-identity-card">
          <div className="pc-identity-orbit" aria-hidden="true"><i /><i /><i /></div>
          <div className="pc-identity-top"><span><Spark /> Circuit Signal</span><b>{state.preview ? "Preview" : signal.stage}</b></div>
          <div className="pc-identity-score"><strong>{state.preview ? "—" : signal.signal}</strong><span>/100</span></div>
          <div className="pc-identity-meta"><span><small>Rhythm</small><strong>{state.preview ? "—" : `${state.streakDays}d`}</strong></span><span><small>Trust</small><strong>{state.preview ? "—" : trust}</strong></span><span><small>Pulses</small><strong>{state.preview ? "—" : state.hourlyClaimCount}</strong></span></div>
          <p>Signal reflects real product history. It is progress, not balance.</p>
        </article>

        <div className="pc-weekly-stack">
          <article className="pc-weekly-card pc-v5-weekly-card">
            <div className="pc-card-label"><Trend /> Your last 7 days</div>
            <div className="pc-weekly-numbers"><span><strong>{weekly.available ? weekly.claims7d : "—"}</strong><small>Pulses</small></span><span><strong>{weekly.available ? weekly.activeDays7d : "—"}</strong><small>active days</small></span><span><strong>{weekly.available ? weekly.previousClaims7d : "—"}</strong><small>prior 7d</small></span></div>
            <p>{weekly.available ? trendCopy(weekly.trend) : "Sign in with live history to reveal your first weekly pattern."}</p>
          </article>
          <article className="pc-retention-callout pc-v5-retention-callout"><Shield /><div><strong>Momentum without pressure.</strong><p>Pulsercuit gives you a next action and visible progress without fake urgency, random prize mechanics or hidden multipliers.</p></div></article>
        </div>
      </section>

      <NextCircuitPanel
        claimIntervalMinutes={state.claimIntervalMinutes}
        claimReady={state.claimReady}
        nextAchievement={nextAchievement}
        nextClaimAt={state.nextClaimAt}
        nextStageAt={signal.nextStageAt}
        preview={state.preview}
        pulseFundingReady={state.pulseFundingReady}
        signal={signal.signal}
        signalStage={signal.stage}
        signedIn={state.signedIn}
      />

      {!state.preview && state.signedIn ? (
        <CircuitShareStudio
          achievement={strongestAchievement}
          days={state.streakDays}
          pulseCount={state.hourlyClaimCount}
          signal={signal.signal}
          stage={signal.stage}
        />
      ) : null}

      <section className="app-section pc-v5-app-section">
        <div className="app-section-head"><div><span className="app-eyebrow">Milestones</span><h2>{state.preview ? "Real history unlocks your circuit." : `${unlocked} of ${achievements.length} reached`}</h2></div><span className="pc-subtle-status">earned from factual activity</span></div>
        <div className="pc-achievement-grid">
          {achievements.map((achievement) => (
            <article className={`pc-achievement ${achievement.unlocked && !state.preview ? "unlocked" : "locked"} tone-${achievement.tone}`} key={achievement.id}>
              <div className="pc-achievement-mark">{achievement.unlocked && !state.preview ? <Check /> : <span />}</div>
              <div><small>{achievement.unlocked && !state.preview ? "Reached" : "Next"}</small><h3>{achievement.title}</h3><p>{achievement.description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="app-section pc-v5-app-section">
        <div className="app-section-head"><div><span className="app-eyebrow">Network proof</span><h2>Real activity, even when the number is small.</h2></div><Link href="/proof">Open Proof <ArrowUpRight /></Link></div>
        <div className="pc-community-grid">
          <article><Users /><span>Members</span><strong>{community.available ? community.memberCount.toLocaleString("en-US") : "—"}</strong><small>real profiles</small></article>
          <article><Spark /><span>Reward events</span><strong>{community.available ? community.rewardEventCount.toLocaleString("en-US") : "—"}</strong><small>ledger-confirmed</small></article>
          <article><Check /><span>Paid withdrawals</span><strong>{community.available ? community.paidWithdrawalCount.toLocaleString("en-US") : "—"}</strong><small>provider-completed</small></article>
        </div>
        <div className="pc-community-note"><i />Pulsercuit never inflates the network to manufacture popularity.</div>
      </section>

      <section className="pc-progress-cta pc-v5-progress-cta">
        <div><span className="app-eyebrow">Keep the circuit moving</span><h2>Your next funded Pulse is the next meaningful step.</h2><p>Return when the live window opens. One real action is worth more than ten cosmetic badges.</p></div>
        <Link className="button button-lg pc-v5-primary" href="/dashboard">Return to Pulse <ArrowUpRight /></Link>
      </section>
    </AppShell>
  );
}
