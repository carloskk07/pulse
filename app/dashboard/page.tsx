import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ContinuousPulsePanel } from "@/components/continuous-pulse-panel";
import { ArrowUpRight, Bolt, Shield, Spark, Users } from "@/components/icons";
import { PulseCoreVisual } from "@/components/pulse-core-visual";
import { RewardArtifact, VaultProgressArtwork } from "@/components/pulse-visuals";
import { PulseCountdown } from "@/components/pulse-countdown";
import { TurnstileField } from "@/components/turnstile-field";
import { ValueFlow } from "@/components/value-flow";
import { getCircuitProgress } from "@/lib/circuit-progress";
import { getUserNextAction } from "@/lib/experience-presentation";
import { formatUsdFromCredits, getRewardSnapshot } from "@/lib/reward-state";
import { getCurrentUserContext } from "@/lib/current-user-context";
import { buildAyetOfferwallUrl, isAyetConfigured } from "@/providers/ayet";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export const metadata = { title: "Rewards" };

type Props = { searchParams: Promise<{ claim?: string }> };

const claimCopy: Record<string, string> = {
  success: "Reward claimed. Your balance and progress were updated.",
  "not-ready": "Your next reward is not ready yet.",
  "budget-paused": "The faucet is temporarily unavailable. Your balance did not change.",
  "backing-refreshing": "Reward availability is refreshing. Your balance did not change; try again in a moment.",
  "claim-in-progress": "Your reward is already being processed. Your balance has not changed yet; try again in a moment.",
  "trust-review": "This reward needs a review before it can be released.",
  "verification-failed": "Verification failed. Try again.",
  "verification-not-configured": "Reward verification is temporarily unavailable.",
  "service-not-configured": "The live reward service is temporarily unavailable.",
  upgraded: "The hourly faucet is now the active reward loop.",
  failed: "The reward did not complete. Your balance did not change.",
};

