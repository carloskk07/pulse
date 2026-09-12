import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Bolt, Check, Shield, Spark, Users } from "@/components/icons";
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
  const payoutCredits = payout.ready && payout.amountCredits ? Number(payout.amountCredits) : null;
  const canClaim = state.signedIn && state.claimReady && state.claimRewardCredits > 0 && Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const progress = payoutCredits ? Math.min(100, (state.availableCredits / payoutCredits) * 100) : 0;
  const away = payoutCredits ? Math.max(0, payoutCredits - state.availableCredits) : null;

  return (
    <AppShell active="home">
      <div className="app-page-head">
        <div><div className="pulse-line">Live reward state</div><h1>{state.preview ? "Pulse is waiting for its live service." : "Your Pulse."}</h1><p>{state.preview ? "Financial values stay hidden until the production reward service is authoritative." : "One clear view of today, your progress and the next useful action."}</p></div>
        <div className="balance-chip"><small>Available</small><strong>{state.preview ? "Not connected" : formatUsdFromCredits(state.availableCredits)}</strong></div>
      </div>

      {params.claim ? <div className={`claim-message ${params.claim === "success" ? "success" : "neutral"}`}>{claimCopy[params.claim] ?? "Daily Pulse status updated."}</div> : null}
      {state.preview ? <div className="preview-banner">Preview shell only — no balance, ledger, streak or payout value is simulated before the live reward service is connected.</div> : null}

      <section className="dashboard-hero">
        <div className="daily-pulse-card">
          <div className="daily-pulse-copy">
            <span className="status-pill status-lime"><Spark /> {state.preview ? "Setup required" : state.streakDays > 0 ? `Day ${state.streakDays}` : "Start today"}</span>
            <h2>{state.preview ? "Daily Pulse activates with the live ledger." : state.claimReady ? "Your Daily Pulse is ready." : "Today's Pulse is secured."}</h2>
            <p>{state.preview ? "Connect the production reward service before claims or streaks become authoritative." : state.claimReady ? "A small verified reward keeps the rhythm moving without pretending a provider conversion happened." : "Today's claim is already traceable in the ledger. Come back when the next Pulse opens."}</p>
            {state.preview ? (
              <button className="button button-light" disabled>Reward service not connected</button>
            ) : canClaim ? (
              <form action="/api/daily-pulse" method="post" className="claim-form">
                <TurnstileField action="daily_pulse" />
                <button className="button button-light" type="submit">Claim +{state.claimRewardCredits} credits <ArrowUpRight /></button>
              </form>
            ) : state.claimReady ? (
              state.signedIn ? <button className="button button-light" disabled>Claim setup incomplete</button> : <Link href="/auth?next=/dashboard" className="button button-light">Sign in to claim <ArrowUpRight /></Link>
            ) : <button className="button button-light" disabled>Claimed today <Check /></button>}
          </div>
          <div className="streak-visual" aria-label={state.preview ? "Streak not connected" : `${state.streakDays} day streak`}><div className="streak-ring"><span>{state.preview ? "—" : state.streakDays}</span><small>days</small></div><div className="streak-days">{[1,2,3,4,5,6,7].map((day) => <span key={day} className={!state.preview && day <= Math.min(state.streakDays, 7) ? "done" : ""}>{!state.preview && day <= Math.min(state.streakDays, 7) ? <Check /> : day}</span>)}</div></div>
        </div>
      </section>

      <section className="app-section">
        <div className="app-section-head"><div><span className="app-eyebrow">Reward route</span><h2>{liveOfferwall ? "A live earning channel is ready." : "No payable inventory is being simulated."}</h2></div><Link href="/earn">Open Earn <ArrowUpRight /></Link></div>
        <article className="invite-card"><div className="invite-icon">{liveOfferwall ? <Bolt /> : <Shield />}</div><div><span className="app-eyebrow">{liveOfferwall ? "Provider live" : "Exchange gate"}</span><h3>{liveOfferwall ? "Open verified offers, surveys and quests through the Reward Exchange." : "Opportunities appear only when the settlement path can be trusted."}</h3><p>{liveOfferwall ? "The provider is implementation detail; Pulse keeps server verification and ledger authority in front of the financial state." : "This dashboard deliberately avoids fabricated values while monetization is not authoritative."}</p></div><Link href="/earn" className="icon-button" aria-label="Open verified earning opportunities"><ArrowUpRight /></Link></article>
      </section>

      <section className="dashboard-lower-grid">
        <article className="progress-card">
          <div className="app-eyebrow">Next withdrawal</div>
          {payoutCredits && !state.preview ? (
            <>
              <div className="progress-value"><strong>{formatUsdFromCredits(state.availableCredits)}</strong><span>/ {formatUsdFromCredits(payoutCredits)}</span></div>
              <div className="progress-track large"><span style={{width:`${progress}%`}} /></div>
              <p>{away && away > 0 ? <>Only <strong>{formatUsdFromCredits(away)} remains</strong> to the configured payout threshold.</> : <strong>The configured withdrawal threshold is reached.</strong>}</p>
            </>
          ) : (
            <><div className="progress-value"><strong>Not active</strong></div><div className="progress-track large"><span style={{width:"0%"}} /></div><p>The payout threshold appears only after the live payout pack is configured.</p></>
          )}
          <Link href="/earn" className="inline-action"><Bolt /> Find the next opportunity</Link>
        </article>
        <article className="invite-card"><div className="invite-icon"><Users /></div><div><span className="app-eyebrow">Grow together</span><h3>Referral rewards unlock after verified activity.</h3><p>No referral value is promised until the live reward configuration is available.</p></div><Link href="/invite" className="icon-button" aria-label="Open referral page"><ArrowUpRight /></Link></article>
      </section>
    </AppShell>
  );
}
