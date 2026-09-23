import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Spark } from "@/components/icons";
import { ClaimRevealHero } from "@/components/claim-reveal-hero";
import { PulseCountdown } from "@/components/pulse-countdown";
import { ShareRhythmButton } from "@/components/share-rhythm-button";
import { SponsoredVisitButton } from "@/components/sponsored-visit-button";
import { getCircuitAchievements, getNextCircuitAchievement } from "@/lib/circuit-achievements";
import { getCircuitProgress } from "@/lib/circuit-progress";
import { getRecentPulseReceipt } from "@/lib/pulse-receipt";
import { formatUsdFromCredits, getRewardSnapshot } from "@/lib/reward-state";
import { getCurrentUserContext } from "@/lib/current-user-context";
import { getPulseAdPlacement } from "@/lib/pulse-ads";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";
import { getFaucetLaunchState } from "@/lib/faucet-launch";

export const metadata = { title: "Reward claimed" };
export const dynamic = "force-dynamic";

function remainingCopy(remaining: number, unit: "Pulse" | "day" | "Signal point" | "Trust level") {
  const value = Math.max(0, Math.ceil(remaining));
  if (value === 0) return "Ready";
  const suffix = value === 1 ? unit : unit === "day" ? "days" : unit + "s";
  return value + " " + suffix;
}

export default async function ClaimedPage() {
  const [state, receipt, userContext, requestHeaders, launch] = await Promise.all([
    getRewardSnapshot(),
    getRecentPulseReceipt(),
    getCurrentUserContext(),
    headers(),
    getFaucetLaunchState(),
  ]);
  if (!state.signedIn || !userContext.user) redirect("/auth?next=/dashboard");
  if (!receipt) redirect("/dashboard");

  const countryCode = requestHeaders.get("x-vercel-ip-country");
  const userAgent = requestHeaders.get("user-agent")?.toLowerCase() ?? "";
  const devicePlatform = /mobile|android|iphone|ipad/.test(userAgent) ? "mobile" : "desktop";
  const sponsored = await getPulseAdPlacement({
    userId: userContext.user.id,
    pulseClaimId: receipt.id,
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
  const rewardValue = formatUsdFromCredits(receipt.rewardCredits);
  const variableReward = launch.rewardVariable && launch.rewardBands.length > 1;
  const matchedBand = launch.rewardBands.find((band) => band.credits === receipt.rewardCredits) ?? null;
  const topReward = variableReward && receipt.rewardCredits === launch.rewardMaxCredits;
  const boostedReward = variableReward && receipt.rewardCredits > launch.rewardMinCredits && !topReward;
  const rewardTone = topReward ? "top" : boostedReward ? "boosted" : "standard";
  const probabilityLabel = matchedBand
    ? `${(matchedBand.probabilityBps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}% launch chance`
    : null;
  const revealLabel = topReward ? "Top reward hit" : boostedReward ? "Higher reward hit" : variableReward ? "Reward revealed" : "Reward claimed";
  const revealLead = topReward
    ? "You hit the highest configured faucet reward in the current launch range."
    : boostedReward
      ? "This claim landed above the minimum reward band and is already reflected in your balance."
      : variableReward
        ? "This claim was resolved from the live variable reward range and is already reflected in your balance."
        : "Your verified reward is already reflected in your balance and progress.";

  return (
    <AppShell active="home">
      <main className="pc-claim-handoff pc-v8-claim-handoff">
        <ClaimRevealHero
          availableBalance={formatUsdFromCredits(state.availableCredits)}
          boostedReward={boostedReward}
          payoutRemaining={payoutTargetCredits ? (payoutRemaining && payoutRemaining > 0 ? formatUsdFromCredits(payoutRemaining) : "Ready") : null}
          probabilityLabel={probabilityLabel}
          revealLabel={revealLabel}
          revealLead={revealLead}
          rewardTone={rewardTone}
          rewardValue={rewardValue}
          signalStage={signal.stage}
          topReward={topReward}
          variableReward={variableReward}
        />

        <section className="pc-v8-return-stage" aria-labelledby="return-stage-title">
          <div className="pc-v8-return-core">
            <span className="app-eyebrow">Next action</span>
            <h2 id="return-stage-title">{state.nextClaimAt ? "Come back when your next claim opens." : "Your next reward is ready."}</h2>
            <p>The timer follows your last real claim.</p>
            <div className="pc-v8-return-countdown">
              {state.nextClaimAt ? <PulseCountdown target={state.nextClaimAt} /> : <strong>READY</strong>}
            </div>
            <Link href="/dashboard" className="button button-light">View next reward <ArrowUpRight /></Link>
            <Link href={"/earn?claim=" + encodeURIComponent(receipt.id)} className="button button-secondary">Earn while you wait <ArrowUpRight /></Link>
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
              <SponsoredVisitButton campaignId={sponsored.id} />
              <Link href="/advertise">Advertise here</Link>
            </div>
          </aside>
        ) : null}

        <details className="admin-panel">
          <summary><strong>More progress details</strong> · history, rank and the next milestone</summary>
          <div className="pc-v8-change-grid">
            <article className="pc-v8-change-card signal"><small>Progress score</small><strong>{signal.signal}<i>/100</i></strong><span>{signal.stage}</span></article>
            <article className="pc-v8-change-card history"><small>Claim history</small><strong>{state.hourlyClaimCount.toLocaleString("en-US")}</strong><span>{state.streakDays}d return streak</span></article>
            <article className="pc-v8-change-card vault"><small>Balance</small><strong>{formatUsdFromCredits(state.availableCredits)}</strong><span>Current available value</span></article>
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
            <div><Spark /><span><strong>Share progress, not private balance.</strong><small>Rank and return streak come from verified history.</small></span></div>
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
