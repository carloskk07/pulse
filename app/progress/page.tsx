import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Check, Shield, Spark, Trend } from "@/components/icons";
import { CircuitShareStudio } from "@/components/circuit-share-studio";
import { NextCircuitPanel } from "@/components/next-circuit-panel";
import { ProgressOrbitArtwork } from "@/components/pulse-visuals";
import { getCircuitAchievements, getNextCircuitAchievement } from "@/lib/circuit-achievements";
import { getCircuitProgress } from "@/lib/circuit-progress";
import { getRewardSnapshot } from "@/lib/reward-state";
import { getWeeklyPulseSummary } from "@/lib/retention-summary";

export const metadata = { title: "Progress" };
export const dynamic = "force-dynamic";

const ranks = ["Spark", "Flow", "Rhythm", "Circuit", "Resonance"] as const;

function trendCopy(trend: "starting" | "rising" | "steady" | "cooling") {
  if (trend === "rising") return "Your activity is increasing.";
  if (trend === "steady") return "Your return streak is holding.";
  if (trend === "cooling") return "One verified claim starts the next streak.";
  return "Your first verified claim starts the pattern.";
}

export default async function ProgressPage() {
  const [state, weekly] = await Promise.all([getRewardSnapshot(), getWeeklyPulseSummary()]);
  const signal = getCircuitProgress({
    hourlyClaimCount: state.hourlyClaimCount,
    streakDays: state.streakDays,
    trustLevel: state.trustLevel,
  });
  const achievements = getCircuitAchievements({
    hourlyClaimCount: state.hourlyClaimCount,
    streakDays: state.streakDays,
    trustLevel: state.trustLevel,
    signal: signal.signal,
  });
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked);
  const strongestAchievement = unlockedAchievements.at(-1)?.title ?? null;
  const nextAchievement = getNextCircuitAchievement(achievements);
  const shareReady = state.signedIn && !state.preview;
  const shareEntryHref = state.signedIn ? "#circuit-moments" : "/auth?next=/progress%23circuit-moments";

  return (
    <AppShell active="progress" userLabel={state.signedIn ? state.userLabel : undefined}>
      <div className="app-page-head pc-progress-head pc-luxe-momentum-head">
        <div>
          <span className="app-eyebrow">Progress</span>
          <h1>See what your activity has built.</h1>
          <p>Claims, return streaks and milestones turn verified activity into visible progress.</p>
        </div>
        <Link className="button pc-v5-primary" href={shareEntryHref}>{shareReady ? "Share progress" : state.signedIn ? "View share status" : "Sign in"}</Link>
      </div>

      <section className="pc-progress-hero pc-luxe-momentum-hero">
        <article className="pc-identity-card pc-luxe-prestige-card pc-v3-prestige-card">
          <div className="pc-luxe-prestige-halo" aria-hidden="true" />
          <div className="pc-v3-progress-orbit" aria-hidden="true"><ProgressOrbitArtwork /></div>
          <div className="pc-identity-top"><span><Spark /> Current rank</span><b>{state.preview ? "Preview" : signal.stage}</b></div>
          <div className="pc-luxe-rank-name">{state.preview ? "—" : signal.stage}</div>
          <div className="pc-identity-score"><strong>{state.preview ? "—" : signal.signal}</strong><span>/100</span></div>
          <div className="pc-identity-meta">
            <span><small>Return streak</small><strong>{state.preview ? "—" : state.streakDays + "d"}</strong></span>
            <span><small>Claims</small><strong>{state.preview ? "—" : state.hourlyClaimCount}</strong></span>
            <span><small>Next mark</small><strong>{state.preview ? "—" : nextAchievement?.title ?? "Current set complete"}</strong></span>
          </div>
        </article>

        {state.preview || !state.signedIn ? (
          <aside className="pc-visual-story pc-momentum-story" aria-labelledby="momentum-story-title">
            <div className="pc-visual-story-copy">
              <span className="app-eyebrow">Progress path</span>
              <h2 id="momentum-story-title">Five ranks. One clear path.</h2>
              <p>Your live position appears after your first eligible claim. Until then, you can see what comes next.</p>
              <div className="pc-v10-rank-preview" aria-label="Rank path">
                {ranks.map((rank, index) => <span key={rank}><i>{index + 1}</i><strong>{rank}</strong></span>)}
              </div>
            </div>
            <div className="pc-visual-story-flow" aria-hidden="true">
              <span>Claim</span><i /><span>Streak</span><i /><span>Rank</span>
            </div>
          </aside>
        ) : (
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
        )}
      </section>

      {shareReady ? (
        <CircuitShareStudio
          achievement={strongestAchievement}
          days={state.streakDays}
          pulseCount={state.hourlyClaimCount}
          signal={signal.signal}
          stage={signal.stage}
        />
      ) : (
        <section className="pc-progress-cta pc-luxe-momentum-cta pc-share-studio-placeholder" id="circuit-moments" aria-labelledby="share-studio-placeholder-title">
          <div>
            <span className="app-eyebrow">Share progress</span>
            <h2 id="share-studio-placeholder-title">{state.signedIn ? "Your share card appears when your verified history is ready." : "Sign in to share your progress."}</h2>
            <p>Cards share progress, never your balance.</p>
          </div>
          <Link className="button button-lg pc-v5-primary" href={state.signedIn ? "/dashboard" : "/auth?next=/progress%23circuit-moments"}>{state.signedIn ? "View rewards" : "Sign in"} <ArrowUpRight /></Link>
        </section>
      )}

      <details className="admin-panel pc-luxe-seals-section">
        <summary><strong>Progress details</strong> · ranks, weekly history and milestones</summary>

        <div className="pc-weekly-stack">
          <article className="pc-weekly-card pc-luxe-weekly-card">
            <div className="pc-card-label"><Trend /> Last 7 days</div>
            <div className="pc-weekly-numbers">
              <span><strong>{weekly.available ? weekly.claims7d : "—"}</strong><small>claims</small></span>
              <span><strong>{weekly.available ? weekly.activeDays7d : "—"}</strong><small>active days</small></span>
              <span><strong>{weekly.available ? weekly.previousClaims7d : "—"}</strong><small>prior 7d</small></span>
            </div>
            <p>{weekly.available ? trendCopy(weekly.trend) : "Live history reveals your first weekly pattern."}</p>
          </article>
          <article className="pc-retention-callout pc-luxe-retention-callout"><Shield /><div><strong>Current stage</strong><p>{state.preview ? "Live after sign-in." : signal.stage}</p></div></article>
        </div>

        <section className="pc-luxe-rank-road" aria-label="Circuit rank progression">
          <div><span className="app-eyebrow">Rank path</span><h2>Five ranks. Keep building.</h2></div>
          <div className="pc-luxe-rank-track">
            {ranks.map((rank, index) => {
              const activeIndex = Math.max(0, ranks.indexOf(signal.stage as (typeof ranks)[number]));
              const reached = !state.preview && index <= activeIndex;
              const current = !state.preview && rank === signal.stage;
              return <span className={(reached ? "reached " : "") + (current ? "current" : "")} key={rank}><i>{index + 1}</i><strong>{rank}</strong></span>;
            })}
          </div>
        </section>

        <div className="app-section-head"><div><span className="app-eyebrow">Milestones</span><h2>{state.preview ? "Verified activity unlocks the collection." : unlockedAchievements.length + " / " + achievements.length + " unlocked"}</h2></div></div>
        <div className="pc-achievement-grid pc-luxe-seal-grid">
          {achievements.map((achievement) => (
            <article className={"pc-achievement pc-luxe-seal " + (achievement.unlocked && !state.preview ? "unlocked " : "locked ") + "tone-" + achievement.tone} key={achievement.id}>
              <div className="pc-achievement-mark">{achievement.unlocked && !state.preview ? <Check /> : <span />}</div>
              <div><small>{achievement.unlocked && !state.preview ? "Unlocked" : "Locked"}</small><h3>{achievement.title}</h3><p>{achievement.description}</p></div>
            </article>
          ))}
        </div>
      </details>
    </AppShell>
  );
}
