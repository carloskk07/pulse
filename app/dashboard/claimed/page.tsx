import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Check, Shield, Spark } from "@/components/icons";
import { PulseCountdown } from "@/components/pulse-countdown";
import { ShareRhythmButton } from "@/components/share-rhythm-button";
import { getCircuitAchievements, getNextCircuitAchievement } from "@/lib/circuit-achievements";
import { getCircuitProgress } from "@/lib/circuit-progress";
import { getRecentPulseReceipt } from "@/lib/pulse-receipt";
import { getRewardSnapshot } from "@/lib/reward-state";
import { getCurrentUserContext } from "@/lib/current-user-context";
import { getPulseAdPlacement } from "@/lib/pulse-ads";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export const metadata = { title: "Pulse secured" };
export const dynamic = "force-dynamic";

function remainingCopy(remaining: number, unit: "Pulse" | "day" | "Signal point" | "Trust level") {
  const value = Math.max(0, Math.ceil(remaining));
  if (value === 0) return "Ready";
  const suffix = value === 1 ? unit : unit === "day" ? "days" : unit + "s";
  return value + " " + suffix;
}

export default async function ClaimedPage() {
  const [state, receipt, userContext, requestHeaders] = await Promise.all([
    getRewardSnapshot(),
    getRecentPulseReceipt(),
    getCurrentUserContext(),
    headers(),
  ]);
  if (!state.signedIn || !userContext.user) redirect("/auth?next=/dashboard");
  if (!receipt) redirect("/dashboard");

  const countryCode = requestHeaders.get("x-vercel-ip-country");
  const userAgent = requestHeaders.get("user-agent")?.toLowerCase() ?? "";
  const devicePlatform = /mobile|android|iphone|ipad/.test(userAgent) ? "mobile" : "desktop";
  const sponsored = await getPulseAdPlacement({
    userId: userContext.user.id,
    countryCode,
    devicePlatform,
  });

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
  const canScheduleReturn = state.pulseFundingReady && Boolean(state.nextClaimAt);
  const payout = getFaucetPayPackConfig();
  const payoutTargetCredits = payout.amountCredits && payout.amountCredits > 0 ? payout.amountCredits : null;
  const payoutRemaining = payoutTargetCredits ? Math.max(0, payoutTargetCredits - state.availableCredits) : null;

  return (
    <AppShell active="home">
      <main className="pc-claim-handoff pc-v8-claim-handoff">
        <section className="pc-v8-victory" aria-labelledby="claim-victory-title">
          <div className="pc-v8-victory-aurora" aria-hidden="true" />
          <div className="pc-v8-victory-grid">
            <div className="pc-v8-victory-copy">
              <div className="pc-v8-victory-kicker">
                <span className="pc-v8-success-mark"><Check /></span>
                <span>Pulse secured</span>
              </div>
              <span className="app-eyebrow">Done</span>
              <h1 id="claim-victory-title">Reward added.<br />Next Pulse scheduled.</h1>
              <p className="pc-v8-victory-lead">This funded Pulse is already reflected in your real balance and progress.</p>

              <div className="pc-v8-reward-line">
                <div><small>Added now</small><strong>+{receipt.rewardCredits.toLocaleString("en-US")} P</strong></div>
                <div><small>Available</small><strong>{state.availableCredits.toLocaleString("en-US")} P</strong></div>
                {payoutTargetCredits ? <div><small>To payout target</small><strong>{payoutRemaining && payoutRemaining > 0 ? payoutRemaining.toLocaleString("en-US") + " P" : "Ready"}</strong></div> : null}
              </div>

              <div className="pc-v8-hero-actions">
                <Link href="/dashboard" className="button button-light">Track next Pulse <ArrowUpRight /></Link>
                <Link href="/wallet" className="pc-v8-text-action">Open Vault <ArrowUpRight /></Link>
              </div>

              <div className="pc-v8-proof-pills" aria-label="Claim integrity">
                <span><Shield /> Funded reward</span>
                <span>Real history</span>
                <span>Balance updated</span>
              </div>
            </div>

            <div className="pc-v8-vault-orbit" aria-label="Updated Pulse state">
              <div className="pc-v8-orbit-ring">
                <div className="pc-v8-orbit-core">
                  <span>Vault updated</span>
                  <strong>{state.availableCredits.toLocaleString("en-US")} P</strong>
                  <small>available now</small>
                </div>
              </div>
              <div className="pc-v8-orbit-meta">
                <span><b>+{receipt.rewardCredits.toLocaleString("en-US")} P</b> this Pulse</span>
                <span><b>{signal.stage}</b> current rank</span>
              </div>
            </div>
          </div>
        </section>

        <section className="pc-v8-return-stage" aria-labelledby="return-stage-title">
          <div className="pc-v8-return-core">
            <span className="app-eyebrow">Next action</span>
            <h2 id="return-stage-title">{state.nextClaimAt ? "Come back when the next Pulse opens." : "Your next Pulse is ready."}</h2>
            <p>The timer follows your last real claim.</p>
            <div className="pc-v8-return-countdown">
              {state.nextClaimAt ? <PulseCountdown target={state.nextClaimAt} /> : <strong>READY</strong>}
            </div>
            <Link href="/dashboard" className="button button-light">Return to Pulse <ArrowUpRight /></Link>
          </div>

          <div className="pc-v8-return-actions">
            {canScheduleReturn ? (
              <form action="/api/return-reminder" method="post" className="pc-v8-reminder-form">
                <div><Spark /><span><strong>Need a reminder?</strong><small>Create one reminder for the next real eligibility window.</small></span></div>
                <button type="submit">Set reminder <ArrowUpRight /></button>
              </form>
            ) : null}
          </div>
        </section>

        {sponsored ? (
          <aside className="pc-sponsored-slot" aria-label="Sponsored placement">
            <div className="pc-sponsored-slot-copy">
              <span>Sponsored · Pulse Ads</span>
              <h3>{sponsored.title}</h3>
              <p>{sponsored.body}</p>
            </div>
            <div className="pc-sponsored-slot-actions">
              <form action="/api/ads/click" method="post">
                <input type="hidden" name="campaign" value={sponsored.id} />
                <button className="button button-secondary" type="submit">Visit sponsor <ArrowUpRight /></button>
              </form>
              <Link href="/advertise">Advertise here</Link>
            </div>
          </aside>
        ) : null}

        <details className="admin-panel">
          <summary><strong>What else changed</strong> · Momentum, history and the next milestone</summary>
          <div className="pc-v8-change-grid">
            <article className="pc-v8-change-card signal"><small>Momentum</small><strong>{signal.signal}<i>/100</i></strong><span>{signal.stage}</span></article>
            <article className="pc-v8-change-card history"><small>Pulse history</small><strong>{state.hourlyClaimCount.toLocaleString("en-US")}</strong><span>{state.streakDays}d rhythm</span></article>
            <article className="pc-v8-change-card vault"><small>Vault</small><strong>{state.availableCredits.toLocaleString("en-US")} P</strong><span>Current available balance</span></article>
          </div>

          {nextAchievement ? (
            <div className="pc-v8-next-seal">
              <small>Closest milestone</small>
              <strong>{nextAchievement.title}</strong>
              <div className="pc-v8-unlock-track"><span style={{ width: nextAchievement.progress + "%" }} /></div>
              <span>{remainingCopy(nextAchievement.remaining, nextAchievement.unit)} remaining</span>
            </div>
          ) : null}

          <div className="pc-v8-share-panel">
            <div><Spark /><span><strong>Share progress, not private balance.</strong><small>Rank and rhythm come from verified history.</small></span></div>
            <div>
              <ShareRhythmButton days={state.streakDays} signal={signal.signal} />
              <Link href="/progress#circuit-moments">Open share studio <ArrowUpRight /></Link>
            </div>
          </div>
        </details>
      </main>
    </AppShell>
  );
}
