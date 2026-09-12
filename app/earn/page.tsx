import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Clock, Shield, Spark, Trend } from "@/components/icons";
import { getRankedOpportunities, type RankedOpportunity } from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatUsdFromCredits, getRewardSnapshot } from "@/lib/reward-state";
import { getTreasurySnapshot } from "@/lib/treasury";
import { getRewardEntryChannels } from "@/providers/registry";

export const metadata = { title: "Earn" };

type Props = { searchParams: Promise<{ direct?: string }> };

const directCopy: Record<string, string> = {
  "already-completed": "You already completed this protected campaign.",
  capacity_reserved: "All currently funded slots are temporarily reserved. Try this Drop again shortly.",
  completion_cap_reached: "This Drop reached its verified completion limit.",
  campaign_not_active: "That Drop is not accepting new starts right now.",
  campaign_ended: "That Drop has ended.",
  not_started: "That Drop has not opened yet.",
  "origin-rejected": "The protected start was rejected by the request security check.",
  unavailable: "The protected start could not be reserved. No reward was promised or deducted.",
  invalid: "That campaign link is not valid.",
  "session-error": "The protected session could not be created safely.",
  "destination-error": "The advertiser destination did not pass the secure redirect check.",
  "service-unavailable": "Pulse Direct is temporarily unavailable. No funded action was started.",
};

function evidenceLabel(item: RankedOpportunity) {
  if (item.evidenceTier === "proven") return "Proven";
  if (item.evidenceTier === "strong") return "Strong evidence";
  if (item.evidenceTier === "limited") return "Limited evidence";
  if (item.evidenceTier === "new") return "New";
  return "Learning";
}

function healthLabel(item: RankedOpportunity) {
  if (item.healthState === "excellent") return "Excellent health";
  if (item.healthState === "good") return "Healthy";
  if (item.healthState === "degraded") return "Watch";
  return "Monitoring";
}

function opportunityTrust(item: RankedOpportunity) {
  return item.pulseProtected ? "Pulse Protected" : evidenceLabel(item);
}

