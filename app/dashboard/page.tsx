import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Bolt, Check, Shield, Spark, Users } from "@/components/icons";
import { PulseCountdown } from "@/components/pulse-countdown";
import { TurnstileField } from "@/components/turnstile-field";
import { formatUsdFromCredits, getRewardSnapshot, trustLabel } from "@/lib/reward-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildAyetOfferwallUrl, isAyetConfigured } from "@/providers/ayet";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export const metadata = { title: "Home" };

type Props = { searchParams: Promise<{ claim?: string }> };

const claimCopy: Record<string, string> = {
  success: "Pulse claimed. The reward is now recorded in your authoritative ledger.",
  "not-ready": "Your next Pulse has not opened yet. The rolling timer is authoritative.",
  "budget-paused": "The Pulse reward pool is paused or has reached a safety limit. No balance was changed.",
  "trust-review": "This claim needs a trust review before a reward can be released. No balance was changed.",
  "verification-failed": "Human verification failed. Please try again.",
  "verification-not-configured": "Pulse verification is not configured yet.",
  "service-not-configured": "The live reward service is not configured yet.",
  upgraded: "Daily Pulse was retired. Use the treasury-backed Hourly Pulse below.",
  failed: "The claim could not be completed. No balance was changed.",
};

export default async function DashboardPage({ searchParams }: Props) {
  const [state, params, supabase] = await Promise.all([getRewardSnapshot(), searchParams, createSupabaseServerClient()]);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const liveTurboRoute = user && isAyetConfigured() ? buildAyetOfferwallUrl(user.id) : null;
  const payout = getFaucetPayPackConfig();
  const payoutCredits = payout.ready && payout.amountCredits ? Number(payout.amountCredits) : null;
  const verificationConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const canClaim = state.signedIn && state.claimReady && state.claimRewardCredits > 0 && state.pulseFundingReady && verificationConfigured;
  const progress = payoutCredits ? Math.min(100, (state.availableCredits / payoutCredits) * 100) : 0;
  const away = payoutCredits ? Math.max(0, payoutCredits - state.availableCredits) : null;
  const showFirstPulseGuide = state.signedIn && !state.preview && state.hourlyClaimCount === 0;

  return (
    <AppShell active="home">
      <div className="app-page-head">
        <div><div className="pulse-line">Live reward state</div><h1>{state.preview ? "Pulse is waiting for its live service." : "Your Pulse."}</h1><p>{state.preview ? "Financial values stay hidden until the production reward service is authoritative." : "Claim. Return. Build trust. Turbo only when you want more."}</p></div>
        <div className="balance-chip"><small>Available</small><strong>{state.preview ? "Not connected" : formatUsdFromCredits(state.availableCredits)}</strong></div>
      </div>

      {params.claim ? <div className={`claim-message ${params.claim === "success" ? "success" : "neutral"}`}>{claimCopy[params.claim] ?? "Pulse state updated."}</div> : null}
      {state.preview ? <div className="preview-banner">Preview shell only — no balance, claim, trust or payout value is simulated before the live reward service is connected.</div> : null}

      {showFirstPulseGuide ? <section className="first-reward-guide"><div className="first-reward-copy"><span className="app-eyebrow">Your first rhythm</span><h2>The reward comes first.</h2><p>Claim the base Pulse when it opens. Return after the rolling interval. Turbo is optional and never required to receive an eligible base reward.</p></div><div className="first-reward-steps"><div><span>1</span><strong>Claim</strong><small>Collect an eligible Pulse</small></div><div><span>2</span><strong>Return</strong><small>Come back when the timer opens</small></div><div><span>3</span><strong>Turbo</strong><small>Optional extra earning</small></div></div></section> : null}

      <section className="dashboard-hero hourly-pulse-stage">
        <div className="daily-pulse-card hourly-pulse-card">
          <div className="daily-pulse-copy">
            <span className="status-pill status-lime"><Spark /> {state.preview ? "Setup required" : `Pulse Trust · ${trustLabel(state.trustLevel)}`}</span>
            <h2>{state.preview ? "Hourly Pulse activates with the live ledger." : !state.pulseFundingReady ? "The reward pool is safely paused." : state.claimReady ? "Your Pulse is ready." : "Your next Pulse is charging."}</h2>
            <p>{state.preview ? "Connect the production reward service before claims become authoritative." : !state.pulseFundingReady ? "Pulse never promises an unfunded reward. Claims reopen only when the treasury has real budget and its safety controls are enabled." : state.claimReady ? `Claim +${state.claimRewardCredits} credit${state.claimRewardCredits === 1 ? "" : "s"}. The next window opens ${state.claimIntervalMinutes} minutes after a successful claim.` : "Your reward is secured by a rolling interval rather than a calendar reset, preventing boundary double-claims."}</p>
            {state.preview ? <button className="button button-light" disabled>Reward service not connected</button> : canClaim ? <form action="/api/pulse/claim" method="post" className="claim-form"><TurnstileField action="hourly_pulse" /><button className="button button-light" type="submit">Claim +{state.claimRewardCredits} P <ArrowUpRight /></button></form> : state.claimReady ? state.signedIn ? <button className="button button-light" disabled>{state.pulseFundingReady ? "Claim verification unavailable" : "Reward pool paused"}</button> : <Link href="/auth?next=/dashboard" className="button button-light">Sign in to claim <ArrowUpRight /></Link> : <button className="button button-light" disabled>Pulse charging <Check /></button>}
          </div>
          <div className="pulse-timer-panel" aria-label="Next Pulse timer">
            <small>Next Pulse</small>
            <PulseCountdown target={state.nextClaimAt} />
            <div className="pulse-trust-mini"><Shield /><span>Trust {state.trustLevel}/5</span></div>
            <div className="streak-days">{[1,2,3,4,5,6,7].map((day) => <span key={day} className={!state.preview && day <= Math.min(state.streakDays, 7) ? "done" : ""}>{!state.preview && day <= Math.min(state.streakDays, 7) ? <Check /> : day}</span>)}</div>
            <small>{state.streakDays > 0 ? `${state.streakDays}-day rhythm` : "Start your rhythm"}</small>
          </div>
        </div>
      </section>

      <section className="app-section"><div className="app-section-head"><div><span className="app-eyebrow">Optional Turbo</span><h2>{liveTurboRoute ? "Want more than the base Pulse?" : "The base Pulse does not depend on offer inventory."}</h2></div><Link href="/earn">Open Turbo <ArrowUpRight /></Link></div><article className="invite-card"><div className="invite-icon">{liveTurboRoute ? <Bolt /> : <Shield />}</div><div><span className="app-eyebrow">{liveTurboRoute ? "Extra earning" : "Independent core"}</span><h3>{liveTurboRoute ? "Turbo is available when you choose it." : "No CPA provider controls whether Pulse exists."}</h3><p>{liveTurboRoute ? "A connected monetization route can add extra rewards. Pulse credits only authoritative server-confirmed events." : "External CPA supply stays optional. The hourly reward, ledger, trust and Wallet remain Pulse-owned."}</p></div><Link href="/earn" className="icon-button" aria-label="Open Turbo"><ArrowUpRight /></Link></article></section>

      <section className="dashboard-lower-grid">
        <article className="progress-card"><div className="app-eyebrow">Next withdrawal</div>{payoutCredits && !state.preview ? <><div className="progress-value"><strong>{formatUsdFromCredits(state.availableCredits)}</strong><span>/ {formatUsdFromCredits(payoutCredits)}</span></div><div className="progress-track large"><span style={{width:`${progress}%`}} /></div><p>{away && away > 0 ? <>Only <strong>{formatUsdFromCredits(away)} remains</strong> to the configured payout threshold.</> : <strong>The configured withdrawal threshold is reached.</strong>}</p></> : <><div className="progress-value"><strong>Not active</strong></div><div className="progress-track large"><span style={{width:"0%"}} /></div><p>The payout threshold appears only after the live payout pack is configured.</p></>}<Link href="/wallet" className="inline-action"><Bolt /> Open Wallet</Link></article>
        <article className="invite-card"><div className="invite-icon"><Users /></div><div><span className="app-eyebrow">Quality growth</span><h3>Share a rhythm, not a signup bounty.</h3><p>Referral rewards unlock only after verified monetized activity, so growth is tied to real users rather than account farms.</p></div><Link href="/invite" className="icon-button" aria-label="Open referral page"><ArrowUpRight /></Link></article>
      </section>

      <section className="pulse-proof-link"><div><span className="app-eyebrow">Public proof</span><h2>See what Pulse has actually credited and paid.</h2><p>No simulated users, payouts or activity.</p></div><Link className="button" href="/proof">Open Pulse Proof <ArrowUpRight /></Link></section>
    </AppShell>
  );
}
