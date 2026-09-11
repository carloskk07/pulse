import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Bolt, Check, Spark, Users } from "@/components/icons";
import { OfferCard } from "@/components/offer-card";
import { TurnstileField } from "@/components/turnstile-field";
import { offers } from "@/lib/mock-data";
import { formatUsdFromCredits, getRewardSnapshot } from "@/lib/reward-state";

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
  const [state, params] = await Promise.all([getRewardSnapshot(), searchParams]);
  const canClaim = state.signedIn && state.claimReady && Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const progress = Math.min(100, (state.availableCredits / 5000) * 100);
  const away = Math.max(0, 5000 - state.availableCredits);

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

      <section className="app-section"><div className="app-section-head"><div><span className="app-eyebrow">Best for you</span><h2>High-value matches</h2></div><Link href="/earn">See all <ArrowUpRight /></Link></div><div className="offers-app-grid">{offers.slice(0,3).map((offer, index) => <OfferCard key={offer.id} offer={offer} featured={index === 0} />)}</div></section>

      <section className="dashboard-lower-grid">
        <article className="progress-card"><div className="app-eyebrow">First withdrawal</div><div className="progress-value"><strong>{formatUsdFromCredits(state.availableCredits)}</strong><span>/ $5.00</span></div><div className="progress-track large"><span style={{width:`${progress}%`}} /></div><p>{away > 0 ? <>You&apos;re only <strong>{formatUsdFromCredits(away)} away.</strong></> : <strong>You reached the withdrawal threshold.</strong>}</p><Link href="/earn" className="inline-action"><Bolt /> Find a quick reward</Link></article>
        <article className="invite-card"><div className="invite-icon"><Users /></div><div><span className="app-eyebrow">Grow together</span><h3>Your next active invite unlocks a bonus.</h3><p>Rewards activate after your friend completes a verified quest.</p></div><Link href="/invite" className="icon-button"><ArrowUpRight /></Link></article>
      </section>
    </AppShell>
  );
}
