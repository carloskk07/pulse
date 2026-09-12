import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Shield, Spark, Trend } from "@/components/icons";
import { getRankedOpportunities } from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatUsdFromCredits, getRewardSnapshot } from "@/lib/reward-state";
import { getRewardEntryChannels } from "@/providers/registry";

export const metadata = { title: "Earn" };

export default async function EarnPage() {
  const [state, supabase, ranked] = await Promise.all([
    getRewardSnapshot(),
    createSupabaseServerClient(),
    getRankedOpportunities(6),
  ]);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const channels = user ? getRewardEntryChannels(user.id) : [];
  const primaryChannel = channels[0] ?? null;

  return (
    <AppShell active="earn">
      <div className="app-page-head"><div><span className="app-eyebrow">Reward Exchange</span><h1>Earn</h1><p>One wallet, verified actions and a routing layer built to favor real user value.</p></div><div className="balance-chip"><small>Available</small><strong>{formatUsdFromCredits(state.availableCredits)}</strong></div></div>

      {primaryChannel ? (
        <section className="live-provider-card">
          <div className="live-provider-copy"><span className="status-pill status-lime"><Spark /> Live inventory</span><h2>Open the best live reward inventory currently connected.</h2><p>The provider is an implementation detail. Reward Pulse verifies the resulting event server-side before the ledger changes.</p><a className="button button-light button-lg" href={primaryChannel.href} target="_blank" rel="noopener sponsored">Open live opportunities <ArrowUpRight /></a></div>
          <div className="provider-trust"><Shield /><strong>Reward Exchange protection</strong><span>Server-verified callbacks</span><span>Transaction deduplication</span><span>Automatic reversals</span><span>{channels.length} active earning channel{channels.length === 1 ? "" : "s"}</span></div>
        </section>
      ) : (
        <section className="earn-feature"><div><span className="section-kicker">Exchange-gated</span><h2>No payable route is exposed until at least one reward source can both serve inventory and settle safely.</h2><p>The platform never fills an empty catalog with simulated offers.</p></div><div className="earn-feature-metric"><strong>0</strong><span>simulated offers</span></div></section>
      )}

      {ranked.length ? <section className="admin-panel"><div className="app-section-head"><div><span className="app-eyebrow">Best value engine</span><h2>Normalized opportunities</h2></div><span className="status-pill"><Trend /> Ranked</span></div><div className="admin-provider-table"><div className="admin-provider-row header"><span>Opportunity</span><span>Reward</span><span>Time</span><span>Confidence</span></div>{ranked.map((item) => <div className="admin-provider-row" key={item.id}><strong>{item.title}</strong><span>{formatUsdFromCredits(item.baseRewardCredits)}</span><span>{item.estimatedMinutes ? `${item.estimatedMinutes} min` : "—"}</span><span>{Math.round(item.confidence * 100)}%</span></div>)}</div></section> : null}

      <section className="earning-principles"><article><span>01</span><h3>Best value, not biggest headline.</h3><p>Ranking can account for reward, time, completion probability, tracking quality and reversal risk.</p></article><article><span>02</span><h3>Credit only verified events.</h3><p>No browser-side balance edits. Server callbacks remain authoritative.</p></article><article><span>03</span><h3>Boost only with reserved budget.</h3><p>Treasury subsidy is designed to appear only after real budget has been atomically reserved.</p></article></section>
    </AppShell>
  );
}
