import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Clock, Shield, Spark, Trend } from "@/components/icons";
import { getRankedOpportunities, type RankedOpportunity } from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatUsdFromCredits, getRewardSnapshot } from "@/lib/reward-state";
import { getRewardEntryChannels } from "@/providers/registry";

export const metadata = { title: "Turbo" };

type Props = { searchParams: Promise<{ direct?: string }> };

const directCopy: Record<string, string> = {
  "already-completed": "You already completed this protected Turbo.",
  capacity_reserved: "All funded slots are temporarily reserved. Try again shortly.",
  completion_cap_reached: "This Turbo reached its verified completion limit.",
  campaign_not_active: "That Turbo is not accepting new starts right now.",
  campaign_ended: "That Turbo has ended.",
  not_started: "That Turbo has not opened yet.",
  "origin-rejected": "The protected start was rejected by the request security check.",
  unavailable: "The protected start could not be reserved. No reward was promised or deducted.",
  invalid: "That campaign link is not valid.",
  "session-error": "The protected session could not be created safely.",
  "destination-error": "The destination did not pass the secure redirect check.",
  "service-unavailable": "Turbo is temporarily unavailable. Your base Pulse is unaffected.",
};

function evidenceLabel(item: RankedOpportunity) {
  if (item.evidenceTier === "proven") return "Proven";
  if (item.evidenceTier === "strong") return "Strong evidence";
  if (item.evidenceTier === "limited") return "Limited evidence";
  if (item.evidenceTier === "new") return "New";
  return "Learning";
}

function healthLabel(item: RankedOpportunity) {
  if (item.healthState === "excellent") return "Excellent";
  if (item.healthState === "good") return "Healthy";
  if (item.healthState === "degraded") return "Watch";
  return "Monitoring";
}