export default async function DashboardPage({ searchParams }: Props) {
  const [state, params, userContext] = await Promise.all([getRewardSnapshot(), searchParams, getCurrentUserContext()]);
  const { user } = userContext;
  const liveTurboRoute = user && isAyetConfigured() ? buildAyetOfferwallUrl(user.id) : null;
  const payout = getFaucetPayPackConfig();
  const payoutCredits = payout.ready && payout.amountCredits ? Number(payout.amountCredits) : null;
  const verificationConfigured = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    && process.env.TURNSTILE_SECRET_KEY
    && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const canClaim = state.signedIn
    && state.claimReady
    && state.claimRewardCredits > 0
    && state.pulseFundingReady
    && verificationConfigured;
  const canScheduleReturn = state.signedIn && state.pulseFundingReady && !state.claimReady && Boolean(state.nextClaimAt);
  const progress = payoutCredits ? Math.min(100, (state.availableCredits / payoutCredits) * 100) : 0;
  const away = payoutCredits ? Math.max(0, payoutCredits - state.availableCredits) : null;
  const vaultPercent = Math.max(0, Math.min(100, Math.round(progress)));
  const claimSucceeded = params.claim === "success";
  const signal = getCircuitProgress({
    hourlyClaimCount: state.hourlyClaimCount,
    streakDays: state.streakDays,
    trustLevel: state.trustLevel,
  });
  const nextAction = getUserNextAction({
    signedIn: state.signedIn,
    preview: state.preview,
    pulseFundingReady: state.pulseFundingReady,
    claimReady: state.claimReady,
    nextClaimAt: state.nextClaimAt,
  });
  const visualState = state.preview || !state.pulseFundingReady ? "paused" : state.claimReady ? "ready" : "charging";
  const pulseCaption = state.preview
    ? "Live service unavailable"
    : !state.pulseFundingReady
      ? "Rewards paused"
      : state.claimReady
        ? state.claimRewardVariable
          ? `${formatUsdFromCredits(state.claimRewardMinCredits)}–${formatUsdFromCredits(state.claimRewardMaxCredits)} reward`
          : `${formatUsdFromCredits(state.claimRewardCredits)} available`
        : "Next window";
  const payoutTargetLabel = payout.ready && payout.display ? payout.display : "Target preparing";

  return (
    <AppShell active="home" userLabel={state.signedIn ? state.userLabel : undefined}>
      <div className="pc-v9-dashboard">
        <div className="app-page-head pulse-page-head pc-luxe-dashboard-head pc-v9-head">
          <div className="pc-v9-head-copy">
            <div className="pulse-line">Your rewards</div>
            <h1>{state.signedIn ? <>Know what you can <em>earn next.</em></> : "Start earning free crypto."}</h1>
            <p>{state.signedIn
              ? "Your next reward, balance and payout progress stay visible in one place."
              : "Sign in to see your reward timing, balance and payout progress."}</p>
          </div>

          <Link href="/wallet" className="balance-chip balance-chip-v2 pc-luxe-vault-chip pc-v9-vault-chip" aria-label="Open balance">
            <div className="pc-v9-vault-chip-head"><small>Balance</small><span>{vaultPercent}%</span></div>
            <strong>{state.preview ? "—" : formatUsdFromCredits(state.availableCredits)}</strong>
            {!state.preview ? <span>{away === null ? payoutTargetLabel : away <= 0 ? "Payout target reached" : `${formatUsdFromCredits(away)} to payout`}</span> : null}
            <div className="pc-v9-vault-mini-track" aria-hidden="true"><i style={{ width: `${state.preview ? 0 : vaultPercent}%` }} /></div>
          </Link>
        </div>

        <ValueFlow
          stage="earn"
          balance={state.preview ? "—" : formatUsdFromCredits(state.availableCredits)}
          payoutProgress={state.preview ? 0 : vaultPercent}
          payoutState={state.preview || !payoutCredits ? "paused" : vaultPercent >= 100 ? "ready" : "building"}
          payoutLabel={state.preview || !payoutCredits ? "Preparing" : vaultPercent >= 100 ? "Ready" : `${vaultPercent}% to target`}
        />

        {params.claim ? (
          <div className={`claim-message ${claimSucceeded ? "success" : "neutral"}`}>
            {claimCopy[params.claim] ?? "Circuit updated."}
            {claimSucceeded ? <Link href="/progress">See progress <ArrowUpRight /></Link> : null}
          </div>
        ) : null}

        <section className="dashboard-hero hourly-pulse-stage pc-luxe-pulse-stage pc-v9-stage" aria-labelledby="next-action-title">
          <div className={`daily-pulse-card hourly-pulse-card pc-luxe-pulse-chamber pc-v9-chamber state-${visualState} ${claimSucceeded ? "is-claimed" : ""}`}>
            <div className="pc-v9-horizon" aria-hidden="true" />
            <div className="daily-pulse-copy pc-luxe-pulse-copy pc-v9-pulse-copy">
              <span className="status-pill status-lime"><Spark /> {nextAction.eyebrow}</span>
              <h2 id="next-action-title">{nextAction.title}</h2>
              <p>{nextAction.detail}</p>

              {state.preview ? (
                <button className="button button-light pulse-claim-button" disabled>{nextAction.actionLabel}</button>
              ) : !state.signedIn ? (
                <Link href={nextAction.href} className="button button-light pulse-claim-button">{nextAction.actionLabel} <ArrowUpRight /></Link>
              ) : canClaim ? (
                <form action="/api/pulse/claim" method="post" className="claim-form">
                  <TurnstileField action="hourly_pulse" />
                  <button className="button button-light pulse-claim-button pc-luxe-claim pc-v9-primary-cta" type="submit">
                    {state.claimRewardVariable ? "Reveal reward" : `Claim ${formatUsdFromCredits(state.claimRewardCredits)}`} <ArrowUpRight />
                  </button>
                </form>
              ) : state.claimReady ? (
                <button className="button button-light pulse-claim-button" disabled>Reward temporarily unavailable</button>
              ) : (
                <div className="pc-next-action-row">
                  <button className="button button-light pulse-claim-button" disabled>Waiting for next claim</button>
                  {canScheduleReturn ? (
                    <form action="/api/return-reminder" method="post">
                      <button className="button button-secondary" type="submit">Set reminder</button>
                    </form>
                  ) : null}
                </div>
              )}
            </div>

            <div className="pulse-core-panel pc-luxe-core-panel pc-v9-core-panel" aria-label="Live reward state">
              <div className="pc-dashboard-reward-art" aria-hidden="true">
                <RewardArtifact value="" eyebrow="" meta="" readout={false} compact />
              </div>
              <PulseCoreVisual state={visualState} eyebrow="Hourly reward" caption={pulseCaption}>
                {state.pulseFundingReady && !state.claimReady
                  ? <PulseCountdown target={state.nextClaimAt} />
                  : <span className="pulse-core-word">{state.claimReady && state.pulseFundingReady ? "READY" : "STANDBY"}</span>}
              </PulseCoreVisual>
              {!state.preview && state.signedIn ? (
                <div className="pulse-core-meta">
                  <div className="pulse-trust-mini"><Shield /><span>{signal.stage}</span><b>Signal {signal.signal}/100</b></div>
                  <small className="pulse-rhythm-label">{state.streakDays > 0 ? `${state.streakDays}-day return streak` : "Your first claim starts your progress"}</small>
                </div>
              ) : null}
            </div>

            <div className="pulse-integrity-rail pc-luxe-integrity pc-v9-integrity" aria-label="Reward principles">
              <span><i className="integrity-dot" />Rewards</span>
              <span><i className="integrity-dot" />Progress</span>
              <span><i className="integrity-dot" />Payout</span>
              <strong className={state.pulseFundingReady ? "online" : "standby"}>{state.pulseFundingReady ? "ACTIVE" : "PAUSED"}</strong>
            </div>
          </div>
        </section>

        <ContinuousPulsePanel />

        <section className="app-section pc-luxe-momentum-section pc-v9-momentum">
          <div className="app-section-head">
            <div>
              <span className="app-eyebrow">Your progress</span>
              <h2>Your account at a glance.</h2>
              <p className="pc-v9-section-sub">Progress, balance and referrals stay visible without crowding your next reward.</p>
            </div>
          </div>

          <div className="pc-v9-progress-deck">
            <article className="pc-v9-progress-card signal-card">
              <span className="app-eyebrow">Progress</span>
              <div className="pc-v9-progress-value"><strong>{state.preview ? "—" : signal.signal}</strong><span>/100</span></div>
              <h3>{state.preview ? "Waiting for live history" : signal.stage}</h3>
              <p>{state.preview ? "Your live progress appears after connection." : `${state.streakDays}-day return streak · ${state.hourlyClaimCount} verified claim${state.hourlyClaimCount === 1 ? "" : "s"}`}</p>
              <Link href="/progress">See progress <ArrowUpRight /></Link>
            </article>

            <article className="pc-v9-progress-card vault-card">
              <span className="app-eyebrow">Balance</span>
              <div className="pc-dashboard-vault-art" aria-hidden="true">
                <VaultProgressArtwork
                  percent={state.preview ? 0 : vaultPercent}
                  value={state.preview ? "—" : formatUsdFromCredits(state.availableCredits)}
                />
              </div>
              <div className="pc-v9-progress-value"><strong>{state.preview ? "—" : `${vaultPercent}%`}</strong></div>
              <h3>{state.preview ? "Live after sign-in" : formatUsdFromCredits(state.availableCredits)}</h3>
              <p>{state.preview || away === null
                ? "Your payout details appear when they are available."
                : away > 0
                  ? `${formatUsdFromCredits(away)} remains to the current payout target.`
                  : "Your current payout target is reached."}</p>
              <Link href="/wallet">View balance <ArrowUpRight /></Link>
            </article>

            <article className="pc-v9-progress-card unlock-card">
              <span className="app-eyebrow">Referrals</span>
              <div className="pc-v9-unlock-mark"><Users /></div>
              <h3>Earn through real referrals.</h3>
              <p>Referral rewards, when active, are tied to verified eligible activity and shown before you share.</p>
              <Link href="/invite">Open Network <ArrowUpRight /></Link>
            </article>
          </div>

          {!state.preview && state.signedIn ? (
            <details className="admin-panel-note">
              <summary>More progress details</summary>
              <div className="admin-secondary-grid">
                <article><span>Rhythm</span><strong>{state.streakDays} day{state.streakDays === 1 ? "" : "s"}</strong><small>Your return streak</small></article>
                <article><span>Claims</span><strong>{state.hourlyClaimCount}</strong><small>Completed rewards</small></article>
              </div>
            </details>
          ) : null}
        </section>

        <section className="dashboard-lower-grid pc-luxe-lower-grid pc-v9-lower-grid">
          <article className="invite-card pc-luxe-turbo-card">
            <div className="invite-icon">{liveTurboRoute ? <Bolt /> : <Shield />}</div>
            <div>
              <span className="app-eyebrow">Optional</span>
              <h3>Extra rewards stay optional.</h3>
              <p>{liveTurboRoute ? "Choose extra reward routes only when the value is worth your time." : "The hourly faucet does not require extra offers."}</p>
            </div>
            <Link href="/earn" className="icon-button" aria-label="Open extra rewards"><ArrowUpRight /></Link>
          </article>

          <article className="progress-card pc-luxe-vault-progress">
            <div className="app-eyebrow">Proof</div>
            <h3>See what has actually been credited and paid.</h3>
            <p>Claims and completed payouts are visible on the public Proof page.</p>
            <Link href="/proof" className="inline-action"><Shield /> View live proof</Link>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
