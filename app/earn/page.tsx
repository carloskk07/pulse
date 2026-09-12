import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Clock, Shield, Spark, Trend } from "@/components/icons";
import { getRankedOpportunities, type RankedOpportunity } from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatUsdFromCredits, getRewardSnapshot } from "@/lib/reward-state";
import { getTreasurySnapshot } from "@/lib/treasury";
import { getRewardEntryChannels } from "@/providers/registry";

export const metadata = { title: "Earn" };

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

export default async function EarnPage() {
  const [state, supabase, ranked, treasuries] = await Promise.all([
    getRewardSnapshot(),
    createSupabaseServerClient(),
    getRankedOpportunities(24),
    getTreasurySnapshot(),
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
      <div className="app-page-head"><div><span className="app-eyebrow">Reward Exchange</span><h1>Earn</h1><p>Less inventory noise. Better decisions.</p></div><div className="balance-chip"><small>Available</small><strong>{formatUsdFromCredits(state.availableCredits)}</strong></div></div>

      <section className="drop-stage">
        <article className="drop-card">
          <div className="drop-card-head">
            <span className="status-pill status-lime"><Spark /> {best ? "Best value now" : primaryChannel ? "Live route" : "Exchange gated"}</span>
            <div className="pulse-line protected">{best ? healthLabel(best) : "Verified flow"}</div>
          </div>
          <div className="drop-card-main">
            <h2>{best ? best.title : primaryChannel ? "Live reward inventory is connected." : "No payable route is exposed yet."}</h2>
            <p>{best ? "Pulse ranks this opportunity only after freshness, health and evidence quality are considered." : primaryChannel ? "Open the connected earning route. The provider stays behind the experience while Pulse protects the resulting ledger event." : "The exchange stays empty rather than filling the screen with simulated opportunities."}</p>
          </div>
          <div className="drop-card-foot">
            <div className="drop-stat">
              <div><small>Time</small><strong>{best?.estimatedMinutes ? `~${best.estimatedMinutes} min` : "Live"}</strong></div>
              <div><small>Confidence</small><strong>{best ? `${Math.round(best.confidence * 100)}%` : primaryChannel ? "Verified route" : "—"}</strong></div>
              {best ? <div><small>Evidence</small><strong>{evidenceLabel(best)}</strong></div> : null}
            </div>
            <div className="drop-value"><small>{best ? "Reward" : "Inventory"}</small><strong>{best ? formatUsdFromCredits(best.baseRewardCredits) : primaryChannel ? "Live" : "Closed"}</strong></div>
          </div>
        </article>

        <aside className="drop-aside">
          <div>
            <span className="app-eyebrow">Pulse selection</span>
            <h3>Best use of your time.</h3>
            <p>Stale inventory is hidden. New offers start conservatively. Proven opportunities earn their position with evidence.</p>
            <div className="time-options" aria-label="Opportunity selection dimensions"><span className="time-option active">Fresh</span><span className="time-option">Value</span><span className="time-option">Evidence</span><span className="time-option">Risk</span></div>
          </div>
          {primaryChannel ? <a className="button button-light" href={primaryChannel.href} target="_blank" rel="noopener sponsored">Open live inventory <ArrowUpRight /></a> : <span className="status-pill"><Shield /> Waiting for live route</span>}
        </aside>
      </section>

      {quickWins.length ? (
        <section className="app-section intelligence-section">
          <div className="app-section-head"><div><span className="app-eyebrow">Quick Wins</span><h2>Good options for the next 10 minutes.</h2></div><span className="status-pill"><Clock /> Time aware</span></div>
          <div className="quick-win-grid">
            {quickWins.map((item) => (
              <article className="quick-win-card" key={item.id}>
                <div className="quick-win-top"><span>{healthLabel(item)}</span><small>{evidenceLabel(item)}</small></div>
                <h3>{item.title}</h3>
                <div className="quick-win-value"><strong>{formatUsdFromCredits(item.baseRewardCredits)}</strong><span>~{item.estimatedMinutes} min</span></div>
                <div className="quick-win-foot"><span>{item.expectedCreditsPerMinute == null ? "Value learning" : `${formatUsdFromCredits(item.expectedCreditsPerMinute)} expected / min`}</span><b>{Math.round(item.confidence * 100)}%</b></div>
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
              <article className="reward-row intelligence-row" key={item.id}>
                <div className="reward-row-main"><span className="reward-rank">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><small>{item.category} · {evidenceLabel(item)}</small></div></div>
                <div className="reward-metric"><small>Reward</small><strong>{formatUsdFromCredits(item.baseRewardCredits)}</strong></div>
                <div className="reward-metric"><small>Time</small><strong>{item.estimatedMinutes ? `${item.estimatedMinutes}m` : "—"}</strong></div>
                <div className="reward-metric"><small>Health</small><strong className={`health-text ${item.healthState}`}>{healthLabel(item)}</strong></div>
                <div className="reward-metric"><small>Confidence</small><strong className="reward-confidence">{Math.round(item.confidence * 100)}%</strong></div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="earn-feature"><div><span className="section-kicker">Truthful inventory</span><h2>No normalized opportunity is being fabricated to make the exchange look busy.</h2><p>{primaryChannel ? "The connected provider route is live above; normalized ranking appears as fresh catalog evidence becomes available." : "The product remains useful without pretending inventory exists."}</p></div><div className="earn-feature-metric"><strong>0</strong><span>simulated offers</span></div></section>
      )}

      <section className="earning-principles"><article><span>01</span><h3>Fresh before ranked.</h3><p>An opportunity must still be alive inside its own freshness window before Pulse can recommend it.</p></article><article><span>02</span><h3>Unknown is not excellent.</h3><p>Missing evidence reduces confidence instead of receiving optimistic defaults.</p></article><article><span>03</span><h3>Fast value becomes visible.</h3><p>Quick Wins surface strong opportunities that fit naturally inside short spare-time windows.</p></article></section>
    </AppShell>
  );
}
