import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Bolt, Check, Spark, Users } from "@/components/icons";
import { TurnstileField } from "@/components/turnstile-field";
import { formatUsdFromCredits, getRewardSnapshot } from "@/lib/reward-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildAyetOfferwallUrl, isAyetConfigured } from "@/providers/ayet";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export const metadata = { title: "Home" };

type Props = { searchParams: Promise<{ claim?: string }> };

const claimCopy: Record<string, string> = {
  success: "Daily Pulse claimed. Your ledger is updated.",
  "already-claimed": "Today's Daily Pulse is already in your ledger.",
  "verification-failed": "Human verification failed. Please try again.",
  "verification-not-configured": "Daily Pulse verification is not configured yet.",
  "service-not-configured": "The live reward service is not configured yet.",
  failed: "The claim could not be completed. No balance was changed.",
};

export default async function DashboardPage({ searchParams }: Props) {
  const [state, params, supabase] = await Promise.all([getRewardSnapshot(), searchParams, createSupabaseServerClient()]);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const liveOfferwall = user && isAyetConfigured() ? buildAyetOfferwallUrl(user.id) : null;
  const payout = getFaucetPayPackConfig();
  const payoutCredits = Number(payout.amountCredits ?? 5000);
  const canClaim = state.signedIn && state.claimReady && Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const progress = Math.min(100, (state.availableCredits / payoutCredits) * 100);
  const away = Math.max(0, payoutCredits - state.availableCredits);

  return (
    <AppShell active="home">
      <div className="app-page-head"><div><span className="app-eyebrow">Live reward state</span><h1>Good evening.</h1></div><div className="balance-chip"><small>Available</small><strong>{formatUsdFromCredits(state.availableCredits)}</strong></div></div>

      {params.claim ? <div className={`claim-message ${params.claim === "success" ? "success" : "neutral"}`}>{claimCopy[params.claim] ?? "Daily Pulse status updated."}</div> : null}
      {state.preview ? <div className="preview-banner">Preview mode — connect Supabase + Turnstile to activate real claims and balances.</div> : null}

      <section className="dashboard-hero">
        <div className="daily-pulse-card">
          <div className="daily-pulse-copy">
            <span className="status-pill status-lime"><Spark /> {state.streakDays > 0 ? `Day ${state.streakDays}` : "Start today"}</span>
            <h2>{state.claimReady ? "Your Daily Pulse is ready." : "Today's Pulse is secured."}</h2>
            <p>{state.claimReady ? "Keep your streak alive and move one step closer to your next withdrawal." : "Come back tomorrow to continue your streak."}</p>
            {canClaim ? (
              <form action="/api/daily-pulse" method="post" className="claim-form">
                <TurnstileField action="daily_pulse" />
                <button className="button button-light" type="submit">Claim +{state.claimRewardCredits} credits <ArrowUpRight /></button>
              </form>
            ) : state.claimReady ? (
              state.signedIn ? <button className="button button-light" disabled>Claim setup incomplete</button> : <Link href="/auth?next=/dashboard" className="button button-light">Sign in to claim <ArrowUpRight /></Link>
            ) : <button className="button button-light" disabled>Claimed today <Check /></button>}
          </div>
          <div className="streak-visual" aria-label={`${state.streakDays} day streak`}><div className="streak-ring"><span>{state.streakDays}</span><small>days</small></div><div className="streak-days">{[1,2,3,4,5,6,7].map((day) => <span key={day} className={day <= Math.min(state.streakDays, 7) ? "done" : ""}>{day <= Math.min(state.streakDays, 7) ? <Check /> : day}</span>)}</div></div>
        </div>
      </section>

      <section className="app-section">
        <div className="app-section-head"><div><span className="app-eyebrow">Verified opportunities</span><h2>{liveOfferwall ? "Live earning inventory is connected." : "No payable inventory is being simulated."}</h2></div><Link href="/earn">Open Earn <ArrowUpRight /></Link></div>
        <article className="invite-card"><div className="invite-icon"><Bolt /></div><div><span className="app-eyebrow">{liveOfferwall ? "Provider live" : "Provider gate"}</span><h3>{liveOfferwall ? "Open provider-backed offers, surveys and quests." : "Earning opportunities appear only after the provider callback chain is configured."}</h3><p>{liveOfferwall ? "Credits are created after a signed server callback, not when a card is clicked." : "This dashboard deliberately avoids fabricated offer values while monetization is not authoritative."}</p></div><Link href="/earn" className="icon-button" aria-label="Open verified earning opportunities"><ArrowUpRight /></Link></article>
      </section>

      <section className="dashboard-lower-grid">
        <article className="progress-card"><div className="app-eyebrow">Next withdrawal</div><div className="progress-value"><strong>{formatUsdFromCredits(state.availableCredits)}</strong><span>/ {formatUsdFromCredits(payoutCredits)}</span></div><div className="progress-track large"><span style={{width:`${progress}%`}} /></div><p>{away > 0 ? <>You&apos;re only <strong>{formatUsdFromCredits(away)} away.</strong></> : <strong>You reached the configured withdrawal threshold.</strong>}</p><Link href="/earn" className="inline-action"><Bolt /> Open earning opportunities</Link></article>
        <article className="invite-card"><div className="invite-icon"><Users /></div><div><span className="app-eyebrow">Grow together</span><h3>Your next active invite unlocks a bonus.</h3><p>Rewards activate after your friend completes their first provider-confirmed earning action.</p></div><Link href="/invite" className="icon-button" aria-label="Open referral page"><ArrowUpRight /></Link></article>
      </section>
    </AppShell>
  );
}
