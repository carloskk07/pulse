import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Check, Shield, Spark } from "@/components/icons";
import { PulseCountdown } from "@/components/pulse-countdown";
import { ShareRhythmButton } from "@/components/share-rhythm-button";
import { getCircuitAchievements, getNextCircuitAchievement } from "@/lib/circuit-achievements";
import { getCircuitProgress } from "@/lib/circuit-progress";
import { getRecentPulseReceipt } from "@/lib/pulse-receipt";
import { getRewardSnapshot, trustLabel } from "@/lib/reward-state";

export const metadata = { title: "Pulse confirmed" };
export const dynamic = "force-dynamic";

function remainingCopy(remaining: number, unit: "Pulse" | "day" | "Signal point" | "Trust level") {
  const value = Math.max(0, Math.ceil(remaining));
  if (value === 0) return "Ready to unlock";
  const suffix = value === 1 ? unit : unit === "day" ? "days" : `${unit}s`;
  return `${value} ${suffix} to go`;
}

export default async function ClaimedPage() {
  const [state, receipt] = await Promise.all([getRewardSnapshot(), getRecentPulseReceipt()]);

  if (!state.signedIn) redirect("/auth?next=/dashboard");
  if (!receipt) redirect("/dashboard");

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
  const nextAchievement = getNextCircuitAchievement(achievements);
  const trust = trustLabel(state.trustLevel);
  const fundingLabel = state.pulseFundingReady ? "Reward rail currently funded" : "Reward rail currently in safe standby";
  const canScheduleReturn = state.pulseFundingReady && Boolean(state.nextClaimAt);

  return (
    <AppShell active="home">
      <main className="pc-claim-handoff">
        <section className="pc-claim-receipt">
          <div className="pc-claim-receipt-glow" aria-hidden="true" />
          <div className="pc-claim-check"><Check /></div>
          <span className="app-eyebrow">Authoritative Pulse receipt</span>
          <h1>Pulse confirmed.</h1>
          <p>Your latest Pulse exists in live claim history. This screen is shown only for a recent authoritative claim, not from a success URL alone.</p>

          <div className="pc-claim-credit">
            <small>Recorded reward</small>
            <strong>+{receipt.rewardCredits.toLocaleString("en-US")} P</strong>
            <span>credited by the Pulse claim flow</span>
          </div>

          <div className="pc-claim-integrity">
            <span><Shield /> Server history verified</span>
            <span>{fundingLabel}</span>
            <span>Turbo remains optional</span>
          </div>
        </section>

        <section className="pc-after-pulse" aria-labelledby="after-pulse-title">
          <div className="pc-after-pulse-head">
            <div>
              <span className="app-eyebrow">V4.3 · Post-Pulse handoff</span>
              <h2 id="after-pulse-title">Your next reason to return is already clear.</h2>
            </div>
            <Link href="/progress" className="pc-after-pulse-link">Open full progress <ArrowUpRight /></Link>
          </div>

          <div className="pc-after-pulse-grid">
            <article className="pc-after-pulse-card primary">
              <small>Next eligible window</small>
              <div className="pc-after-countdown">
                {state.nextClaimAt ? <PulseCountdown target={state.nextClaimAt} /> : <strong>READY</strong>}
              </div>
              <p>{state.nextClaimAt ? "The rolling interval is derived from your latest real claim. Funding and safety controls are checked again when you return." : "Your rolling interval is already open. Funding and safety controls still decide whether a reward can be released."}</p>
              <Link href="/dashboard" className="button button-light">Back to Pulse <ArrowUpRight /></Link>
            </article>

            <article className="pc-after-pulse-card">
              <small>History secured</small>
              <strong>{state.hourlyClaimCount.toLocaleString("en-US")} Pulse{state.hourlyClaimCount === 1 ? "" : "s"}</strong>
              <p>This claim is now part of the factual history used by Rhythm, achievements and Circuit Signal.</p>
              <div className="pc-after-mini"><span>Rhythm</span><b>{state.streakDays}d</b></div>
            </article>

            <article className="pc-after-pulse-card signal">
              <small>Circuit Signal</small>
              <strong>{signal.signal}<span>/100</span></strong>
              <p>{signal.nextStageAt === null ? `${signal.stage} is the highest current Signal stage.` : `${signal.nextStageAt - signal.signal} factual Signal points remain to ${signal.stage === "Spark" ? "Flow" : signal.stage === "Flow" ? "Rhythm" : signal.stage === "Rhythm" ? "Circuit" : "Resonance"}.`}</p>
              <div className="pc-after-track"><span style={{ width: `${signal.progressToNext}%` }} /></div>
            </article>

            <article className="pc-after-pulse-card milestone">
              <small>Closest factual milestone</small>
              {nextAchievement ? (
                <>
                  <strong>{nextAchievement.title}</strong>
                  <p>{nextAchievement.description}</p>
                  <div className="pc-after-track"><span style={{ width: `${nextAchievement.progress}%` }} /></div>
                  <div className="pc-after-mini"><span>{Math.round(nextAchievement.progress)}% complete</span><b>{remainingCopy(nextAchievement.remaining, nextAchievement.unit)}</b></div>
                </>
              ) : (
                <>
                  <strong>Current grid complete</strong>
                  <p>Every achievement in the current factual milestone set is unlocked.</p>
                  <div className="pc-after-mini"><span>Milestones</span><b>Complete</b></div>
                </>
              )}
            </article>
          </div>

          {canScheduleReturn ? (
            <div className="pc-return-intelligence">
              <div><Spark /><span><strong>Return Intelligence</strong><small>Add one reminder for the next real rolling eligibility window. No recurring spam, no synthetic schedule and no reward guarantee.</small></span></div>
              <a href="/api/return-reminder">Add to calendar <ArrowUpRight /></a>
            </div>
          ) : null}

          <div className="pc-after-pulse-share">
            <div><Spark /><span><strong>Turn progress into a shareable moment.</strong><small>Your share exposes Rhythm and Signal, never your balance or payout destination.</small></span></div>
            <div className="pc-after-pulse-actions">
              <ShareRhythmButton days={state.streakDays} signal={signal.signal} />
              <Link href="/progress#circuit-moments">Open Circuit Moments <ArrowUpRight /></Link>
            </div>
          </div>

          <div className="pc-after-pulse-footnote">Trust: <strong>{trust}</strong> · Claim recorded at {new Date(receipt.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC · no payout promise is created by this screen.</div>
        </section>
      </main>
    </AppShell>
  );
}