export default async function EarnPage({ searchParams }: Props) {
  const [state, supabase, ranked, params] = await Promise.all([
    getRewardSnapshot(),
    createSupabaseServerClient(),
    getRankedOpportunities(24),
    searchParams,
  ]);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const channels = user ? getRewardEntryChannels(user.id) : [];
  const primaryChannel = channels[0] ?? null;
  const best = ranked[0] ?? null;
  const quickWins = ranked.filter((item) => item.quickWin).slice(0, 4);
  const topRanked = ranked.slice(0, 8);

  return (
    <AppShell active="earn">
      <div className="app-page-head"><div><span className="app-eyebrow">Optional earning</span><h1>Turbo</h1><p>Your Hourly Pulse comes first. Turbo exists only when you want to earn more.</p></div><div className="balance-chip"><small>Available</small><strong>{formatUsdFromCredits(state.availableCredits)}</strong></div></div>

      {params.direct ? <div className="claim-message neutral">{directCopy[params.direct] ?? "The protected Turbo state changed before the action started."}</div> : null}

      <section className={`drop-stage turbo-stage ${best?.pulseProtected ? "drop-stage-protected" : ""}`}>
        <article className="drop-card">
          <div className="drop-card-head">
            <span className="status-pill status-lime"><Spark /> {best ? "Best Turbo now" : primaryChannel ? "Turbo route live" : "No Turbo needed"}</span>
            <div className={`pulse-line ${best?.pulseProtected ? "protected" : ""}`}>{best?.pulseProtected ? "Pulse Protected" : best ? healthLabel(best) : "Optional by design"}</div>
          </div>
          <div className="drop-card-main">
            <h2>{best ? best.title : primaryChannel ? "Extra earning is available." : "Nothing to complete right now."}</h2>
            <p>{best?.pulseProtected ? "This direct Turbo is prefunded. Pulse reserves the advertiser budget before you leave the app." : best ? "Pulse ranks opportunities by value, freshness and evidence instead of dumping an offerwall on you." : primaryChannel ? "Open the connected route only if you want extra rewards. The provider is infrastructure, not the Pulse product." : "That is okay. Your base Hourly Pulse remains independent of CPA inventory."}</p>
          </div>
          <div className="drop-card-foot">
            <div className="drop-stat">
              <div><small>Time</small><strong>{best?.estimatedMinutes ? `~${best.estimatedMinutes} min` : primaryChannel ? "Live" : "—"}</strong></div>
              <div><small>Confidence</small><strong>{best ? `${Math.round(best.confidence * 100)}%` : primaryChannel ? "Verified route" : "—"}</strong></div>
              {best ? <div><small>Evidence</small><strong>{best.pulseProtected ? "Prefunded" : evidenceLabel(best)}</strong></div> : null}
            </div>
            <div className="drop-value"><small>{best ? "Extra reward" : "Turbo"}</small><strong>{best ? formatUsdFromCredits(best.baseRewardCredits) : primaryChannel ? "Live" : "Idle"}</strong></div>
          </div>
          {best?.pulseProtected ? (
            <form action="/api/direct/start" method="post" className="direct-start-form">
              <input type="hidden" name="campaign" value={best.externalId} />
              <button className="button button-light direct-primary-action" type="submit">Start Turbo <ArrowUpRight /></button>
            </form>
          ) : primaryChannel ? <a className="button button-light direct-primary-action" href={primaryChannel.href} target="_blank" rel="noopener sponsored">Open Turbo <ArrowUpRight /></a> : <Link className="button button-light direct-primary-action" href="/dashboard">Back to your Pulse <ArrowUpRight /></Link>}
        </article>

        <aside className="drop-aside">
          <div>
            <span className="app-eyebrow">Pulse router</span>
            <h3>Less inventory. Better opportunities.</h3>
            <p>External providers stay replaceable. Pulse can rank partner CPA, direct campaigns and future supply behind one consistent experience.</p>
            <div className="time-options" aria-label="Turbo selection dimensions"><span className="time-option active">Value</span><span className="time-option">Fresh</span><span className="time-option">Reliable</span><span className="time-option">Fast</span></div>
          </div>
          <span className="status-pill"><Shield /> Base Pulse never requires Turbo</span>
        </aside>
      </section>

      {quickWins.length ? (
        <section className="app-section intelligence-section">
          <div className="app-section-head"><div><span className="app-eyebrow">Fast Turbos</span><h2>Good use of a few spare minutes.</h2></div><span className="status-pill"><Clock /> Time aware</span></div>
          <div className="quick-win-grid">
            {quickWins.map((item) => (
              <article className={`quick-win-card ${item.pulseProtected ? "quick-win-protected" : ""}`} key={item.id}>
                <div className="quick-win-top"><span>{item.pulseProtected ? "Pulse Protected" : healthLabel(item)}</span><small>{evidenceLabel(item)}</small></div>
                <h3>{item.title}</h3>
                <div className="quick-win-value"><strong>{formatUsdFromCredits(item.baseRewardCredits)}</strong><span>~{item.estimatedMinutes} min</span></div>
                <div className="quick-win-foot"><span>{item.expectedCreditsPerMinute == null ? "Value learning" : `${formatUsdFromCredits(item.expectedCreditsPerMinute)} expected / min`}</span><b>{Math.round(item.confidence * 100)}%</b></div>
                {item.pulseProtected ? <form action="/api/direct/start" method="post" className="direct-start-form compact"><input type="hidden" name="campaign" value={item.externalId} /><button className="inline-action direct-inline-action" type="submit">Start Turbo <ArrowUpRight /></button></form> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {topRanked.length ? (
        <section className="app-section intelligence-section">
          <div className="app-section-head"><div><span className="app-eyebrow">Turbo intelligence</span><h2>Only evidence-weighted inventory.</h2></div><span className="status-pill"><Trend /> Quality adjusted</span></div>
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
      ) : null}

      <section className="earning-principles"><article><span>01</span><h3>Pulse first.</h3><p>The base reward is a Pulse product and does not require an offer completion.</p></article><article><span>02</span><h3>Turbo is optional.</h3><p>Use it only when the expected extra reward is worth your time.</p></article><article><span>03</span><h3>Providers stay invisible.</h3><p>Pulse owns the experience and ledger while external supply remains replaceable infrastructure.</p></article></section>
    </AppShell>
  );
}
