import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ProductPreview } from "@/components/product-preview";
import { PulsercuitNetwork } from "@/components/pulsercuit-network";
import { PulsercuitSceneStrip } from "@/components/pulsercuit-scene-strip";
import { SocialProofPanel } from "@/components/social-proof-panel";
import { ArrowUpRight, Check, Shield } from "@/components/icons";

export const revalidate = 60;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pulsercuit",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "A treasury-backed recurring reward network built around a simple return rhythm, optional Turbo earning and transparent payout proof.",
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
          <div className="eyebrow"><span className="live-dot" /> A recurring reward circuit built around your return</div>
          <h1>Return. Claim your <em>Pulse.</em> Build the circuit.</h1>
          <p>Pulsercuit turns a simple return rhythm into a transparent reward experience. When the treasury-backed Pulse is open, eligible members claim it, build consistency and come back when the next rolling window forms. Turbo stays optional.</p>
          <div className="hero-actions">
            <Link className="button button-lg" href="/auth?next=/dashboard">Open your Pulse <ArrowUpRight /></Link>
            <Link className="button button-ghost button-lg" href="/proof">Inspect real proof</Link>
          </div>
          <div className="trust-strip"><span><Check /> No deposit required</span><span><Shield /> Unfunded rewards stay closed</span><span><Check /> Turbo is optional</span></div>
          <div className="pc-hero-note"><i /> Pulsercuit never invents users, payout history or reward availability.</div>
        </div>
        <div className="hero-product"><ProductPreview /></div>
      </section>

      <section className="signal-bar shell" aria-label="How Pulsercuit works">
        <div><strong>1. Return</strong><span>Come back when your rolling window opens</span></div>
        <div><strong>2. Pulse</strong><span>Claim only when the reward rail is funded</span></div>
        <div><strong>3. Build</strong><span>Grow rhythm, Signal and real product history</span></div>
        <div><strong>4. Share</strong><span>Show milestones without exposing private balances</span></div>
      </section>

      <SocialProofPanel />

      <section className="section shell pc-story" id="how">
        <div className="pc-story-copy">
          <span className="section-kicker">Why Pulsercuit</span>
          <h2>Value should move in a circuit, not disappear into an offerwall.</h2>
          <p>The Pulse is the recurring reason to return. Trust reduces friction for legitimate members. Proof exposes what actually happened. Turbo is optional fuel, not the product itself.</p>
          <div className="pc-story-points">
            <span><i /> Pulse owns the rhythm and ledger.</span>
            <span><i /> Trust is earned from real product history.</span>
            <span><i /> Proof keeps credited rewards separate from completed payouts.</span>
            <span><i /> Turbo can change providers without changing the product.</span>
          </div>
        </div>
        <PulsercuitNetwork />
      </section>

      <section className="section shell">
        <div className="section-heading split-heading"><div><span className="section-kicker">A visual language of its own</span><h2>More than cards. The product should feel alive before it asks for attention.</h2></div><p>These authored scenes turn Pulse, progress and Proof into recognizable Pulsercuit imagery without fabricating activity or financial outcomes.</p></div>
        <PulsercuitSceneStrip />
      </section>

      <section className="section shell" id="rhythm">
        <div className="section-heading narrow"><span className="section-kicker">The return loop</span><h2>A habit that gets clearer each time you come back.</h2><p>Gamification is tied to factual activity and visible progress. It never turns uncertain money into a fake prize.</p></div>
        <div className="pc-loop-grid">
          <article className="pc-loop-card"><small>Return</small><h3>See the next window.</h3><p>A rolling timer makes the next action clear without calendar-boundary tricks.</p></article>
          <article className="pc-loop-card"><small>Pulse</small><h3>Claim what is actually funded.</h3><p>The base reward rail opens only when the server-authoritative treasury allows it.</p></article>
          <article className="pc-loop-card"><small>Build</small><h3>Turn consistency into status.</h3><p>Rhythm, Circuit Signal and milestones make progress visible without creating new financial liabilities.</p></article>
          <article className="pc-loop-card"><small>Share</small><h3>Share a moment, not spam.</h3><p>Invites and milestones are designed around qualified activity instead of raw account creation.</p></article>
        </div>
      </section>

      <section className="section shell" id="rewards">
        <div className="section-heading split-heading"><div><span className="section-kicker">Three product rails</span><h2>One recurring core. Optional upside. Public evidence.</h2></div><p>The public site never fabricates earning values, availability, users or payout history. Live financial numbers belong to authoritative product state and Pulsercuit Proof.</p></div>
        <div className="offers-showcase">
          <article className="offer-card offer-card-featured"><div className="offer-topline"><span className="offer-type">Pulse</span><span className="offer-match">Pulsercuit-funded</span></div><div className="offer-copy"><h3>A recurring reward that can exist without completing an offer.</h3><div className="offer-meta"><span>Rolling eligibility</span><span>Treasury protected</span></div></div><div className="offer-footer"><div><small>Promise</small><strong>Funded first</strong></div><span className="status-pill">Deterministic</span></div></article>
          <article className="offer-card"><div className="offer-topline"><span className="offer-type">Turbo</span><span className="offer-match">Optional</span></div><div className="offer-copy"><h3>Extra opportunities are ranked instead of dumped into an offerwall.</h3><div className="offer-meta"><span>Value</span><span>Reliability</span></div></div><div className="offer-footer"><div><small>Supply</small><strong>Replaceable</strong></div><span className="status-pill">User choice</span></div></article>
          <article className="offer-card"><div className="offer-topline"><span className="offer-type">Proof</span><span className="offer-match">Public</span></div><div className="offer-copy"><h3>Credited rewards and completed withdrawals stay separate facts.</h3><div className="offer-meta"><span>No fake payouts</span><span>No synthetic users</span></div></div><div className="offer-footer"><div><small>Evidence</small><strong>Inspectable</strong></div><span className="status-pill">Truth first</span></div></article>
        </div>
      </section>

      <section className="section shell">
        <div className="section-heading split-heading"><div><span className="section-kicker">Built to be shared</span><h2>Progress should create moments worth showing.</h2></div><p>These are visual examples of the share system, not claims about live member activity.</p></div>
        <div className="pc-moment-stage">
          <article className="pc-moment-card"><span className="pc-moment-brand">Pulsercuit · share preview</span><strong>7-day <em>rhythm.</em></strong><p>A milestone card can be generated from a real member rhythm and shared without exposing account balances or private data.</p></article>
          <div className="pc-moment-side">
            <article className="pc-mini-moment"><span>Signal moment</span><h3>Your circuit is getting stronger.</h3><p>Circuit Signal is display-only progress derived from real claim, rhythm and Trust history. It is never presented as money.</p></article>
            <article className="pc-mini-moment"><span>Circuit moment</span><h3>Invite quality, not volume.</h3><p>Referral progress is tied to verified activity so sharing has a reason beyond raw signups.</p></article>
          </div>
        </div>
      </section>

      <section className="section shell trust-section" id="trust">
        <div className="trust-panel">
          <div className="trust-copy"><span className="section-kicker">Pulsercuit Trust</span><h2>Good users should feel less friction over time.</h2><p>Trust grows from real claim history, verified monetized activity, completed payouts and risk signals. The product shows progress without exposing the thresholds needed to game the system.</p><div className="trust-points"><span><Shield /> Financial writes stay server-authoritative</span><span><Check /> Duplicate claim windows are transaction-locked</span><span><Check /> Referral rewards require verified activity</span></div></div>
          <div className="trust-visual"><div className="ledger-card"><div className="ledger-head"><span>Circuit integrity</span><span className="status-pill">Authoritative</span></div><div className="ledger-row"><span><i className="dot positive" /> Eligibility</span><strong>Server</strong></div><div className="ledger-row"><span><i className="dot positive" /> Treasury</span><strong>Gated</strong></div><div className="ledger-row"><span><i className="dot neutral" /> Ledger</span><strong>Append-only</strong></div><div className="ledger-total"><span>Next window</span><strong>Rolling</strong></div></div></div>
        </div>
      </section>

      <section className="final-cta shell"><div><span className="section-kicker">Complete the circuit</span><h2>Your Pulse should be useful before you ever open a Turbo.</h2><p>Create an account, see the live reward state and inspect the same public proof everyone else sees.</p></div><Link className="button button-lg button-dark" href="/auth?next=/dashboard">Open your Pulse <ArrowUpRight /></Link></section>

      <footer className="footer shell"><div><strong>Pulsercuit</strong><span>© 2026. Treasury-backed rewards, transparent settlement.</span></div><div><Link href="#how">How it works</Link><Link href="/proof">Proof</Link><Link href="/support">Help</Link><Link href="/rewards-policy">Rewards</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </main>
  );
}
