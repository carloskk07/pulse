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
  const nextMission = missions.find((mission) => !mission.done) ?? null;
  const vaultPercent = Math.max(0, Math.min(100, Math.round(progress)));
  const payoutTargetLabel = payout.ready && payout.display ? payout.display : "Not active";

  return (
    <AppShell active="home">
      <div className="pc-v9-dashboard">
        <div className="app-page-head pulse-page-head pc-luxe-dashboard-head pc-v9-head">
          <div className="pc-v9-head-copy">
            <div className="pulse-line">Live circuit</div>
            <h1>{state.preview ? "Your circuit is waiting." : <>Your circuit <em>is moving.</em></>}</h1>
            <p>{state.preview ? "Live state appears when the reward service is connected." : "One funded Pulse at a time. Build rhythm, strengthen Signal and move the Vault toward a real payout."}</p>
            {!state.preview ? (
              <div className="pc-v9-head-proof" aria-label="Live circuit proof">
                <span><i /> Funded rail</span>
                <span><Shield /> Verified history</span>
                <span><Spark /> Signal {signal.signal}/100</span>
              </div>
            ) : null}
          </div>

          <Link href="/wallet" className="balance-chip balance-chip-v2 pc-luxe-vault-chip pc-v9-vault-chip" aria-label="Open Vault">
            <div className="pc-v9-vault-chip-head"><small>Vault</small><span>{vaultPercent}%</span></div>
            <strong>{state.preview ? "—" : formatUsdFromCredits(state.availableCredits)}</strong>
            {!state.preview ? <span>{state.availableCredits.toLocaleString("en-US")} P · target {payoutTargetLabel}</span> : null}
            <div className="pc-v9-vault-mini-track" aria-hidden="true"><i style={{ width: `${state.preview ? 0 : vaultPercent}%` }} /></div>
          </Link>
        </div>

        {params.claim ? <div className={`claim-message ${claimSucceeded ? "success" : "neutral"}`}>{claimCopy[params.claim] ?? "Circuit updated."}{claimSucceeded ? <Link href="/progress#circuit-moments">Share the moment <ArrowUpRight /></Link> : null}</div> : null}
        {state.preview ? <div className="preview-banner">Preview only — no financial state is simulated.</div> : null}

        <section className="pc-dashboard-ribbon pc-luxe-hud pc-v9-hud" aria-label="Circuit status">
          <article className={visualState === "ready" ? "live" : ""}><small>Pulse</small><strong>{state.preview ? "Preview" : !state.pulseFundingReady ? "Standby" : state.claimReady ? "Ready" : "Charging"}</strong><span>{state.claimReady ? "Window open" : "Live cycle"}</span></article>
          <article className="violet"><small>Rank</small><strong>{state.preview ? "—" : signal.stage}</strong><span>Signal {state.preview ? "—" : signal.signal}</span></article>
          <article className="cyan"><small>Rhythm</small><strong>{state.preview ? "—" : `${state.streakDays}d`}</strong><span>{state.streakDays > 0 ? "Return streak" : "Build rhythm"}</span></article>
          <article className="warm"><small>Trust</small><strong>{state.preview ? "—" : trust}</strong><span>{state.preview ? "Awaiting state" : `${state.trustLevel}/5 live level`}</span></article>
        </section>

        <section className="dashboard-hero hourly-pulse-stage pc-luxe-pulse-stage pc-v9-stage">
          <div className={`daily-pulse-card hourly-pulse-card pc-luxe-pulse-chamber pc-v9-chamber state-${visualState} ${claimSucceeded ? "is-claimed" : ""}`}>
            <div className="pc-v9-horizon" aria-hidden="true" />
            <div className="pulse-stage-watermark" aria-hidden="true"><span>PULSERCUIT</span><b>09</b></div>

            <div className="daily-pulse-copy pc-luxe-pulse-copy pc-v9-pulse-copy">
              <span className="status-pill status-lime"><Spark /> {state.preview ? "Awaiting live state" : `${signal.stage} · Signal ${signal.signal}`}</span>
              <h2>{state.preview ? "The Pulse begins when the live circuit connects." : !state.pulseFundingReady ? "Pulse is on standby." : state.claimReady ? "Your Pulse is ready." : "Your next Pulse is forming."}</h2>
              <p>{state.preview ? "No reward value is shown before the live service is authoritative." : !state.pulseFundingReady ? "Rewards reopen only when funding and safety controls are live." : state.claimReady ? `+${state.claimRewardCredits} P is funded and available now.` : "The circuit is already counting down. Return when the live window opens and keep your trajectory intact."}</p>

              {state.preview ? <button className="button button-light pulse-claim-button" disabled>Live service required</button> : canClaim ? <form action="/api/pulse/claim" method="post" className="claim-form"><TurnstileField action="hourly_pulse" /><button className="button button-light pulse-claim-button pc-luxe-claim pc-v9-primary-cta" type="submit">Claim +{state.claimRewardCredits} P <ArrowUpRight /></button></form> : state.claimReady ? state.signedIn ? <button className="button button-light pulse-claim-button" disabled>{state.pulseFundingReady ? "Verification unavailable" : "Pulse on standby"}</button> : <Link href="/auth?next=/dashboard" className="button button-light pulse-claim-button">Enter to claim <ArrowUpRight /></Link> : <button className="button button-light pulse-claim-button" disabled>Charging <Check /></button>}

              {!state.preview ? (
                <div className="pc-v9-trajectory" aria-label="Circuit trajectory">
                  <article><small>History</small><strong>{state.hourlyClaimCount.toLocaleString("en-US")} Pulses</strong><span>authoritative claims</span></article>
                  <article><small>Payout distance</small><strong>{away === null ? "—" : away <= 0 ? "Ready" : `${away.toLocaleString("en-US")} P`}</strong><span>{away !== null && away > 0 ? "remaining to target" : "current pack reached"}</span></article>
                  <article><small>Next unlock</small><strong>{nextMission?.title ?? "Circuit clear"}</strong><span>{nextMission?.note ?? "All current marks reached."}</span></article>
                </div>
              ) : null}
            </div>

            <div className="pulse-core-panel pc-luxe-core-panel pc-v9-core-panel" aria-label="Pulse state">
              {!state.preview ? (
                <div className="pc-v9-core-telemetry" aria-hidden="true">
                  <span className="north">SIGNAL <b>{signal.signal}</b></span>
                  <span className="east">VAULT <b>{vaultPercent}%</b></span>
                  <span className="south">RHYTHM <b>{state.streakDays}d</b></span>
                </div>
              ) : null}
              <PulseCoreVisual state={visualState} eyebrow={pulseEyebrow} caption={pulseCaption}>
                {state.pulseFundingReady ? <PulseCountdown target={state.nextClaimAt} /> : <span className="pulse-core-word">STANDBY</span>}
              </PulseCoreVisual>
              <div className="pulse-core-meta">
                <div className="pulse-trust-mini"><Shield /><span>{trust}</span><b>{state.trustLevel}/5</b></div>
                <div className="streak-days" aria-label="Pulse rhythm">{[1,2,3,4,5,6,7].map((day) => <span key={day} className={!state.preview && day <= Math.min(state.streakDays, 7) ? "done" : ""}>{!state.preview && day <= Math.min(state.streakDays, 7) ? <Check /> : day}</span>)}</div>
                <small className="pulse-rhythm-label">{state.streakDays > 0 ? `${state.streakDays}-day rhythm` : "Build your first rhythm"}</small>
              </div>
            </div>

            <div className="pulse-integrity-rail pc-luxe-integrity pc-v9-integrity" aria-label="Pulse principles">
              <span><i className="integrity-dot" />Funded only</span>
              <span><i className="integrity-dot" />Rolling window</span>
              <span><i className="integrity-dot" />Turbo optional</span>
              <strong className={state.pulseFundingReady ? "online" : "standby"}>{state.pulseFundingReady ? "LIVE" : "STANDBY"}</strong>
            </div>
          </div>
        </section>

        {showFirstPulseGuide ? <section className="first-reward-guide pulse-onboarding pc-luxe-onboarding"><div className="first-reward-copy"><span className="app-eyebrow">First run</span><h2>Claim. Return. Rise.</h2><p>Your first funded Pulse starts the circuit.</p></div><div className="first-reward-steps"><div><span>1</span><strong>Claim</strong></div><div><span>2</span><strong>Return</strong></div><div><span>3</span><strong>Rise</strong></div></div></section> : null}

        <section className="app-section pc-luxe-momentum-section pc-v9-momentum">
          <div className="app-section-head"><div><span className="app-eyebrow">Momentum</span><h2>Make every return visible.</h2><p className="pc-v9-section-sub">Signal, rhythm and Vault progress now tell one story: how far the circuit has actually moved.</p></div>{!state.preview && state.signedIn ? <ShareRhythmButton days={state.streakDays} signal={signal.signal} /> : <Link href="/progress">Open Momentum <ArrowUpRight /></Link>}</div>

          <div className="pc-v9-progress-deck">
            <article className="pc-v9-progress-card signal-card">
              <span className="app-eyebrow">Circuit Signal</span>
              <div className="pc-v9-progress-value"><strong>{state.preview ? "—" : signal.signal}</strong><span>/100</span></div>
              <h3>{state.preview ? "Awaiting history" : signal.stage}</h3>
              <div className="pc-v9-bar"><i style={{ width: `${state.preview ? 0 : signal.progressToNext}%` }} /></div>
              <p>Rank is earned from real activity, not from balance.</p>
            </article>

            <article className="pc-v9-progress-card vault-card">
              <span className="app-eyebrow">Vault runway</span>
              <div className="pc-v9-progress-value"><strong>{state.preview ? "—" : `${vaultPercent}%`}</strong></div>
              <h3>{payoutTargetLabel}</h3>
              <div className="pc-v9-bar vault"><i style={{ width: `${state.preview ? 0 : vaultPercent}%` }} /></div>
              <p>{state.preview || away === null ? "Target appears when the payout pack is proven." : away > 0 ? `${away.toLocaleString("en-US")} P remain before the current payout target.` : "Current payout target reached."}</p>
              <Link href="/wallet">Open Vault <ArrowUpRight /></Link>
            </article>

            <article className="pc-v9-progress-card unlock-card">
              <span className="app-eyebrow">Next unlock</span>
              <div className="pc-v9-unlock-mark"><Spark /></div>
              <h3>{state.preview ? "Awaiting history" : nextMission?.title ?? "Current marks complete"}</h3>
              <p>{state.preview ? "Live state reveals the next factual milestone." : nextMission?.note ?? "You have reached every currently defined mission."}</p>
              <Link href="/progress">Open Momentum <ArrowUpRight /></Link>
            </article>
          </div>

          <div className="pc-signal-grid pc-luxe-signal-grid pc-v9-signal-grid">
            <article className="pc-missions-card pc-luxe-unlocks-card">
              <span className="app-eyebrow">Live milestones</span><h3>Three marks worth reaching.</h3>
              <div className="pc-mission-list">{missions.map((mission, index) => { const done = !state.preview && mission.done; return <div className={`pc-mission ${done ? "done" : ""}`} key={mission.title}><i>{done ? "✓" : index + 1}</i><div><strong>{mission.title}</strong><small>{mission.note}</small></div><b>{state.preview ? "Locked" : done ? "Unlocked" : "Next"}</b></div>; })}</div>
            </article>

            <article className="pc-momentum-card pc-luxe-rhythm-track pc-v9-rhythm-card">
              <div className="pc-momentum-top"><div><span>Current rhythm</span><strong>{state.preview ? "—" : `${state.streakDays} day${state.streakDays === 1 ? "" : "s"}`}</strong></div><div><span>Rank</span><strong>{state.preview ? "—" : signal.stage}</strong></div></div>
              <div className="pc-milestone-track" aria-label="Rhythm milestones">{rhythmMilestones.map((milestone) => <span key={milestone} className={!state.preview && state.streakDays >= milestone ? "done" : ""}>{milestone}d</span>)}</div>
              <p>Each return extends a visible rhythm without changing financial authority.</p>
            </article>
          </div>
        </section>

        <section className="pc-luxe-share-strip pc-v9-share-strip">
          <div><span className="app-eyebrow">Share the climb</span><h2>Make a real milestone feel worth remembering.</h2><p>Share rank, rhythm and progress — never private balances.</p></div>
          <Link className="button button-ghost" href="/progress#circuit-moments">Open share studio <ArrowUpRight /></Link>
        </section>

        <section className="app-section pc-luxe-turbo-section"><div className="app-section-head"><div><span className="app-eyebrow">Turbo</span><h2>{liveTurboRoute ? "Want another route?" : "Core first. Extras second."}</h2></div><Link href="/earn">Open Turbo <ArrowUpRight /></Link></div><article className="invite-card pc-luxe-turbo-card"><div className="invite-icon">{liveTurboRoute ? <Bolt /> : <Shield />}</div><div><h3>{liveTurboRoute ? "Optional earning, on your terms." : "Pulse never depends on an offerwall."}</h3><p>{liveTurboRoute ? "Use Turbo when you want more than the base circuit." : "External supply can change without changing your core experience."}</p></div><Link href="/earn" className="icon-button" aria-label="Open Turbo"><ArrowUpRight /></Link></article></section>

        <section className="dashboard-lower-grid pc-luxe-lower-grid pc-v9-lower-grid">
          <article className="progress-card pc-luxe-vault-progress"><div className="app-eyebrow">Vault progress</div>{payoutCredits && !state.preview ? <><div className="progress-value"><strong>{formatUsdFromCredits(state.availableCredits)}</strong><span>/ {formatUsdFromCredits(payoutCredits)}</span></div><div className="progress-track large"><span style={{width:`${progress}%`}} /></div><p>{away && away > 0 ? <><strong>{formatUsdFromCredits(away)}</strong> to the current payout target.</> : <strong>Target reached.</strong>}</p></> : <><div className="progress-value"><strong>Not active</strong></div><div className="progress-track large"><span style={{width:"0%"}} /></div><p>The target appears when the payout pack is proven.</p></>}<Link href="/wallet" className="inline-action"><Bolt /> Open Vault</Link></article>
          <article className="invite-card pc-luxe-share-growth"><div className="invite-icon"><Users /></div><div><span className="app-eyebrow">Share</span><h3>Invite people into something worth returning to.</h3><p>Verified activity unlocks referral progress.</p></div><Link href="/invite" className="icon-button" aria-label="Open Share"><ArrowUpRight /></Link></article>
        </section>

        <section className="pulse-proof-link pc-luxe-proof-link pc-v9-proof-link"><div><span className="app-eyebrow">Live Proof</span><h2>See what was actually credited and paid.</h2><p>Authority stays visible. Claims, credits and payouts are separated by evidence.</p></div><Link className="button button-ghost" href="/proof">Open Proof <ArrowUpRight /></Link></section>
      </div>
    </AppShell>
  );
}
