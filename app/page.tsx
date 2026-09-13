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
  description: "A treasury-backed recurring reward network with optional Turbo earning and transparent payout proof.",
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
          <div className="eyebrow"><span className="live-dot" /> Rewards built around your return, not an offerwall</div>
          <h1>Come back. Claim your <em>Pulse.</em></h1>
          <p>Pulse is built around a small recurring reward backed by a real treasury. When the pool is open, eligible members claim it and return after the rolling interval. Want more? Turbo is optional.</p>
          <div className="hero-actions">
            <Link className="button button-lg" href="/auth?next=/dashboard">Open Pulse <ArrowUpRight /></Link>
            <Link className="button button-ghost button-lg" href="/proof">See real proof</Link>
          </div>
          <div className="trust-strip"><span><Check /> No deposit required</span><span><Shield /> Unfunded rewards stay closed</span><span><Check /> Turbo is optional</span></div>
        </div>
        <div className="hero-product"><ProductPreview /></div>
      </section>

      <section className="signal-bar shell" aria-label="How Reward Pulse works">
        <div><strong>1. Claim</strong><span>Collect an eligible Hourly Pulse</span></div>
        <div><strong>2. Return</strong><span>Your next window opens on a rolling timer</span></div>
        <div><strong>3. Turbo</strong><span>Choose extra earning only if you want it</span></div>
        <div><strong>4. Withdraw</strong><span>Redeem through the configured payout route</span></div>
      </section>

      <SocialProofPanel proof={socialProof} />

      <section className="section shell" id="how">
        <div className="section-heading narrow"><span className="section-kicker">A different reward loop</span><h2>The reward is the reason to arrive. Providers are only optional fuel.</h2><p>Pulse owns the account, rhythm, trust, ledger and payout experience. External CPA supply can increase earnings, but it does not decide whether the product exists.</p></div>
        <div className="steps-grid">
          <article className="step-card"><span className="step-number">01</span><div className="step-icon"><Clock /></div><h3>Your Pulse opens on a rolling interval</h3><p>No calendar-boundary double claims. A new window starts only after the previous successful claim and the configured interval.</p></article>
          <article className="step-card"><span className="step-number">02</span><div className="step-icon"><Shield /></div><h3>The treasury decides what can be promised</h3><p>Every base claim is budget-backed. Daily limits, per-user limits and a kill switch stop rewards before the system creates unfunded liabilities.</p></article>
          <article className="step-card"><span className="step-number">03</span><div className="step-icon"><Trend /></div><h3>Turbo adds upside without taking over</h3><p>CPA, direct campaigns and future supply can compete behind one Pulse interface. The user sees value, not provider clutter.</p></article>
        </div>
      </section>

      <section className="section shell" id="rewards">
        <div className="section-heading split-heading"><div><span className="section-kicker">Three layers</span><h2>One simple habit. Multiple ways to make it sustainable.</h2></div><p>The public site never fabricates earning values, availability, users or payout history. Live financial numbers belong to the authoritative product state and Pulse Proof.</p></div>
        <div className="offers-showcase">
          <article className="offer-card offer-card-featured"><div className="offer-topline"><span className="offer-type">Base Pulse</span><span className="offer-match">Pulse-funded</span></div><div className="offer-copy"><h3>A recurring reward that can exist without completing an offer.</h3><div className="offer-meta"><span>Rolling eligibility</span><span>Treasury protected</span></div></div><div className="offer-footer"><div><small>Promise</small><strong>Funded first</strong></div><span className="status-pill">Deterministic</span></div></article>
          <article className="offer-card"><div className="offer-topline"><span className="offer-type">Turbo</span><span className="offer-match">Optional</span></div><div className="offer-copy"><h3>Extra opportunities are ranked instead of dumped into an offerwall.</h3><div className="offer-meta"><span>Value</span><span>Reliability</span></div></div><div className="offer-footer"><div><small>Supply</small><strong>Replaceable</strong></div><span className="status-pill">User choice</span></div></article>
          <article className="offer-card"><div className="offer-topline"><span className="offer-type">Pulse Proof</span><span className="offer-match">Public</span></div><div className="offer-copy"><h3>Credited rewards and completed withdrawals are reported as different facts.</h3><div className="offer-meta"><span>No fake payouts</span><span>No synthetic users</span></div></div><div className="offer-footer"><div><small>Evidence</small><strong>Inspectable</strong></div><span className="status-pill">Truth first</span></div></article>
        </div>
      </section>

      <section className="section shell trust-section" id="trust">
        <div className="trust-panel">
          <div className="trust-copy"><span className="section-kicker">Pulse Trust</span><h2>Good users should feel less friction over time.</h2><p>Pulse builds trust from real claim history, verified monetized activity, completed payouts and risk signals. The goal is to reward legitimate behavior without exposing the rules needed to game the system.</p><div className="trust-points"><span><Shield /> Financial writes stay server-authoritative</span><span><Check /> Duplicate claim windows are transaction-locked</span><span><Check /> Referral rewards require verified activity</span></div></div>
          <div className="trust-visual"><div className="ledger-card"><div className="ledger-head"><span>Pulse lifecycle</span><span className="status-pill">Authoritative</span></div><div className="ledger-row"><span><i className="dot positive" /> Eligibility</span><strong>Ready</strong></div><div className="ledger-row"><span><i className="dot positive" /> Treasury</span><strong>Funded</strong></div><div className="ledger-row"><span><i className="dot neutral" /> Ledger</span><strong>Available</strong></div><div className="ledger-total"><span>Next window</span><strong>Rolling</strong></div></div></div>
        </div>
      </section>

      <section className="final-cta shell"><div><span className="section-kicker">Build the rhythm</span><h2>Your Pulse should be useful before you ever open a Turbo.</h2><p>Create an account, see the live reward state and inspect the same public proof everyone else sees.</p></div><Link className="button button-lg button-dark" href="/auth?next=/dashboard">Open Pulse <ArrowUpRight /></Link></section>

      <footer className="footer shell"><div><strong>Reward Pulse</strong><span>© 2026. Treasury-backed rewards, transparent settlement.</span></div><div><Link href="#how">How it works</Link><Link href="/proof">Proof</Link><Link href="/support">Help</Link><Link href="/rewards-policy">Rewards</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </main>
  );
}