export default async function EarnPage({ searchParams }: Props) {
  const [state, supabase, ranked, treasuries, params] = await Promise.all([
    getRewardSnapshot(),
    createSupabaseServerClient(),
    getRankedOpportunities(24),
    getTreasurySnapshot(),
    searchParams,
  ]);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const channels = user ? getRewardEntryChannels(user.id) : [];
  const primaryChannel = channels[0] ?? null;
  const best = ranked[0] ?? null;
  const quickWins = ranked.filter((item) => item.quickWin).slice(0, 4);
  const topRanked = ranked.slice(0, 8);
  const activeTreasury = treasuries.find((item) => item.enabled && !item.killSwitch && item.availableCredits > 0) ?? null;

  return (
    <AppShell active="earn">
      <div className="app-page-head"><div><span className="app-eyebrow">Reward Exchange</span><h1>Drops</h1><p>Less inventory noise. Better decisions.</p></div><div className="balance-chip"><small>Available</small><strong>{formatUsdFromCredits(state.availableCredits)}</strong></div></div>

      {params.direct ? <div className="claim-message neutral">{directCopy[params.direct] ?? "The protected campaign state changed before the action started."}</div> : null}

      <section className={`drop-stage ${best?.pulseProtected ? "drop-stage-protected" : ""}`}>
        <article className="drop-card">
          <div className="drop-card-head">
            <span className="status-pill status-lime"><Spark /> {best ? "Best value now" : primaryChannel ? "Live route" : "Exchange gated"}</span>
            <div className={`pulse-line ${best?.pulseProtected ? "protected" : ""}`}>{best?.pulseProtected ? "Pulse Protected" : best ? healthLabel(best) : "Verified flow"}</div>
          </div>
          <div className="drop-card-main">
            <h2>{best ? best.title : primaryChannel ? "Live reward inventory is connected." : "No payable route is exposed yet."}</h2>
            <p>{best?.pulseProtected ? "This direct campaign is prefunded. Starting it reserves the advertiser budget for your protected session before you leave Pulse." : best ? "Pulse ranks this opportunity only after freshness, health and evidence quality are considered." : primaryChannel ? "Open the connected earning route. The provider stays behind the experience while Pulse protects the resulting ledger event." : "The exchange stays empty rather than filling the screen with simulated opportunities."}</p>
          </div>
          <div className="drop-card-foot">
            <div className="drop-stat">
              <div><small>Time</small><strong>{best?.estimatedMinutes ? `~${best.estimatedMinutes} min` : "Live"}</strong></div>
              <div><small>Confidence</small><strong>{best ? `${Math.round(best.confidence * 100)}%` : primaryChannel ? "Verified route" : "—"}</strong></div>
              {best ? <div><small>Authority</small><strong>{opportunityTrust(best)}</strong></div> : null}
            </div>
            <div className="drop-value"><small>{best ? "Reward" : "Inventory"}</small><strong>{best ? formatUsdFromCredits(best.baseRewardCredits) : primaryChannel ? "Live" : "Closed"}</strong></div>
          </div>
          {best?.pulseProtected ? (
            <form action="/api/direct/start" method="post" className="direct-start-form">
              <input type="hidden" name="campaign" value={best.externalId} />
              <button className="button button-light direct-primary-action" type="submit">Start protected Drop <ArrowUpRight /></button>
            </form>
          ) : primaryChannel ? <a className="button button-light direct-primary-action" href={primaryChannel.href} target="_blank" rel="noopener sponsored">Open live inventory <ArrowUpRight /></a> : null}
        </article>

        <aside className="drop-aside">
          <div>
            <span className="app-eyebrow">Pulse selection</span>
            <h3>Best use of your time.</h3>
            <p>Stale inventory is hidden. New offers start conservatively. Direct campaigns reserve funded budget before the user is sent to the advertiser.</p>
            <div className="time-options" aria-label="Opportunity selection dimensions"><span className="time-option active">Fresh</span><span className="time-option">Value</span><span className="time-option">Evidence</span><span className="time-option">Protected</span></div>
          </div>
          {best?.pulseProtected ? <span className="status-pill"><Shield /> Budget reserved on start</span> : primaryChannel ? <span className="status-pill"><Shield /> Partner route verified</span> : <span className="status-pill"><Shield /> Waiting for live route</span>}
        </aside>
      </section>

      {quickWins.length ? (
        <section className="app-section intelligence-section">
          <div className="app-section-head"><div><span className="app-eyebrow">Quick Wins</span><h2>Good options for the next 10 minutes.</h2></div><span className="status-pill"><Clock /> Time aware</span></div>
          <div className="quick-win-grid">
            {quickWins.map((item) => (
              <article className={`quick-win-card ${item.pulseProtected ? "quick-win-protected" : ""}`} key={item.id}>
                <div className="quick-win-top"><span>{item.pulseProtected ? "Pulse Protected" : healthLabel(item)}</span><small>{evidenceLabel(item)}</small></div>
                <h3>{item.title}</h3>
                <div className="quick-win-value"><strong>{formatUsdFromCredits(item.baseRewardCredits)}</strong><span>~{item.estimatedMinutes} min</span></div>
                <div className="quick-win-foot"><span>{item.expectedCreditsPerMinute == null ? "Value learning" : `${formatUsdFromCredits(item.expectedCreditsPerMinute)} expected / min`}</span><b>{Math.round(item.confidence * 100)}%</b></div>
                {item.pulseProtected ? <form action="/api/direct/start" method="post" className="direct-start-form compact"><input type="hidden" name="campaign" value={item.externalId} /><button className="inline-action direct-inline-action" type="submit">Start protected <ArrowUpRight /></button></form> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTreasury ? <section className="earn-feature"><div><span className="section-kicker">Pulse Boost Pool</span><h2>{formatUsdFromCredits(activeTreasury.availableCredits)} is currently available for controlled reward boosts.</h2><p>Boosts remain budget-backed and can stop automatically when the configured limit is reached.</p></div><div className="earn-feature-metric"><strong>{formatUsdFromCredits(activeTreasury.availableCredits)}</strong><span>available</span></div></section> : null}

      {topRanked.length ? (
        <section className="app-section intelligence-section">
          <div className="app-section-head"><div><span className="app-eyebrow">Opportunity Intelligence</span><h2>Fresh opportunities, evidence weighted.</h2></div><span className="status-pill"><Trend /> Quality adjusted</span></div>
          <div className="reward-list">
            {topRanked.map((item, index) => (
              <article className={`reward-row intelligence-row ${item.pulseProtected ? "direct-opportunity-row" : ""}`} key={item.id}>
                <div className="reward-row-main"><span className="reward-rank">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><small>{item.category} · {item.pulseProtected ? "Pulse Protected" : evidenceLabel(item)}</small></div></div>
                <div className="reward-metric"><small>Reward</small><strong>{formatUsdFromCredits(item.baseRewardCredits)}</strong></div>
                <div className="reward-metric"><small>Time</small><strong>{item.estimatedMinutes ? `${item.estimatedMinutes}m` : "—"}</strong></div>
                <div className="reward-metric"><small>Health</small><strong className={`health-text ${item.healthState}`}>{healthLabel(item)}</strong></div>
                <div className="reward-metric"><small>Confidence</small><strong className="reward-confidence">{Math.round(item.confidence * 100)}%</strong></div>
                {item.pulseProtected ? <form action="/api/direct/start" method="post" className="direct-start-form compact"><input type="hidden" name="campaign" value={item.externalId} /><button className="direct-row-action" type="submit" aria-label={`Start ${item.title}`}>Start <ArrowUpRight /></button></form> : null}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="earn-feature"><div><span className="section-kicker">Truthful inventory</span><h2>No normalized opportunity is being fabricated to make the exchange look busy.</h2><p>{primaryChannel ? "The connected provider route is live above; normalized ranking appears as fresh catalog evidence becomes available." : "The product remains useful without pretending inventory exists."}</p></div><div className="earn-feature-metric"><strong>0</strong><span>simulated offers</span></div></section>
      )}

      <section className="earning-principles"><article><span>01</span><h3>Direct means funded first.</h3><p>Pulse Direct campaigns cannot go live until operator-verified advertiser funding can cover at least one complete action.</p></article><article><span>02</span><h3>Protected means reserved.</h3><p>Starting a direct Drop reserves its full advertiser spend for that session before redirecting the user.</p></article><article><span>03</span><h3>Settlement stays atomic.</h3><p>A verified callback spends campaign budget and creates the user ledger reward inside one database transaction.</p></article></section>
    </AppShell>
  );
}
