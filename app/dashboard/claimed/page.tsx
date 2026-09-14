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

export const metadata = { title: "Pulse secured" };
export const dynamic = "force-dynamic";

function remainingCopy(remaining: number, unit: "Pulse" | "day" | "Signal point" | "Trust level") {
  const value = Math.max(0, Math.ceil(remaining));
  if (value === 0) return "Ready";
  const suffix = value === 1 ? unit : unit === "day" ? "days" : `${unit}s`;
  return `${value} ${suffix}`;
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
  const canScheduleReturn = state.pulseFundingReady && Boolean(state.nextClaimAt);

  return (
    <AppShell active="home">
      <main className="pc-claim-handoff pc-luxe-claim-handoff">
        <section className="pc-claim-receipt pc-luxe-claim-receipt">
          <div className="pc-claim-receipt-glow" aria-hidden="true" />
          <div className="pc-claim-check"><Check /></div>
          <span className="app-eyebrow">Pulse secured</span>
          <h1>Momentum moved.</h1>
          <p>This reward exists in your live claim history.</p>

          <div className="pc-claim-credit pc-luxe-claim-credit">
            <small>Added to your circuit</small>
            <strong>+{receipt.rewardCredits.toLocaleString("en-US")} P</strong>
            <span>authoritative reward</span>
          </div>

          <div className="pc-claim-integrity pc-luxe-claim-integrity">
            <span><Shield /> Verified history</span>
            <span>{state.pulseFundingReady ? "Rail funded" : "Rail on standby"}</span>
            <span>Turbo optional</span>
          </div>
        </section>

        <section className="pc-after-pulse pc-luxe-after-pulse" aria-labelledby="after-pulse-title">
          <div className="pc-after-pulse-head">
            <div>
              <span className="app-eyebrow">Afterglow</span>
              <h2 id="after-pulse-title">Your next move is already visible.</h2>
            </div>
            <Link href="/progress" className="pc-after-pulse-link">Open Momentum <ArrowUpRight /></Link>
          </div>

          <div className="pc-after-pulse-grid pc-luxe-after-grid">
            <article className="pc-after-pulse-card primary pc-luxe-after-primary">
              <small>Next Pulse</small>
              <div className="pc-after-countdown">
                {state.nextClaimAt ? <PulseCountdown target={state.nextClaimAt} /> : <strong>READY</strong>}
              </div>
              <Link href="/dashboard" className="button button-light">Back to Pulse <ArrowUpRight /></Link>
            </article>

            <article className="pc-after-pulse-card pc-luxe-after-rank">
              <small>Circuit rank</small>
              <strong>{signal.stage}</strong>
              <div className="pc-after-mini"><span>Signal</span><b>{signal.signal}/100</b></div>
              <div className="pc-after-track"><span style={{ width: `${signal.progressToNext}%` }} /></div>
            </article>

            <article className="pc-after-pulse-card milestone pc-luxe-after-seal">
              <small>Next seal</small>
              {nextAchievement ? (
                <>
                  <strong>{nextAchievement.title}</strong>
                  <div className="pc-after-track"><span style={{ width: `${nextAchievement.progress}%` }} /></div>
                  <div className="pc-after-mini"><span>{Math.round(nextAchievement.progress)}%</span><b>{remainingCopy(nextAchievement.remaining, nextAchievement.unit)}</b></div>
                </>
              ) : (
                <>
                  <strong>Collection complete</strong>
                  <div className="pc-after-mini"><span>Current seals</span><b>Complete</b></div>
                </>
              )}
            </article>

            <article className="pc-after-pulse-card signal pc-luxe-after-history">
              <small>History</small>
              <strong>{state.hourlyClaimCount.toLocaleString("en-US")}<span> Pulses</span></strong>
              <div className="pc-after-mini"><span>Rhythm</span><b>{state.streakDays}d</b></div>
            </article>
          </div>

          <div className="pc-after-pulse-share pc-luxe-after-share">
            <div><Spark /><span><strong>This is the moment worth sharing.</strong><small>Rank and rhythm only. Private balance stays private.</small></span></div>
            <div className="pc-after-pulse-actions">
              <ShareRhythmButton days={state.streakDays} signal={signal.signal} />
              <Link href="/progress#circuit-moments">Create premium card <ArrowUpRight /></Link>
            </div>
          </div>

          {canScheduleReturn ? (
            <div className="pc-return-intelligence pc-luxe-return-reminder">
              <div><Spark /><span><strong>Keep the rhythm.</strong><small>One calendar reminder for the next real eligibility window.</small></span></div>
              <a href="/api/return-reminder">Set reminder <ArrowUpRight /></a>
            </div>
          ) : null}

          <div className="pc-after-pulse-footnote">Trust <strong>{trust}</strong> · recorded {new Date(receipt.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</div>
        </section>
      </main>
    </AppShell>
  );
}
