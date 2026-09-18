import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Bolt, Shield, Spark, Users } from "@/components/icons";
import { PulseCoreVisual } from "@/components/pulse-core-visual";
import { PulseCountdown } from "@/components/pulse-countdown";
import { TurnstileField } from "@/components/turnstile-field";
import { getCircuitProgress } from "@/lib/circuit-progress";
import { getUserNextAction } from "@/lib/experience-presentation";
import { formatUsdFromCredits, getRewardSnapshot, trustLabel } from "@/lib/reward-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildAyetOfferwallUrl, isAyetConfigured } from "@/providers/ayet";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export const metadata = { title: "Pulse" };

type Props = { searchParams: Promise<{ claim?: string }> };

const claimCopy: Record<string, string> = {
  success: "Pulse secured. Your balance and progress were updated.",
  "not-ready": "Your next Pulse is not ready yet.",
  "budget-paused": "Pulse is temporarily unavailable. Your balance did not change.",
  "trust-review": "This Pulse needs a review before it can be released.",
  "verification-failed": "Verification failed. Try again.",
  "verification-not-configured": "Pulse verification is temporarily unavailable.",
  "service-not-configured": "The live reward service is temporarily unavailable.",
  upgraded: "Hourly Pulse is now the active reward loop.",
  failed: "The Pulse did not complete. Your balance did not change.",
};

