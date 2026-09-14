import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ProductPreview } from "@/components/product-preview";
import { PulsercuitNetwork } from "@/components/pulsercuit-network";
import { ArrowUpRight, Check, Shield, Spark, Trend, Users, Wallet } from "@/components/icons";

export const revalidate = 60;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pulsercuit",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "A premium reward circuit built around funded Pulses, visible status, factual milestones and verified payout proof.",
};

export default function HomePage() {
  return (
    <main className="marketing-page pc-v5-marketing pc-luxe-marketing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="pc-luxe-vignette" aria-hidden="true" />
      <div className="pc-luxe-aurora pc-luxe-aurora-a" aria-hidden="true" />
      <div className="pc-luxe-aurora pc-luxe-aurora-b" aria-hidden="true" />
      <SiteHeader />

      <section className="hero shell pc-v5-hero pc-luxe-hero">
        <div className="hero-copy pc-v5-hero-copy">
          <div className="eyebrow pc-v5-eyebrow pc-luxe-eyebrow"><span className="live-dot" /> Pulsercuit · premium reward circuit</div>
          <h1>Return. Rise. <em>Repeat.</em></h1>
          <p className="pc-v5-hero-lead">Claim funded Pulses. Build status. Unlock milestones. Share the climb. Move toward a verified payout.</p>
          <div className="hero-actions pc-v5-actions">
            <Link className="button button-lg pc-v5-primary pc-luxe-primary" href="/auth?next=/dashboard">Enter the circuit <ArrowUpRight /></Link>
            <Link className="button button-ghost button-lg" href="/proof">See live proof</Link>
          </div>
          <div className="trust-strip pc-v5-trust-strip pc-luxe-trust-strip">
            <span><Check /> Free to join</span>
            <span><Shield /> Funded rewards only</span>
            <span><Check /> No fake activity</span>
          </div>
        </div>
        <div className="hero-product pc-v5-product-stage pc-luxe-product-stage"><ProductPreview /></div>
      </section>

      <section className="shell pc-luxe-value-rail" aria-label="Pulsercuit experience">
        <article><Spark /><div><small>Pulse</small><strong>Claim the moment.</strong><p>One clear funded action.</p></div></article>
        <article><Trend /><div><small>Momentum</small><strong>Raise your status.</strong><p>Rhythm, Signal and unlocks.</p></div></article>
        <article><Wallet /><div><small>Vault</small><strong>See the real path.</strong><p>Available, reserved, paid.</p></div></article>
      </section>

      <section className="section shell pc-luxe-loop-section" id="how">
        <div className="section-heading pc-luxe-section-head">
          <span className="section-kicker">One loop. Four reasons to return.</span>
          <h2>Every action should move something you can see.</h2>
        </div>
        <div className="pc-luxe-loop-grid">
          <article className="pc-luxe-loop-card hero-card"><span>01</span><Spark /><h3>Claim</h3><p>Return when your funded Pulse opens.</p></article>
          <article className="pc-luxe-loop-card"><span>02</span><Trend /><h3>Rise</h3><p>Build Signal, rhythm and rank.</p></article>
          <article className="pc-luxe-loop-card"><span>03</span><Shield /><h3>Unlock</h3><p>Earn factual milestone seals.</p></article>
          <article className="pc-luxe-loop-card"><span>04</span><Users /><h3>Share</h3><p>Turn progress into a moment worth showing.</p></article>
        </div>
      </section>

      <section className="section shell pc-luxe-status-section">
        <div className="pc-luxe-status-copy">
          <span className="section-kicker">Status that comes from history</span>
          <h2>Your circuit should feel more valuable every time it becomes more real.</h2>
          <p>Pulse creates the rhythm. Momentum turns it into identity. Proof keeps the financial side honest.</p>
          <div className="pc-luxe-status-pills"><span>Signal</span><span>Rhythm</span><span>Trust</span><span>Milestones</span></div>
        </div>
        <PulsercuitNetwork />
      </section>

      <section className="section shell pc-luxe-share-showcase" id="share">
        <div className="section-heading pc-luxe-section-head">
          <span className="section-kicker">Made to be shared</span>
          <h2>Progress should look like an achievement.</h2>
          <p>Share cards use factual history only. No private balance and no invented payout claims.</p>
        </div>
        <div className="pc-luxe-card-wall">
          <article className="pc-luxe-share-card tone-gold"><small>Pulsercuit · share preview</small><strong>7-day<br />rhythm.</strong><span>Consistency unlocked</span></article>
          <article className="pc-luxe-share-card tone-lime featured"><small>Circuit rank</small><strong>Resonance</strong><span>Signal 82 / 100</span></article>
          <article className="pc-luxe-share-card tone-violet"><small>Milestone</small><strong>Ten<br />Pulses.</strong><span>Real history only</span></article>
        </div>
      </section>

      <section className="section shell pc-luxe-proof-section">
        <div>
          <span className="section-kicker">Proof before hype</span>
          <h2>Luxury means nothing if the numbers are fake.</h2>
          <p>Rewards, balance and completed payouts stay separate facts. Zero stays visible when zero is the truth.</p>
        </div>
        <div className="pc-luxe-proof-actions">
          <div><Check /><span>Server-authoritative eligibility</span></div>
          <div><Check /><span>Treasury-gated rewards</span></div>
          <div><Check /><span>Provider-confirmed payouts</span></div>
          <Link className="button button-ghost" href="/proof">Inspect live proof <ArrowUpRight /></Link>
        </div>
      </section>

      <section className="final-cta shell pc-v5-final-cta pc-luxe-final-cta">
        <div><span className="section-kicker">Your circuit starts here</span><h2>Make the next return count.</h2><p>Enter free. Build real momentum. Share only what you actually earned.</p></div>
        <Link className="button button-lg button-dark" href="/auth?next=/dashboard">Enter Pulsercuit <ArrowUpRight /></Link>
      </section>

      <footer className="footer shell"><div><strong>Pulsercuit</strong><span>© 2026 · Return. Rise. Repeat.</span></div><div><Link href="#how">How it works</Link><Link href="/proof">Proof</Link><Link href="/support">Help</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </main>
  );
}
