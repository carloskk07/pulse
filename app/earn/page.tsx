import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Shield, Spark, Trend } from "@/components/icons";
import { getRankedOpportunities } from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatUsdFromCredits, getRewardSnapshot } from "@/lib/reward-state";
import { getTreasurySnapshot } from "@/lib/treasury";
import { getRewardEntryChannels } from "@/providers/registry";

export const metadata = { title: "Earn" };

export default async function EarnPage() {
  const [state, supabase, ranked, treasuries] = await Promise.all([
    getRewardSnapshot(),
    createSupabaseServerClient(),
    getRankedOpportunities(8),
    getTreasurySnapshot(),
  ]);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const channels = user ? getRewardEntryChannels(user.id) : [];
  const primaryChannel = channels[0] ?? null;
  const best = ranked[0] ?? null;
  const activeTreasury = treasuries.find((item) => item.enabled && !item.killSwitch && item.availableCredits > 0) ?? null;

  return (
    <AppShell active="earn">
      <div className="app-page-head"><div><span className="app-eyebrow">Reward Exchange</span><h1>Earn</h1><p>Less inventory noise. Better decisions.</p></div><div className="balance-chip"><small>Available</small><strong>{formatUsdFromCredits(state.availableCredits)}</strong></div></div>

      <section className="drop-stage">
        <article className="drop-card">
          <div className="drop-card-head">
            <span className="status-pill status-lime"><Spark /> {best ? "Best value now" : primaryChannel ? "Live route" : "Exchange gated"}</span>
            <div className="pulse-line protected">Verified flow</div>
          </div>
          <div className="drop-card-main">
            <h2>{best ? best.title : primaryChannel ? "Live reward inventory is connected." : "No payable route is exposed yet."}</h2>
            <p>{best ? "Pulse ranks this opportunity using reward value plus the quality signals currently available to the exchange." : primaryChannel ? "Open the connected earning route. The provider stays behind the experience while Pulse protects the resulting ledger event." : "The exchange stays empty rather than filling the screen with simulated opportunities."}</p>
          </div>
          <div className="drop-card-foot">
            <div className="drop-stat">
              <div><small>Time</small><strong>{best?.estimatedMinutes ? `~${best.estimatedMinutes} min` : "Live"}</strong></div>
              <div><small>Confidence</small><strong>{best ? `${Math.round(best.confidence * 100)}%` : primaryChannel ? "Verified route" : "—"}</strong></div>
            </div>
            <div className="drop-value"><small>{best ? "Reward" : "Inventory"}</small><strong>{best ? formatUsdFromCredits(best.baseRewardCredits) : primaryChannel ? "Live" : "Closed"}</strong></div>
          </div>
        </article>

        <aside className="drop-aside">
          <div>
            <span className="app-eyebrow">Pulse selection</span>
            <h3>Best use of your time.</h3>
            <p>Pulse is designed to favor useful reward value instead of sorting everything by the largest headline number.</p>
            <div className="time-options" aria-label="Opportunity selection dimensions"><span className="time-option active">Fast</span><span className="time-option">Value</span><span className="time-option">Trust</span><span className="time-option">Risk</span></div>
          </div>
          {primaryChannel ? <a className="button button-light" href={primaryChannel.href} target="_blank" rel="noopener sponsored">Open live inventory <ArrowUpRight /></a> : <span className="status-pill"><Shield /> Waiting for live route</span>}
        </aside>
      </section>

      {activeTreasury ? <section className="earn-feature"><div><span className="section-kicker">Pulse Boost Pool</span><h2>{formatUsdFromCredits(activeTreasury.availableCredits)} is currently available for controlled reward boosts.</h2><p>Boosts remain budget-backed and can stop automatically when the configured limit is reached.</p></div><div className="earn-feature-metric"><strong>{formatUsdFromCredits(activeTreasury.availableCredits)}</strong><span>available</span></div></section> : null}

      {ranked.length ? (
        <section className="app-section">
          <div className="app-section-head"><div><span className="app-eyebrow">Best value engine</span><h2>Live opportunities, ranked.</h2></div><span className="status-pill"><Trend /> Risk adjusted</span></div>
          <div className="reward-list">
            {ranked.map((item, index) => (
              <article className="reward-row" key={item.id}>
                <div className="reward-row-main"><span className="reward-rank">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><small>{item.category}</small></div></div>
                <div className="reward-metric"><small>Reward</small><strong>{formatUsdFromCredits(item.baseRewardCredits)}</strong></div>
                <div className="reward-metric"><small>Time</small><strong>{item.estimatedMinutes ? `${item.estimatedMinutes}m` : "—"}</strong></div>
                <div className="reward-metric"><small>Confidence</small><strong className="reward-confidence">{Math.round(item.confidence * 100)}%</strong></div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="earn-feature"><div><span className="section-kicker">Truthful inventory</span><h2>No normalized opportunity is being fabricated to make the exchange look busy.</h2><p>{primaryChannel ? "The connected provider route is live above; normalized ranking appears as real catalog data becomes available." : "The product remains useful without pretending inventory exists."}</p></div><div className="earn-feature-metric"><strong>0</strong><span>simulated offers</span></div></section>
      )}

      <section className="earning-principles"><article><span>01</span><h3>Best value, not biggest headline.</h3><p>Ranking can account for reward, time, completion probability, tracking quality and reversal risk.</p></article><article><span>02</span><h3>Credit only verified events.</h3><p>No browser-side balance edits. Server callbacks remain authoritative.</p></article><article><span>03</span><h3>Boost only with reserved budget.</h3><p>Treasury subsidy appears only when real budget and settlement authority exist.</p></article></section>
    </AppShell>
  );
}
