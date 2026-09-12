import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ProductPreview } from "@/components/product-preview";
import { SocialProofPanel } from "@/components/social-proof-panel";
import { ArrowUpRight, Bolt, Check, Clock, Shield, Spark, Trend } from "@/components/icons";
import { getPublicSocialProof } from "@/lib/social-proof";

export const revalidate = 60;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Reward Pulse",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "A verified reward marketplace built to find better opportunities for the time you have.",
};

export default async function HomePage() {
  const socialProof = await getPublicSocialProof();

  return (
    <main className="marketing-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="hero-glow hero-glow-one" />
      <div className="hero-glow hero-glow-two" />
      <SiteHeader />

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> Verified reward marketplace</div>
          <h1>Your time. <em>Better rewarded.</em></h1>
          <p>Pulse filters reward opportunities around value, time and trust so the next useful action is easier to find — and easier to believe.</p>
          <div className="hero-actions">
            <Link className="button button-lg" href="/dashboard">Enter Pulse <ArrowUpRight /></Link>
            <Link className="button button-ghost button-lg" href="#how">See the model</Link>
          </div>
          <div className="trust-strip"><span><Check /> Free to join</span><span><Shield /> Server-verified rewards</span><span><Check /> No deposit required</span></div>
        </div>
        <div className="hero-product"><ProductPreview /></div>
      </section>

      <section className="signal-bar shell" aria-label="Pulse product principles">
        <div><strong>Pulse Protected</strong><span>Protection only when Pulse has settlement authority</span></div>
        <div><strong>Time-aware value</strong><span>Reward quality matters more than headline payout</span></div>
        <div><strong>Live opportunity health</strong><span>Bad inventory should disappear, not waste time</span></div>
        <div><strong>Ledger-backed settlement</strong><span>Balances move after authoritative events</span></div>
      </section>

      <SocialProofPanel proof={socialProof} />

      <section className="section shell" id="how">
        <div className="section-heading narrow"><span className="section-kicker">A simpler reward experience</span><h2>Choose the time you have. Pulse does the filtering.</h2><p>The intelligence stays behind the interface. Users should see a small number of clear opportunities, not a wall of noise.</p></div>
        <div className="steps-grid">
          <article className="step-card"><span className="step-number">01</span><div className="step-icon"><Clock /></div><h3>Start with your time</h3><p>Quick moments should surface quick wins. Longer sessions can surface higher-value missions.</p></article>
          <article className="step-card"><span className="step-number">02</span><div className="step-icon"><Trend /></div><h3>Rank real value</h3><p>Reward, estimated effort, tracking confidence and reversal risk can all influence what appears first.</p></article>
          <article className="step-card"><span className="step-number">03</span><div className="step-icon"><Shield /></div><h3>Settle with proof</h3><p>Provider callbacks and direct-campaign verification remain authoritative before the ledger changes.</p></article>
        </div>
      </section>

      <section className="section shell" id="rewards">
        <div className="section-heading split-heading"><div><span className="section-kicker">Reward Drops</span><h2>Make the best opportunity feel obvious.</h2></div><p>Pulse is designed around selection, not clutter. Live values remain inside the authenticated product so the public site never invents earnings or availability.</p></div>
        <div className="offers-showcase">
          <article className="offer-card offer-card-featured"><div className="offer-topline"><span className="offer-type">Protection</span><span className="offer-match">Pulse Protected</span></div><div className="offer-copy"><h3>Reserve trust for rewards we can actually stand behind.</h3><div className="offer-meta"><span>Funded authority</span><span>Verified event</span></div></div><div className="offer-footer"><div><small>Promise</small><strong>Precise</strong></div><span className="status-pill">Protected when eligible</span></div></article>
          <article className="offer-card"><div className="offer-topline"><span className="offer-type">Selection</span><span className="offer-match">Time-aware</span></div><div className="offer-copy"><h3>Optimize for the best use of the next few minutes.</h3><div className="offer-meta"><span>Expected value</span><span>Opportunity health</span></div></div><div className="offer-footer"><div><small>Ranking</small><strong>Quality first</strong></div><span className="status-pill">Filtered</span></div></article>
          <article className="offer-card"><div className="offer-topline"><span className="offer-type">Boost</span><span className="offer-match">Budget-aware</span></div><div className="offer-copy"><h3>Use Pulse capital only where a boost can create real behavior.</h3><div className="offer-meta"><span>Reserved budget</span><span>Kill-switch controlled</span></div></div><div className="offer-footer"><div><small>Subsidy</small><strong>Selective</strong></div><span className="status-pill">When funded</span></div></article>
        </div>
      </section>

      <section className="section shell trust-section" id="trust">
        <div className="trust-panel">
          <div className="trust-copy"><span className="section-kicker">Trust should be visible</span><h2>Premium enough to feel financial. Clear enough to feel effortless.</h2><p>Pulse separates matching, verification and settlement so a polished interface never has to hide uncertainty behind marketing.</p><div className="trust-points"><span><Shield /> Protected only when authority exists</span><span><Check /> Idempotent financial events</span><span><Check /> No fabricated users, payouts or urgency</span></div></div>
          <div className="trust-visual">
            <div className="ledger-card"><div className="ledger-head"><span>Illustrative reward lifecycle</span><span className="status-pill">Example UI</span></div><div className="ledger-row"><span><i className="dot positive" /> Matched</span><strong>Eligible</strong></div><div className="ledger-row"><span><i className="dot positive" /> Verified</span><strong>Authoritative</strong></div><div className="ledger-row"><span><i className="dot neutral" /> Settled</span><strong>Ledger</strong></div><div className="ledger-total"><span>Balance authority</span><strong>Traceable</strong></div></div>
          </div>
        </div>
      </section>

      <section className="final-cta shell"><div><span className="section-kicker">The next useful action</span><h2>Find it faster.</h2><p>Enter Pulse to see your real reward state and the live earning routes currently available to your account.</p></div><Link className="button button-lg button-dark" href="/dashboard">Open Pulse <ArrowUpRight /></Link></section>

      <footer className="footer shell"><div><strong>Reward Pulse</strong><span>© 2026. Built around transparent value.</span></div><div><Link href="#how">How it works</Link><Link href="#trust">Trust</Link><Link href="/dashboard">Product</Link></div></footer>
    </main>
  );
}