export default async function DashboardPage({ searchParams }: Props) {
  const [state, params, supabase] = await Promise.all([getRewardSnapshot(), searchParams, createSupabaseServerClient()]);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
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
  const trust = trustLabel(state.trustLevel);
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
        ? `+${state.claimRewardCredits} P available`
        : "Next window";
  const payoutTargetLabel = payout.ready && payout.display ? payout.display : "Target preparing";

  return (
    <AppShell active="home">
      <div className="pc-v9-dashboard">
        <div className="app-page-head pulse-page-head pc-luxe-dashboard-head pc-v9-head">
          <div className="pc-v9-head-copy">
            <div className="pulse-line">Your circuit</div>
            <h1>{state.signedIn ? <>Know the <em>next move.</em></> : "Start with one Pulse."}</h1>
            <p>{state.signedIn
              ? "PulseCircuit keeps the next useful action obvious and moves technical checks into the background."
              : "Sign in to see your real reward, progress and Vault state."}</p>
          </div>

          <Link href="/wallet" className="balance-chip balance-chip-v2 pc-luxe-vault-chip pc-v9-vault-chip" aria-label="Open Vault">
            <div className="pc-v9-vault-chip-head"><small>Vault</small><span>{vaultPercent}%</span></div>
            <strong>{state.preview ? "—" : formatUsdFromCredits(state.availableCredits)}</strong>
            {!state.preview ? <span>{away === null ? payoutTargetLabel : away <= 0 ? "Payout target reached" : `${formatUsdFromCredits(away)} to payout`}</span> : null}
            <div className="pc-v9-vault-mini-track" aria-hidden="true"><i style={{ width: `${state.preview ? 0 : vaultPercent}%` }} /></div>
          </Link>
        </div>

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
                    Claim +{state.claimRewardCredits} P <ArrowUpRight />
                  </button>
                </form>
              ) : state.claimReady ? (
                <button className="button button-light pulse-claim-button" disabled>Pulse temporarily unavailable</button>
              ) : (
                <div className="pc-next-action-row">
                  <button className="button button-light pulse-claim-button" disabled>Waiting for next Pulse</button>
                  {canScheduleReturn ? (
                    <form action="/api/return-reminder" method="post">
                      <button className="button button-secondary" type="submit">Set reminder</button>
                    </form>
                  ) : null}
                </div>
              )}
            </div>

            <div className="pulse-core-panel pc-luxe-core-panel pc-v9-core-panel" aria-label="Live Pulse state">
              <PulseCoreVisual state={visualState} eyebrow="Pulse" caption={pulseCaption}>
                {state.pulseFundingReady && !state.claimReady
                  ? <PulseCountdown target={state.nextClaimAt} />
                  : <span className="pulse-core-word">{state.claimReady && state.pulseFundingReady ? "READY" : "STANDBY"}</span>}
              </PulseCoreVisual>
              {!state.preview && state.signedIn ? (
                <div className="pulse-core-meta">
                  <div className="pulse-trust-mini"><Shield /><span>{signal.stage}</span><b>Signal {signal.signal}/100</b></div>
                  <small className="pulse-rhythm-label">{state.streakDays > 0 ? `${state.streakDays}-day rhythm` : "First Pulse starts your rhythm"}</small>
                </div>
              ) : null}
            </div>

            <div className="pulse-integrity-rail pc-luxe-integrity pc-v9-integrity" aria-label="Pulse principles">
              <span><i className="integrity-dot" />Funded rewards</span>
              <span><i className="integrity-dot" />Real history</span>
              <span><i className="integrity-dot" />Protected payout</span>
              <strong className={state.pulseFundingReady ? "online" : "standby"}>{state.pulseFundingReady ? "LIVE" : "SAFE"}</strong>
            </div>
          </div>
        </section>

        <section className="app-section pc-luxe-momentum-section pc-v9-momentum">
          <div className="app-section-head">
            <div>
              <span className="app-eyebrow">Your progress</span>
              <h2>Three things worth knowing.</h2>
              <p className="pc-v9-section-sub">Progress, payout distance and optional extras stay visible without competing with your next action.</p>
            </div>
          </div>

          <div className="pc-v9-progress-deck">
            <article className="pc-v9-progress-card signal-card">
              <span className="app-eyebrow">Momentum</span>
              <div className="pc-v9-progress-value"><strong>{state.preview ? "—" : signal.signal}</strong><span>/100</span></div>
              <h3>{state.preview ? "Waiting for live history" : signal.stage}</h3>
              <p>{state.preview ? "Your live progress appears after connection." : `${state.streakDays}-day rhythm · ${state.hourlyClaimCount} funded Pulse${state.hourlyClaimCount === 1 ? "" : "s"}`}</p>
              <Link href="/progress">See progress <ArrowUpRight /></Link>
            </article>

            <article className="pc-v9-progress-card vault-card">
              <span className="app-eyebrow">Vault</span>
              <div className="pc-v9-progress-value"><strong>{state.preview ? "—" : `${vaultPercent}%`}</strong></div>
              <h3>{state.preview ? "Live after sign-in" : formatUsdFromCredits(state.availableCredits)}</h3>
              <p>{state.preview || away === null
                ? "Your payout target appears when the live payout pack is ready."
                : away > 0
                  ? `${formatUsdFromCredits(away)} remains to the current payout target.`
                  : "Your current payout target is reached."}</p>
              <Link href="/wallet">Open Vault <ArrowUpRight /></Link>
            </article>

            <article className="pc-v9-progress-card unlock-card">
              <span className="app-eyebrow">Invite</span>
              <div className="pc-v9-unlock-mark"><Users /></div>
              <h3>Grow only with verified activity.</h3>
              <p>Referral progress moves after qualifying real activity, not empty signups.</p>
              <Link href="/invite">Open Invite <ArrowUpRight /></Link>
            </article>
          </div>

          {!state.preview && state.signedIn ? (
            <details className="admin-panel-note">
              <summary>More circuit details</summary>
              <div className="admin-secondary-grid">
                <article><span>Trust</span><strong>{trust}</strong><small>Level {state.trustLevel}/5</small></article>
                <article><span>Rhythm</span><strong>{state.streakDays} day{state.streakDays === 1 ? "" : "s"}</strong><small>Derived from real Pulse history</small></article>
                <article><span>Pulses</span><strong>{state.hourlyClaimCount}</strong><small>Funded claims</small></article>
              </div>
            </details>
          ) : null}
        </section>

        <section className="dashboard-lower-grid pc-luxe-lower-grid pc-v9-lower-grid">
          <article className="invite-card pc-luxe-turbo-card">
            <div className="invite-icon">{liveTurboRoute ? <Bolt /> : <Shield />}</div>
            <div>
              <span className="app-eyebrow">Optional</span>
              <h3>Turbo never blocks the core Pulse.</h3>
              <p>{liveTurboRoute ? "Use extra earning routes only when they are useful to you." : "The base experience stays independent from external offer supply."}</p>
            </div>
            <Link href="/earn" className="icon-button" aria-label="Open extra rewards"><ArrowUpRight /></Link>
          </article>

          <article className="progress-card pc-luxe-vault-progress">
            <div className="app-eyebrow">Proof</div>
            <h3>Real activity stays distinguishable from real payouts.</h3>
            <p>Public proof never invents claims, conversions or paid withdrawals.</p>
            <Link href="/proof" className="inline-action"><Shield /> View live proof</Link>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
