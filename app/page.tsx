import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ProductPreview } from "@/components/product-preview";
import { SocialProofPanel } from "@/components/social-proof-panel";
import { ArrowUpRight, Check, Clock, Shield, Trend } from "@/components/icons";
import { getPublicSocialProof } from "@/lib/social-proof";

export const revalidate = 60;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Reward Pulse",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "A reward marketplace where verified earning events become a transparent ledger balance.",
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
          <div className="eyebrow"><span className="live-dot" /> Verified rewards, without the noise</div>
          <h1>Turn spare time into <em>verified rewards.</em></h1>
          <p>Choose an opportunity, complete it with the provider and see your balance update only after the reward is verified. When you reach the payout threshold, withdraw through the configured payout route.</p>
          <div className="hero-actions">
            <Link className="button button-lg" href="/auth?next=/dashboard">Start free <ArrowUpRight /></Link>
            <Link className="button button-ghost button-lg" href="#how">How it works</Link>
          </div>
          <div className="trust-strip"><span><Check /> Free to join</span><span><Shield /> Rewards verified first</span><span><Check /> No deposit required</span></div>
        </div>
        <div className="hero-product"><ProductPreview /></div>
      </section>

      <section className="signal-bar shell" aria-label="How Reward Pulse works">
        <div><strong>1. Pick</strong><span>Choose a live opportunity</span></div>
        <div><strong>2. Complete</strong><span>Finish it with the provider</span></div>
        <div><strong>3. Verify</strong><span>Confirmed rewards enter your ledger</span></div>
        <div><strong>4. Withdraw</strong><span>Redeem after the payout threshold</span></div>
      </section>

      <SocialProofPanel proof={socialProof} />

      <section className="section shell" id="how">
        <div className="section-heading narrow"><span className="section-kicker">Three steps</span><h2>Earn without guessing what happened to your reward.</h2><p>Pulse keeps the complicated provider and settlement logic behind the interface. You see the opportunity, its verified result and your real balance.</p></div>
        <div className="steps-grid">
          <article className="step-card"><span className="step-number">01</span><div className="step-icon"><Clock /></div><h3>Choose something worth your time</h3><p>Open live offers, surveys or quests without filling the screen with invented inventory.</p></article>
          <article className="step-card"><span className="step-number">02</span><div className="step-icon"><Trend /></div><h3>Complete it normally</h3><p>Follow the provider instructions. Opening a page or clicking a button never creates a fake reward.</p></article>
          <article className="step-card"><span className="step-number">03</span><div className="step-icon"><Shield /></div><h3>See it after verification</h3><p>When the authoritative event arrives, the ledger records the reward and your available balance reflects it.</p></article>
        </div>
      </section>

      <section className="section shell" id="rewards">
        <div className="section-heading split-heading"><div><span className="section-kicker">Reward Drops</span><h2>The next useful opportunity should be obvious.</h2></div><p>Live reward values stay inside the signed-in product. The public site never fabricates earnings, availability or payout history.</p></div>
        <div className="offers-showcase">
          <article className="offer-card offer-card-featured"><div className="offer-topline"><span className="offer-type">Verified</span><span className="offer-match">Real balance</span></div><div className="offer-copy"><h3>Rewards appear after the event that actually proves them.</h3><div className="offer-meta"><span>Provider evidence</span><span>Ledger history</span></div></div><div className="offer-footer"><div><small>Balance</small><strong>Traceable</strong></div><span className="status-pill">Evidence first</span></div></article>
          <article className="offer-card"><div className="offer-topline"><span className="offer-type">Selection</span><span className="offer-match">Less clutter</span></div><div className="offer-copy"><h3>Spend less time hunting through weak opportunities.</h3><div className="offer-meta"><span>Freshness</span><span>Expected value</span></div></div><div className="offer-footer"><div><small>Ranking</small><strong>Quality first</strong></div><span className="status-pill">Filtered</span></div></article>
          <article className="offer-card"><div className="offer-topline"><span className="offer-type">Payout</span><span className="offer-match">Safe retry</span></div><div className="offer-copy"><h3>A payout keeps one identity so an uncertain retry cannot pay twice.</h3><div className="offer-meta"><span>Reserved balance</span><span>Provider confirmation</span></div></div><div className="offer-footer"><div><small>Recovery</small><strong>Idempotent</strong></div><span className="status-pill">Protected flow</span></div></article>
        </div>
      </section>

      <section className="section shell trust-section" id="trust">
        <div className="trust-panel">
          <div className="trust-copy"><span className="section-kicker">Trust you can inspect</span><h2>A polished interface should never hide uncertainty.</h2><p>Pulse separates discovery, verification and settlement. If a reward is not confirmed yet, the product does not pretend that it is.</p><div className="trust-points"><span><Shield /> Balance changes require authority</span><span><Check /> Duplicate financial events are blocked</span><span><Check /> No fabricated users, payouts or urgency</span></div></div>
          <div className="trust-visual"><div className="ledger-card"><div className="ledger-head"><span>Illustrative reward lifecycle</span><span className="status-pill">Example UI</span></div><div className="ledger-row"><span><i className="dot positive" /> Opportunity</span><strong>Opened</strong></div><div className="ledger-row"><span><i className="dot positive" /> Provider event</span><strong>Verified</strong></div><div className="ledger-row"><span><i className="dot neutral" /> Ledger</span><strong>Available</strong></div><div className="ledger-total"><span>History</span><strong>Traceable</strong></div></div></div>
        </div>
      </section>

      <section className="final-cta shell"><div><span className="section-kicker">Ready when the route is live</span><h2>Start with one real reward.</h2><p>Create an account, open the live earning route and let the ledger show exactly what is verified.</p></div><Link className="button button-lg button-dark" href="/auth?next=/earn">Start earning <ArrowUpRight /></Link></section>

      <footer className="footer shell"><div><strong>Reward Pulse</strong><span>© 2026. Verified rewards, transparent settlement.</span></div><div><Link href="#how">How it works</Link><Link href="/support">Help</Link><Link href="/rewards-policy">Rewards</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </main>
  );
}
