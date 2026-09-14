import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Bolt, Check, Shield, Spark, Users } from "@/components/icons";
import { PulseCoreVisual } from "@/components/pulse-core-visual";
import { PulseCountdown } from "@/components/pulse-countdown";
import { ShareRhythmButton } from "@/components/share-rhythm-button";
import { TurnstileField } from "@/components/turnstile-field";
import { getCircuitProgress } from "@/lib/circuit-progress";
import { formatUsdFromCredits, getRewardSnapshot, trustLabel } from "@/lib/reward-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildAyetOfferwallUrl, isAyetConfigured } from "@/providers/ayet";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export const metadata = { title: "Pulse" };

type Props = { searchParams: Promise<{ claim?: string }> };

const claimCopy: Record<string, string> = {
  success: "Pulse secured. Your circuit moved forward.",
  "not-ready": "Your next Pulse is still forming.",
  "budget-paused": "Pulse is on standby. No balance changed.",
  "trust-review": "This Pulse needs review before release.",
  "verification-failed": "Verification failed. Try again.",
  "verification-not-configured": "Pulse verification is not ready yet.",
  "service-not-configured": "The live reward service is not ready yet.",
  upgraded: "Hourly Pulse is now the active reward loop.",
  failed: "The Pulse did not complete. No balance changed.",
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
  const visualState = state.preview ? "preview" : !state.pulseFundingReady ? "paused" : state.claimReady ? "ready" : "charging";
  const pulseEyebrow = state.preview ? "Pulse" : !state.pulseFundingReady ? "Standby" : state.claimReady ? "Ready" : "Next Pulse";
  const pulseCaption = state.preview ? "Live service required" : !state.pulseFundingReady ? "Funding closed" : state.claimReady ? `+${state.claimRewardCredits} P available` : "Rolling window";
  const claimSucceeded = params.claim === "success";
  const trust = trustLabel(state.trustLevel);
  const rhythmMilestones = [1, 3, 7, 14] as const;
  const signal = getCircuitProgress({ hourlyClaimCount: state.hourlyClaimCount, streakDays: state.streakDays, trustLevel: state.trustLevel });
  const missions = [
    { title: "First ignition", note: "Complete one funded Pulse.", done: state.hourlyClaimCount >= 1 },
    { title: "3-day rhythm", note: "Return across three claim days.", done: state.streakDays >= 3 },
    { title: "Ten Pulse mark", note: "Reach ten funded Pulses.", done: state.hourlyClaimCount >= 10 },
  ];

  return (
    <AppShell active="home">
      <div className="app-page-head pulse-page-head pc-luxe-dashboard-head">
        <div>
          <div className="pulse-line">Live circuit</div>
          <h1>{state.preview ? "Your circuit is waiting." : "Your circuit."}</h1>
          <p>{state.preview ? "Live state appears when the reward service is connected." : "Claim. Build rank. Unlock the next move."}</p>
        </div>
        <Link href="/wallet" className="balance-chip balance-chip-v2 pc-luxe-vault-chip" aria-label="Open Vault">
          <small>Vault</small>
          <strong>{state.preview ? "—" : formatUsdFromCredits(state.availableCredits)}</strong>
          {!state.preview ? <span>{state.availableCredits.toLocaleString("en-US")} P</span> : null}
        </Link>
      </div>

      {params.claim ? <div className={`claim-message ${claimSucceeded ? "success" : "neutral"}`}>{claimCopy[params.claim] ?? "Circuit updated."}{claimSucceeded ? <Link href="/progress#circuit-moments">Share the moment <ArrowUpRight /></Link> : null}</div> : null}
      {state.preview ? <div className="preview-banner">Preview only — no financial state is simulated.</div> : null}

      <section className="pc-dashboard-ribbon pc-luxe-hud" aria-label="Circuit status">
        <article className={visualState === "ready" ? "live" : ""}><small>Pulse</small><strong>{state.preview ? "Preview" : !state.pulseFundingReady ? "Standby" : state.claimReady ? "Ready" : "Charging"}</strong></article>
        <article className="violet"><small>Rank</small><strong>{state.preview ? "—" : signal.stage}</strong></article>
        <article className="cyan"><small>Rhythm</small><strong>{state.preview ? "—" : `${state.streakDays}d`}</strong></article>
        <article className="warm"><small>Trust</small><strong>{state.preview ? "—" : trust}</strong></article>
      </section>

      <section className="dashboard-hero hourly-pulse-stage pc-luxe-pulse-stage">
        <div className={`daily-pulse-card hourly-pulse-card pc-luxe-pulse-chamber state-${visualState} ${claimSucceeded ? "is-claimed" : ""}`}>
          <div className="pulse-stage-watermark" aria-hidden="true"><span>PULSERCUIT</span><b>01</b></div>
          <div className="daily-pulse-copy pc-luxe-pulse-copy">
            <span className="status-pill status-lime"><Spark /> {state.preview ? "Awaiting live state" : `${signal.stage} · Signal ${signal.signal}`}</span>
            <h2>{state.preview ? "The Pulse begins when the live circuit connects." : !state.pulseFundingReady ? "Pulse is on standby." : state.claimReady ? "Your Pulse is ready." : "Your next Pulse is forming."}</h2>
            <p>{state.preview ? "No reward value is shown before the live service is authoritative." : !state.pulseFundingReady ? "Rewards reopen only when funding and safety controls are live." : state.claimReady ? `+${state.claimRewardCredits} P is funded and available now.` : "Come back when the live timer opens."}</p>
            {state.preview ? <button className="button button-light pulse-claim-button" disabled>Live service required</button> : canClaim ? <form action="/api/pulse/claim" method="post" className="claim-form"><TurnstileField action="hourly_pulse" /><button className="button button-light pulse-claim-button pc-luxe-claim" type="submit">Claim +{state.claimRewardCredits} P <ArrowUpRight /></button></form> : state.claimReady ? state.signedIn ? <button className="button button-light pulse-claim-button" disabled>{state.pulseFundingReady ? "Verification unavailable" : "Pulse on standby"}</button> : <Link href="/auth?next=/dashboard" className="button button-light pulse-claim-button">Enter to claim <ArrowUpRight /></Link> : <button className="button button-light pulse-claim-button" disabled>Charging <Check /></button>}
          </div>

          <div className="pulse-core-panel pc-luxe-core-panel" aria-label="Pulse state">
            <PulseCoreVisual state={visualState} eyebrow={pulseEyebrow} caption={pulseCaption}>
              {state.pulseFundingReady ? <PulseCountdown target={state.nextClaimAt} /> : <span className="pulse-core-word">STANDBY</span>}
            </PulseCoreVisual>
            <div className="pulse-core-meta">
              <div className="pulse-trust-mini"><Shield /><span>{trust}</span><b>{state.trustLevel}/5</b></div>
              <div className="streak-days" aria-label="Pulse rhythm">{[1,2,3,4,5,6,7].map((day) => <span key={day} className={!state.preview && day <= Math.min(state.streakDays, 7) ? "done" : ""}>{!state.preview && day <= Math.min(state.streakDays, 7) ? <Check /> : day}</span>)}</div>
              <small className="pulse-rhythm-label">{state.streakDays > 0 ? `${state.streakDays}-day rhythm` : "Build your first rhythm"}</small>
            </div>
          </div>

          <div className="pulse-integrity-rail pc-luxe-integrity" aria-label="Pulse principles">
            <span><i className="integrity-dot" />Funded only</span>
            <span><i className="integrity-dot" />Rolling window</span>
            <span><i className="integrity-dot" />Turbo optional</span>
            <strong className={state.pulseFundingReady ? "online" : "standby"}>{state.pulseFundingReady ? "LIVE" : "STANDBY"}</strong>
          </div>
        </div>
      </section>

      {showFirstPulseGuide ? <section className="first-reward-guide pulse-onboarding pc-luxe-onboarding"><div className="first-reward-copy"><span className="app-eyebrow">First run</span><h2>Claim. Return. Rise.</h2><p>Your first funded Pulse starts the circuit.</p></div><div className="first-reward-steps"><div><span>1</span><strong>Claim</strong></div><div><span>2</span><strong>Return</strong></div><div><span>3</span><strong>Rise</strong></div></div></section> : null}

      <section className="app-section pc-luxe-momentum-section">
        <div className="app-section-head"><div><span className="app-eyebrow">Momentum</span><h2>Level up what is real.</h2></div>{!state.preview && state.signedIn ? <ShareRhythmButton days={state.streakDays} signal={signal.signal} /> : <Link href="/progress">Open Momentum <ArrowUpRight /></Link>}</div>
        <div className="pc-signal-grid pc-luxe-signal-grid">
          <article className="pc-signal-card pc-luxe-rank-card">
            <span className="app-eyebrow">Circuit rank</span>
            <div className="pc-signal-value"><strong>{state.preview ? "—" : signal.signal}</strong><span>/100</span></div>
            <div className="pc-signal-stage">{state.preview ? "Awaiting history" : signal.stage}</div>
            <div className="pc-signal-track" aria-label="Circuit Signal progress"><span style={{ width: `${state.preview ? 0 : signal.progressToNext}%` }} /></div>
            <p className="pc-signal-note">Status only · never balance.</p>
          </article>
          <article className="pc-missions-card pc-luxe-unlocks-card">
            <span className="app-eyebrow">Next unlocks</span><h3>Three marks worth reaching.</h3>
            <div className="pc-mission-list">{missions.map((mission, index) => { const done = !state.preview && mission.done; return <div className={`pc-mission ${done ? "done" : ""}`} key={mission.title}><i>{done ? "✓" : index + 1}</i><div><strong>{mission.title}</strong><small>{mission.note}</small></div><b>{state.preview ? "Locked" : done ? "Unlocked" : "Next"}</b></div>; })}</div>
          </article>
        </div>
        <article className="pc-momentum-card pc-luxe-rhythm-track">
          <div className="pc-momentum-top"><div><span>Current rhythm</span><strong>{state.preview ? "—" : `${state.streakDays} day${state.streakDays === 1 ? "" : "s"}`}</strong></div><div><span>Rank</span><strong>{state.preview ? "—" : signal.stage}</strong></div></div>
          <div className="pc-milestone-track" aria-label="Rhythm milestones">{rhythmMilestones.map((milestone) => <span key={milestone} className={!state.preview && state.streakDays >= milestone ? "done" : ""}>{milestone}d</span>)}</div>
        </article>
      </section>

      <section className="pc-luxe-share-strip">
        <div><span className="app-eyebrow">Share the climb</span><h2>Turn a real milestone into a premium moment.</h2></div>
        <Link className="button button-ghost" href="/progress#circuit-moments">Open share studio <ArrowUpRight /></Link>
      </section>

      <section className="app-section pc-luxe-turbo-section"><div className="app-section-head"><div><span className="app-eyebrow">Turbo</span><h2>{liveTurboRoute ? "Want another route?" : "Core first. Extras second."}</h2></div><Link href="/earn">Open Turbo <ArrowUpRight /></Link></div><article className="invite-card pc-luxe-turbo-card"><div className="invite-icon">{liveTurboRoute ? <Bolt /> : <Shield />}</div><div><h3>{liveTurboRoute ? "Optional earning, on your terms." : "Pulse never depends on an offerwall."}</h3><p>{liveTurboRoute ? "Use Turbo when you want more than the base circuit." : "External supply can change without changing your core experience."}</p></div><Link href="/earn" className="icon-button" aria-label="Open Turbo"><ArrowUpRight /></Link></article></section>

      <section className="dashboard-lower-grid pc-luxe-lower-grid">
        <article className="progress-card pc-luxe-vault-progress"><div className="app-eyebrow">Vault progress</div>{payoutCredits && !state.preview ? <><div className="progress-value"><strong>{formatUsdFromCredits(state.availableCredits)}</strong><span>/ {formatUsdFromCredits(payoutCredits)}</span></div><div className="progress-track large"><span style={{width:`${progress}%`}} /></div><p>{away && away > 0 ? <><strong>{formatUsdFromCredits(away)}</strong> to the current payout target.</> : <strong>Target reached.</strong>}</p></> : <><div className="progress-value"><strong>Not active</strong></div><div className="progress-track large"><span style={{width:"0%"}} /></div><p>The target appears when the payout pack is proven.</p></>}<Link href="/wallet" className="inline-action"><Bolt /> Open Vault</Link></article>
        <article className="invite-card pc-luxe-share-growth"><div className="invite-icon"><Users /></div><div><span className="app-eyebrow">Share</span><h3>Invite people into something worth returning to.</h3><p>Verified activity unlocks referral progress.</p></div><Link href="/invite" className="icon-button" aria-label="Open Share"><ArrowUpRight /></Link></article>
      </section>

      <section className="pulse-proof-link pc-luxe-proof-link"><div><span className="app-eyebrow">Live Proof</span><h2>See what was actually credited and paid.</h2></div><Link className="button button-ghost" href="/proof">Open Proof <ArrowUpRight /></Link></section>
    </AppShell>
  );
}
