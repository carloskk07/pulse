import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Check, Shield, Spark, Trend, Users } from "@/components/icons";
import { CircuitShareStudio } from "@/components/circuit-share-studio";
import { getCircuitAchievements } from "@/lib/circuit-achievements";
import { getCircuitProgress } from "@/lib/circuit-progress";
import { getRewardSnapshot, trustLabel } from "@/lib/reward-state";
import { getWeeklyPulseSummary } from "@/lib/retention-summary";
import { getPublicSocialProof } from "@/lib/social-proof";

export const metadata = { title: "Progress" };
export const dynamic = "force-dynamic";

function trendCopy(trend: "starting" | "rising" | "steady" | "cooling") {
  if (trend === "rising") return "Your activity is rising versus the previous seven days.";
  if (trend === "steady") return "Your activity is holding steady versus the previous seven days.";
  if (trend === "cooling") return "Your activity is quieter than the previous seven days.";
  return "Your first factual weekly pattern starts with a funded Pulse.";
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

  return (
    <AppShell active="progress">
      <div className="app-page-head pc-progress-head">
        <div>
          <span className="app-eyebrow">Retention layer</span>
          <h1>Your circuit, over time.</h1>
          <p>Rhythm, Signal, achievements and community context come only from real product history. None of them changes your balance or payout eligibility.</p>
        </div>
        {!state.preview && state.signedIn ? <Link className="button" href="#circuit-moments">Share your circuit</Link> : <Link className="button" href="/auth?next=/progress">Sign in</Link>}
      </div>

      <section className="pc-progress-hero">
        <article className="pc-identity-card">
          <div className="pc-identity-orbit" aria-hidden="true"><i /><i /><i /></div>
          <div className="pc-identity-top"><span><Spark /> Circuit Signal</span><b>{state.preview ? "Preview" : signal.stage}</b></div>
          <div className="pc-identity-score"><strong>{state.preview ? "—" : signal.signal}</strong><span>/100</span></div>
          <div className="pc-identity-meta"><span><small>Rhythm</small><strong>{state.preview ? "—" : `${state.streakDays}d`}</strong></span><span><small>Trust</small><strong>{state.preview ? "—" : trust}</strong></span><span><small>Pulses</small><strong>{state.preview ? "—" : state.hourlyClaimCount}</strong></span></div>
          <p>This is an identity surface, not a financial instrument. Signal never creates credits.</p>
        </article>

        <div className="pc-weekly-stack">
          <article className="pc-weekly-card">
            <div className="pc-card-label"><Trend /> Last 7 days</div>
            <div className="pc-weekly-numbers"><span><strong>{weekly.available ? weekly.claims7d : "—"}</strong><small>Pulses</small></span><span><strong>{weekly.available ? weekly.activeDays7d : "—"}</strong><small>active days</small></span><span><strong>{weekly.available ? weekly.previousClaims7d : "—"}</strong><small>prior 7d</small></span></div>
            <p>{weekly.available ? trendCopy(weekly.trend) : "Sign in with live history to build a factual weekly recap."}</p>
          </article>
          <article className="pc-retention-callout"><Shield /><div><strong>Built for return, not pressure.</strong><p>Pulsercuit shows progress and a next action without fake urgency, randomized prizes or hidden financial multipliers.</p></div></article>
        </div>
      </section>

      {!state.preview && state.signedIn ? (
        <CircuitShareStudio
          achievement={strongestAchievement}
          days={state.streakDays}
          pulseCount={state.hourlyClaimCount}
          signal={signal.signal}
          stage={signal.stage}
        />
      ) : null}

      <section className="app-section">
        <div className="app-section-head"><div><span className="app-eyebrow">Circuit achievements</span><h2>{state.preview ? "Real history unlocks the grid." : `${unlocked} of ${achievements.length} unlocked`}</h2></div><span className="pc-subtle-status">factual milestones only</span></div>
        <div className="pc-achievement-grid">
          {achievements.map((achievement) => (
            <article className={`pc-achievement ${achievement.unlocked && !state.preview ? "unlocked" : "locked"} tone-${achievement.tone}`} key={achievement.id}>
              <div className="pc-achievement-mark">{achievement.unlocked && !state.preview ? <Check /> : <span />}</div>
              <div><small>{achievement.unlocked && !state.preview ? "Unlocked" : "Locked"}</small><h3>{achievement.title}</h3><p>{achievement.description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="app-section">
        <div className="app-section-head"><div><span className="app-eyebrow">Community circuit</span><h2>Context without fake social proof.</h2></div><Link href="/proof">Open Proof <ArrowUpRight /></Link></div>
        <div className="pc-community-grid">
          <article><Users /><span>Members</span><strong>{community.available ? community.memberCount.toLocaleString("en-US") : "—"}</strong><small>real profiles</small></article>
          <article><Spark /><span>Reward events</span><strong>{community.available ? community.rewardEventCount.toLocaleString("en-US") : "—"}</strong><small>ledger-confirmed</small></article>
          <article><Check /><span>Paid withdrawals</span><strong>{community.available ? community.paidWithdrawalCount.toLocaleString("en-US") : "—"}</strong><small>provider-completed</small></article>
        </div>
        <div className="pc-community-note"><i />Zeros stay visible. Pulsercuit does not inflate activity to make the network look larger.</div>
      </section>

      <section className="pc-progress-cta">
        <div><span className="app-eyebrow">Next loop</span><h2>Return when the next funded Pulse opens.</h2><p>Build history because the product is useful, not because a synthetic timer is pressuring you.</p></div>
        <Link className="button button-lg" href="/dashboard">Back to Pulse <ArrowUpRight /></Link>
      </section>
    </AppShell>
  );
}
