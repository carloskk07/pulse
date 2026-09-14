import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ProductPreview } from "@/components/product-preview";
import { PulsercuitNetwork } from "@/components/pulsercuit-network";
import { PulsercuitSceneStrip } from "@/components/pulsercuit-scene-strip";
import { SocialProofPanel } from "@/components/social-proof-panel";
import { ArrowUpRight, Check, Shield, Spark, Trend, Wallet } from "@/components/icons";

export const revalidate = 60;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pulsercuit",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "A premium reward platform built around funded recurring Pulses, visible progress and transparent payouts.",
};

export default function HomePage() {
  return (
    <main className="marketing-page pc-v5-marketing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="hero-glow hero-glow-one" />
      <div className="hero-glow hero-glow-two" />
      <div className="pc-v5-grid-glow" aria-hidden="true" />
      <SiteHeader />

      <section className="hero shell pc-v5-hero">
        <div className="hero-copy pc-v5-hero-copy">
          <div className="eyebrow pc-v5-eyebrow"><span className="live-dot" /> A reward loop designed for momentum</div>
          <h1>Turn consistency into <em>momentum.</em></h1>
          <p className="pc-v5-hero-lead">One clear loop: return when your Pulse opens, claim what is actually funded, watch your progress build and move toward a transparent payout.</p>
          <div className="hero-actions pc-v5-actions">
            <Link className="button button-lg pc-v5-primary" href="/auth?next=/dashboard">Start your circuit <ArrowUpRight /></Link>
            <Link className="button button-ghost button-lg" href="/proof">See live proof</Link>
          </div>
          <div className="trust-strip pc-v5-trust-strip">
            <span><Check /> Free to join</span>
            <span><Shield /> Funded rewards only</span>
            <span><Check /> Turbo stays optional</span>
          </div>
          <div className="pc-v5-hero-proof"><i /><span>Real state only. No synthetic balances, member counts or payout history.</span></div>
        </div>
        <div className="hero-product pc-v5-product-stage"><ProductPreview /></div>
      </section>

      <section className="shell pc-v5-value-rail" aria-label="Pulsercuit value proposition">
        <article><span>01</span><div><strong>Know what happens next.</strong><p>Your live state shows whether to claim, wait, build progress or withdraw.</p></div></article>
        <article><span>02</span><div><strong>See momentum compound.</strong><p>Rhythm, Signal and milestones turn real activity into visible progress.</p></div></article>
        <article><span>03</span><div><strong>Keep money state honest.</strong><p>Rewards, balance and payouts remain separate, authoritative facts.</p></div></article>
      </section>

      <SocialProofPanel />

      <section className="section shell pc-v5-story" id="how">
        <div className="section-heading pc-v5-section-head">
          <div><span className="section-kicker">The Pulsercuit loop</span><h2>Simple enough to understand in seconds. Strong enough to bring you back.</h2></div>
          <p>Pulsercuit removes the usual reward-site clutter and centers the experience on one repeatable action, one visible progression layer and one accountable payout path.</p>
        </div>
        <div className="pc-v5-loop">
          <article className="pc-v5-loop-card featured"><small>Return</small><Spark /><h3>Your next action is obvious.</h3><p>Come back when the rolling window opens. No calendar-reset tricks and no maze of offers before the core product becomes useful.</p></article>
          <article className="pc-v5-loop-card"><small>Pulse</small><Trend /><h3>Claim real funded value.</h3><p>The Pulse opens only when the reward rail has authority and budget. If funding is closed, the product says so.</p></article>
          <article className="pc-v5-loop-card"><small>Progress</small><Shield /><h3>Build a stronger circuit.</h3><p>Real claim history powers rhythm, Trust and Circuit Signal so progress feels tangible without pretending progress is money.</p></article>
          <article className="pc-v5-loop-card"><small>Wallet</small><Wallet /><h3>Move toward a clear payout.</h3><p>Your Wallet shows authoritative balance and a proven withdrawal path instead of vague “estimated earnings.”</p></article>
        </div>
      </section>

      <section className="section shell pc-v5-network-section">
        <div className="pc-v5-network-copy">
          <span className="section-kicker">One connected system</span>
          <h2>Pulse creates the rhythm. Progress gives it meaning. Proof earns trust.</h2>
          <p>Turbo can add extra opportunities, but it never owns the product. The core loop stays useful even when external offer inventory changes.</p>
          <div className="pc-v5-checklist">
            <span><Check /> Pulse remains the recurring core.</span>
            <span><Check /> Progress is derived from real product history.</span>
            <span><Check /> Wallet stays ledger-authoritative.</span>
            <span><Check /> Proof keeps claims separate from completed payouts.</span>
          </div>
        </div>
        <PulsercuitNetwork />
      </section>

      <section className="section shell" id="experience">
        <div className="section-heading split-heading pc-v5-section-head">
          <div><span className="section-kicker">Designed to feel alive</span><h2>A reward product should feel like progress, not paperwork.</h2></div>
          <p>The visual system gives Pulse, rhythm and proof distinct identities so the experience can be understood at a glance rather than explained in paragraphs.</p>
        </div>
        <PulsercuitSceneStrip />
      </section>

      <section className="section shell pc-v5-principles">
        <div className="section-heading narrow pc-v5-section-head"><span className="section-kicker">Why it feels different</span><h2>Less noise. More signal.</h2><p>Every layer has one job: create clarity, reinforce momentum or protect value.</p></div>
        <div className="pc-v5-principle-grid">
          <article><span>01</span><h3>Core before extras.</h3><p>You should understand the product before seeing an offerwall. Pulse comes first; Turbo is optional upside.</p></article>
          <article><span>02</span><h3>Progress you can recognize.</h3><p>Rhythm, Signal and achievements make consistency visible without manufacturing financial value.</p></article>
          <article><span>03</span><h3>Truth without friction.</h3><p>Funding, balance and payout states are authoritative, while the interface keeps the technical machinery in the background.</p></article>
        </div>
      </section>

      <section className="section shell pc-v5-proof-section">
        <div className="pc-v5-proof-copy">
          <span className="section-kicker">Proof, not performance theater</span>
          <h2>Trust should be inspectable.</h2>
          <p>Pulsercuit does not need inflated counters or vague payout language to look active. Public Proof separates reward events from completed withdrawals and leaves zeroes visible when zero is the truth.</p>
          <Link className="button button-ghost" href="/proof">Inspect Pulsercuit Proof <ArrowUpRight /></Link>
        </div>
        <div className="pc-v5-proof-ledger">
          <div><small>Eligibility</small><strong>Server-authoritative</strong><span className="positive"><i /> controlled</span></div>
          <div><small>Reward funding</small><strong>Treasury-gated</strong><span className="positive"><i /> explicit</span></div>
          <div><small>Balance</small><strong>Ledger-derived</strong><span className="positive"><i /> factual</span></div>
          <div><small>Payout</small><strong>Provider-confirmed</strong><span className="positive"><i /> separate proof</span></div>
        </div>
      </section>

      <section className="final-cta shell pc-v5-final-cta">
        <div><span className="section-kicker">Start your circuit</span><h2>Come back for progress that feels worth seeing.</h2><p>Create your account, see your live Pulse state and build momentum one real action at a time.</p></div>
        <Link className="button button-lg button-dark" href="/auth?next=/dashboard">Enter Pulsercuit <ArrowUpRight /></Link>
      </section>

      <footer className="footer shell"><div><strong>Pulsercuit</strong><span>© 2026. Momentum built on authoritative reward state.</span></div><div><Link href="#how">How it works</Link><Link href="/proof">Proof</Link><Link href="/support">Help</Link><Link href="/rewards-policy">Rewards</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </main>
  );
}
