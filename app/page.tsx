import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ProductPreview } from "@/components/product-preview";
import { ArrowUpRight, Bolt, Check, Shield, Spark, Trend } from "@/components/icons";
import { OfferCard } from "@/components/offer-card";
import { offers } from "@/lib/mock-data";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Reward Pulse",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "Complete simple quests and turn spare minutes into real rewards.",
};

export default function HomePage() {
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
            <Link className="button button-lg" href="/dashboard">Start earning <ArrowUpRight /></Link>
            <Link className="button button-ghost button-lg" href="#how">See how it works</Link>
          </div>
          <div className="trust-strip"><span><Check /> Free to join</span><span><Check /> Clear rewards</span><span><Check /> No deposit required</span></div>
        </div>
        <div className="hero-product"><ProductPreview /></div>
      </section>

      <section className="signal-bar shell" aria-label="Platform principles">
        <div><strong>1 daily pulse</strong><span>Built for habit, not spam</span></div>
        <div><strong>Clear effort</strong><span>Know time and reward first</span></div>
        <div><strong>Smart ranking</strong><span>Better matches rise naturally</span></div>
        <div><strong>Real ledger</strong><span>Every credit is traceable</span></div>
      </section>

      <section className="section shell" id="how">
        <div className="section-heading narrow"><span className="section-kicker">Designed for momentum</span><h2>From first click to first reward in a few clear steps.</h2><p>No maze of banners. No endless tutorial. The product teaches itself while you use it.</p></div>
        <div className="steps-grid">
          <article className="step-card"><span className="step-number">01</span><div className="step-icon"><Spark /></div><h3>Claim your first Pulse</h3><p>Start with a small welcome reward so value appears before friction.</p></article>
          <article className="step-card"><span className="step-number">02</span><div className="step-icon"><Bolt /></div><h3>Pick a best match</h3><p>See reward, estimated time and quality before you commit.</p></article>
          <article className="step-card"><span className="step-number">03</span><div className="step-icon"><Trend /></div><h3>Build momentum</h3><p>Streaks and progress guide you toward your first withdrawal.</p></article>
        </div>
      </section>

      <section className="section shell" id="rewards">
        <div className="section-heading split-heading"><div><span className="section-kicker">Opportunities, not clutter</span><h2>See the value before you spend the time.</h2></div><p>Reward Pulse ranks opportunities around expected usefulness, completion likelihood and clear economics—not simply the biggest headline payout.</p></div>
        <div className="offers-showcase">{offers.slice(0, 3).map((offer, index) => <OfferCard key={offer.id} offer={offer} featured={index === 0} />)}</div>
      </section>

      <section className="section shell trust-section" id="trust">
        <div className="trust-panel">
          <div className="trust-copy"><span className="section-kicker">Trust is a product feature</span><h2>Premium enough to feel financial. Simple enough to feel effortless.</h2><p>Ledger-first accounting, risk-aware withdrawals and honest reward states are part of the experience from day one.</p><div className="trust-points"><span><Shield /> Risk-aware payout flow</span><span><Check /> Idempotent reward events</span><span><Check /> No fake urgency or fabricated proof</span></div></div>
          <div className="trust-visual">
            <div className="ledger-card"><div className="ledger-head"><span>Reward ledger</span><span className="status-pill">Healthy</span></div><div className="ledger-row"><span><i className="dot positive" /> Survey completed</span><strong>+$0.42</strong></div><div className="ledger-row"><span><i className="dot positive" /> Daily Pulse</span><strong>+$0.01</strong></div><div className="ledger-row"><span><i className="dot neutral" /> Withdrawal</span><strong>−$1.00</strong></div><div className="ledger-total"><span>Available</span><strong>$4.82</strong></div></div>
          </div>
        </div>
      </section>

      <section className="final-cta shell"><div><span className="section-kicker">Your next few minutes</span><h2>Make them count.</h2><p>Explore the product direction now. The infrastructure is being built to keep the experience simple as it grows.</p></div><Link className="button button-lg button-dark" href="/dashboard">Enter Reward Pulse <ArrowUpRight /></Link></section>

      <footer className="footer shell"><div><strong>Reward Pulse</strong><span>© 2026. Built around transparent value.</span></div><div><Link href="#how">How it works</Link><Link href="#trust">Trust</Link><Link href="/dashboard">Product</Link></div></footer>
    </main>
  );
}
