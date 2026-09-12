import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ProductPreview } from "@/components/product-preview";
import { SocialProofPanel } from "@/components/social-proof-panel";
import { ArrowUpRight, Bolt, Check, Shield, Spark, Trend } from "@/components/icons";
import { getPublicSocialProof } from "@/lib/social-proof";

export const revalidate = 60;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Reward Pulse",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "Complete simple quests and turn spare minutes into real rewards.",
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
          <div className="eyebrow"><span className="live-dot" /> Rewards, rethought</div>
          <h1>Your spare minutes <em>have value.</em></h1>
          <p>Complete simple quests, build your streak and turn small moments into rewards you can actually use.</p>
          <div className="hero-actions">
            <Link className="button button-lg" href="/dashboard">Enter Reward Pulse <ArrowUpRight /></Link>
            <Link className="button button-ghost button-lg" href="#how">See how it works</Link>
          </div>
          <div className="trust-strip"><span><Check /> Free to join</span><span><Check /> Clear rewards</span><span><Check /> No deposit required</span></div>
        </div>
        <div className="hero-product"><ProductPreview /></div>
      </section>

      <section className="signal-bar shell" aria-label="Platform principles">
        <div><strong>1 daily pulse</strong><span>Built for habit, not spam</span></div>
        <div><strong>Clear effort</strong><span>Know value before action</span></div>
        <div><strong>Verified events</strong><span>Provider callbacks create rewards</span></div>
        <div><strong>Real ledger</strong><span>Every credit is traceable</span></div>
      </section>

      <SocialProofPanel proof={socialProof} />

      <section className="section shell" id="how">
        <div className="section-heading narrow"><span className="section-kicker">Designed for momentum</span><h2>From first click to first verified reward in a few clear steps.</h2><p>No maze of banners. No endless tutorial. The product teaches itself while you use it.</p></div>
        <div className="steps-grid">
          <article className="step-card"><span className="step-number">01</span><div className="step-icon"><Spark /></div><h3>Claim your Daily Pulse</h3><p>A small server-verified reward starts the habit without pretending a provider conversion happened.</p></article>
          <article className="step-card"><span className="step-number">02</span><div className="step-icon"><Bolt /></div><h3>Open live opportunities</h3><p>Connected provider inventory appears inside the authenticated earning flow.</p></article>
          <article className="step-card"><span className="step-number">03</span><div className="step-icon"><Trend /></div><h3>Build toward payout</h3><p>Confirmed rewards enter the ledger and move you toward a protected withdrawal.</p></article>
        </div>
      </section>

      <section className="section shell" id="rewards">
        <div className="section-heading split-heading"><div><span className="section-kicker">Opportunities, not clutter</span><h2>Live economics belong in the live product.</h2></div><p>Inventory and payout values are loaded from connected providers after sign-in. The marketing page does not invent earning amounts or completion statistics.</p></div>
        <div className="offers-showcase">
          <article className="offer-card offer-card-featured"><div className="offer-topline"><span className="offer-type">Inventory</span><span className="offer-match">Provider-backed</span></div><div className="offer-copy"><h3>Real opportunities appear after sign-in.</h3><div className="offer-meta"><span>Dynamic availability</span><span>Verified source</span></div></div><div className="offer-footer"><div><small>Reward</small><strong>Shown live</strong></div><span className="status-pill">No mock payout</span></div></article>
          <article className="offer-card"><div className="offer-topline"><span className="offer-type">Clarity</span><span className="offer-match">Before action</span></div><div className="offer-copy"><h3>Know the provider reward before committing time.</h3><div className="offer-meta"><span>Clear terms</span><span>No hidden balance edits</span></div></div><div className="offer-footer"><div><small>Authority</small><strong>Server callback</strong></div><span className="status-pill">Verified</span></div></article>
          <article className="offer-card"><div className="offer-topline"><span className="offer-type">Accounting</span><span className="offer-match">Ledger-first</span></div><div className="offer-copy"><h3>Your balance changes only after an authoritative event.</h3><div className="offer-meta"><span>Idempotent</span><span>Chargeback-aware</span></div></div><div className="offer-footer"><div><small>State</small><strong>Traceable</strong></div><span className="status-pill">Auditable</span></div></article>
        </div>
      </section>

      <section className="section shell trust-section" id="trust">
        <div className="trust-panel">
          <div className="trust-copy"><span className="section-kicker">Trust is a product feature</span><h2>Premium enough to feel financial. Simple enough to feel effortless.</h2><p>Ledger-first accounting, risk-aware withdrawals and honest reward states are part of the experience from day one.</p><div className="trust-points"><span><Shield /> Risk-aware payout flow</span><span><Check /> Idempotent reward events</span><span><Check /> No fake urgency or fabricated proof</span></div></div>
          <div className="trust-visual">
            <div className="ledger-card"><div className="ledger-head"><span>Illustrative ledger flow</span><span className="status-pill">Example UI</span></div><div className="ledger-row"><span><i className="dot positive" /> Provider callback</span><strong>Confirmed</strong></div><div className="ledger-row"><span><i className="dot positive" /> Daily Pulse</span><strong>Available</strong></div><div className="ledger-row"><span><i className="dot neutral" /> Withdrawal</span><strong>Reserved</strong></div><div className="ledger-total"><span>Balance authority</span><strong>Ledger</strong></div></div>
          </div>
        </div>
      </section>

      <section className="final-cta shell"><div><span className="section-kicker">Your next few minutes</span><h2>Make them count.</h2><p>Enter the product to see the current reward state and provider-backed opportunities available to your account.</p></div><Link className="button button-lg button-dark" href="/dashboard">Enter Reward Pulse <ArrowUpRight /></Link></section>

      <footer className="footer shell"><div><strong>Reward Pulse</strong><span>© 2026. Built around transparent value.</span></div><div><Link href="#how">How it works</Link><Link href="#trust">Trust</Link><Link href="/dashboard">Product</Link></div></footer>
    </main>
  );
}
