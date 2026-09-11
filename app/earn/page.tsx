import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Shield, Spark } from "@/components/icons";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatUsdFromCredits, getRewardSnapshot } from "@/lib/reward-state";
import { buildAyetOfferwallUrl } from "@/providers/ayet";

export const metadata = { title: "Earn" };

export default async function EarnPage() {
  const [state, supabase] = await Promise.all([getRewardSnapshot(), createSupabaseServerClient()]);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const liveOfferwall = user ? buildAyetOfferwallUrl(user.id) : null;

  return (
    <AppShell active="earn">
      <div className="app-page-head"><div><span className="app-eyebrow">Opportunity feed</span><h1>Earn</h1><p>Clear value, verified actions, no noisy fake offers.</p></div><div className="balance-chip"><small>Available</small><strong>{formatUsdFromCredits(state.availableCredits)}</strong></div></div>

      {liveOfferwall ? (
        <section className="live-provider-card">
          <div className="live-provider-copy"><span className="status-pill status-lime"><Spark /> Live inventory</span><h2>Offers, surveys and quests matched by ayeT.</h2><p>Open the live earning wall. Completed paid actions are credited only after a signed server callback reaches Reward Pulse.</p><a className="button button-light button-lg" href={liveOfferwall} target="_blank" rel="noopener sponsored">Open live opportunities <ArrowUpRight /></a></div>
          <div className="provider-trust"><Shield /><strong>Server-verified rewards</strong><span>HMAC callback</span><span>Transaction deduplication</span><span>Automatic chargeback reversal</span></div>
        </section>
      ) : (
        <section className="earn-feature"><div><span className="section-kicker">Provider-ready</span><h2>The live offerwall appears here after one ayeT adslot is connected.</h2><p>The product stays usable in preview mode without inventing payable offers.</p></div><div className="earn-feature-metric"><strong>1</strong><span>integration needed</span></div></section>
      )}

      <section className="earning-principles"><article><span>01</span><h3>Know the reward first.</h3><p>Reward value is explicit before the user starts an action.</p></article><article><span>02</span><h3>Credit only verified events.</h3><p>No browser-side balance edits. Signed server callbacks are authoritative.</p></article><article><span>03</span><h3>Protect both sides.</h3><p>Duplicate callbacks are ignored and provider chargebacks reverse the original ledger credit.</p></article></section>
    </AppShell>
  );
}
