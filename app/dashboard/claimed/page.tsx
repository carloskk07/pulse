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
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

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
  const nextUnlocks = achievements.filter((achievement) => !achievement.unlocked).slice(0, 3);
  const trust = trustLabel(state.trustLevel);
  const canScheduleReturn = state.pulseFundingReady && Boolean(state.nextClaimAt);
  const payout = getFaucetPayPackConfig();
  const payoutTargetCredits = payout.amountCredits && payout.amountCredits > 0 ? payout.amountCredits : null;
  const payoutProgress = payoutTargetCredits
    ? Math.max(0, Math.min(100, (state.availableCredits / payoutTargetCredits) * 100))
    : null;
  const payoutProgressRounded = payoutProgress === null ? null : Math.round(payoutProgress);
  const payoutRemaining = payoutTargetCredits ? Math.max(0, payoutTargetCredits - state.availableCredits) : null;
  const payoutReached = Boolean(payoutTargetCredits && state.availableCredits >= payoutTargetCredits);
  const historyLabel = state.hourlyClaimCount === 1 ? "Pulse" : "Pulses";

  return (
    <AppShell active="home">
      <main className="pc-claim-handoff pc-v8-claim-handoff">
        <section className="pc-v8-victory" aria-labelledby="claim-victory-title">
          <div className="pc-v8-victory-aurora" aria-hidden="true" />
          <div className="pc-v8-victory-grid">
            <div className="pc-v8-victory-copy">
              <div className="pc-v8-victory-kicker">
                <span className="pc-v8-success-mark"><Check /></span>
                <span>Pulse secured · live history verified</span>
              </div>

              <span className="app-eyebrow">Momentum moved</span>
              <h1 id="claim-victory-title">The circuit moved.<br />Your Vault did too.</h1>
              <p className="pc-v8-victory-lead">
                This Pulse is funded, recorded and already reflected in your real balance. The next move is measurable now.
              </p>

              <div className="pc-v8-reward-line">
                <div>
                  <small>Added now</small>
                  <strong>+{receipt.rewardCredits.toLocaleString("en-US")} P</strong>
                </div>
                <div>
                  <small>Available balance</small>
                  <strong>{state.availableCredits.toLocaleString("en-US")} P</strong>
                </div>
                {payoutTargetCredits ? (
                  <div>
                    <small>Live payout target</small>
                    <strong>{payout.display || `${payoutTargetCredits.toLocaleString("en-US")} P`}</strong>
                  </div>
                ) : null}
              </div>

              <div className="pc-v8-hero-actions">
                <Link href="/dashboard" className="button button-light">Track next Pulse <ArrowUpRight /></Link>
                <Link href="/wallet" className="pc-v8-text-action">Open Vault <ArrowUpRight /></Link>
                <Link href="/proof" className="pc-v8-text-action">View live proof <ArrowUpRight /></Link>
              </div>

              <div className="pc-v8-proof-pills" aria-label="Claim integrity">
                <span><Shield /> Verified history</span>
                <span>{state.pulseFundingReady ? "Rail funded" : "Rail on standby"}</span>
                <span>Turbo optional</span>
              </div>
            </div>

            <div className="pc-v8-vault-orbit" aria-label="Vault progress">
              <div
                className="pc-v8-orbit-ring"
                style={{
                  background: `conic-gradient(var(--pulse-v3-lime) 0 ${payoutProgressRounded ?? 0}%, rgba(207,255,103,.09) ${payoutProgressRounded ?? 0}% 100%)`,
                }}
              >
                <div className="pc-v8-orbit-core">
                  <span>Vault progress</span>
                  <strong>{payoutProgressRounded === null ? "—" : `${payoutProgressRounded}%`}</strong>
                  <small>{payoutReached ? "Target reached" : "toward payout target"}</small>
                </div>
              </div>
              <div className="pc-v8-orbit-meta">
                <span>{state.availableCredits.toLocaleString("en-US")} P available</span>
                {payoutRemaining !== null ? <b>{payoutRemaining > 0 ? `${payoutRemaining.toLocaleString("en-US")} P remaining` : "Target reached"}</b> : <b>Target pending</b>}
              </div>
            </div>
          </div>
        </section>

        <section className="pc-v8-story" aria-labelledby="after-pulse-title">
          <div className="pc-v8-story-head">
            <div>
              <span className="app-eyebrow">What changed</span>
              <h2 id="after-pulse-title">One Pulse. Four visible moves.</h2>
              <p>Your reward is not an isolated number. It changes balance, history, momentum and the next return window together.</p>
            </div>
            <Link href="/progress" className="pc-v8-head-link">Open Momentum <ArrowUpRight /></Link>
          </div>

          <div className="pc-v8-change-grid">
            <article className="pc-v8-change-card vault">
              <small>Vault</small>
              <strong>{state.availableCredits.toLocaleString("en-US")} P</strong>
              <span>+{receipt.rewardCredits.toLocaleString("en-US")} P verified in this claim</span>
            </article>
            <article className="pc-v8-change-card signal">
              <small>Circuit signal</small>
              <strong>{signal.signal}<i>/100</i></strong>
              <span>{signal.stage} · {signal.progressToNext}% to next rank</span>
            </article>
            <article className="pc-v8-change-card history">
              <small>Live history</small>
              <strong>{state.hourlyClaimCount.toLocaleString("en-US")}</strong>
              <span>{historyLabel} · {state.streakDays}d factual rhythm</span>
            </article>
            <article className="pc-v8-change-card trust">
              <small>Trust</small>
              <strong>{trust}</strong>
              <span>Level {state.trustLevel}/5 · built from real history</span>
            </article>
          </div>
        </section>

        <section className="pc-v8-progress-zone" aria-label="Vault and unlock progress">
          <article className="pc-v8-vault-panel">
            <div className="pc-v8-panel-top">
              <div>
                <span className="app-eyebrow">Vault trajectory</span>
                <h2>{payoutReached ? "Your live payout target is reached." : "Your first payout is becoming measurable."}</h2>
              </div>
              <Link href="/wallet" className="pc-v8-head-link">Open Vault <ArrowUpRight /></Link>
            </div>

            {payoutTargetCredits && payoutProgressRounded !== null ? (
              <>
                <div className="pc-v8-vault-numbers">
                  <div><small>Current</small><strong>{state.availableCredits.toLocaleString("en-US")} P</strong></div>
                  <div><small>Target</small><strong>{payoutTargetCredits.toLocaleString("en-US")} P</strong></div>
                  <div><small>Live pack</small><strong>{payout.display || "Configured"}</strong></div>
                </div>
                <div className="pc-v8-progress-track" aria-label={`${payoutProgressRounded}% to payout target`}>
                  <span style={{ width: `${payoutProgress}%` }} />
                </div>
                <div className="pc-v8-progress-copy">
                  <strong>{payoutProgressRounded}% complete</strong>
                  <span>{payoutRemaining && payoutRemaining > 0 ? `${payoutRemaining.toLocaleString("en-US")} P until the current payout target.` : "Current payout target reached."}</span>
                </div>
              </>
            ) : (
              <p className="pc-v8-muted-copy">The live payout target appears here only when the provider pack is fully proven.</p>
            )}
          </article>

          <article className="pc-v8-unlocks-panel">
            <div className="pc-v8-panel-top compact">
              <div>
                <span className="app-eyebrow">Next unlocks</span>
                <h2>Give the next return a reason.</h2>
              </div>
            </div>

            <div className="pc-v8-unlock-list">
              {nextUnlocks.length > 0 ? nextUnlocks.map((achievement, index) => (
                <div className={`pc-v8-unlock tone-${achievement.tone}`} key={achievement.id}>
                  <div className="pc-v8-unlock-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="pc-v8-unlock-copy">
                    <strong>{achievement.title}</strong>
                    <small>{achievement.description}</small>
                    <div className="pc-v8-unlock-track"><span style={{ width: `${achievement.progress}%` }} /></div>
                  </div>
                  <div className="pc-v8-unlock-state">
                    <strong>{Math.round(achievement.progress)}%</strong>
                    <small>{remainingCopy(achievement.remaining, achievement.unit)}</small>
                  </div>
                </div>
              )) : (
                <div className="pc-v8-unlock complete"><Check /><span><strong>Collection complete</strong><small>Every current Circuit milestone is unlocked.</small></span></div>
              )}
            </div>
          </article>
        </section>

        <section className="pc-v8-return-stage" aria-labelledby="return-stage-title">
          <div className="pc-v8-return-core">
            <span className="app-eyebrow">Next live window</span>
            <h2 id="return-stage-title">Keep the rhythm alive.</h2>
            <p>The next Pulse is governed by the real eligibility clock — not an artificial timer.</p>
            <div className="pc-v8-return-countdown">
              {state.nextClaimAt ? <PulseCountdown target={state.nextClaimAt} /> : <strong>READY</strong>}
            </div>
            <Link href="/dashboard" className="button button-light">Return to Pulse <ArrowUpRight /></Link>
          </div>

          <div className="pc-v8-return-actions">
            {nextAchievement ? (
              <div className="pc-v8-next-seal">
                <small>Closest milestone</small>
                <strong>{nextAchievement.title}</strong>
                <div className="pc-v8-unlock-track"><span style={{ width: `${nextAchievement.progress}%` }} /></div>
                <span>{remainingCopy(nextAchievement.remaining, nextAchievement.unit)} remaining</span>
              </div>
            ) : null}

            {canScheduleReturn ? (
              <form action="/api/return-reminder" method="post" className="pc-v8-reminder-form">
                <div><Spark /><span><strong>Come back at the right moment.</strong><small>Create one calendar reminder for the next real eligibility window.</small></span></div>
                <button type="submit">Set reminder <ArrowUpRight /></button>
              </form>
            ) : null}

            <div className="pc-v8-share-panel">
              <div><Spark /><span><strong>Make the progress shareable.</strong><small>Rank and rhythm only. Private balance remains private.</small></span></div>
              <div>
                <ShareRhythmButton days={state.streakDays} signal={signal.signal} />
                <Link href="/progress#circuit-moments">Premium card <ArrowUpRight /></Link>
              </div>
            </div>
          </div>
        </section>

        <footer className="pc-v8-proof-footer">
          <span><Shield /> Authoritative reward</span>
          <span>Trust <strong>{trust}</strong></span>
          <span>Recorded {new Date(receipt.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</span>
        </footer>
      </main>
    </AppShell>
  );
}
