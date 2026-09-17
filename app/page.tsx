import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PulsercuitSensoryLayer } from "@/components/pulsercuit-sensory-layer";
import { V6FinalProof, V6HeroProof } from "@/components/v6-live-proof";
import { ArrowUpRight, Shield, Spark, Trend, Users } from "@/components/icons";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pulsercuit",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "Pulsercuit is a premium reward circuit built around funded Pulses, visible momentum, shareable progress and an evidence-gated payout path.",
};

const ranks = [
  { id: "spark", name: "Spark", note: "Begin the journey" },
  { id: "flow", name: "Flow", note: "Build consistency" },
  { id: "rhythm", name: "Rhythm", note: "Find your stride" },
  { id: "circuit", name: "Circuit", note: "Expand your impact" },
  { id: "resonance", name: "Resonance", note: "Leave a legacy" },
] as const;

export default function HomePage() {
  return (
    <main className="pc-v6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <PulsercuitSensoryLayer />
      <SiteHeader overlay />

      <section className="pc-v6-hero">
        <div className="pc-v6-hero-bg" aria-hidden="true"><div className="pc-v6-sprite pc-v6-sprite-hero" /></div>
        <div className="pc-v6-shell pc-v6-hero-grid">
          <div className="pc-v6-hero-copy">
            <span className="pc-v6-kicker">Pulsercuit</span>
            <h1>Return. <em>Rise.</em> Repeat.</h1>
            <p>A premium reward ritual built around Pulse, Momentum, Vault and Share.</p>
            <div className="pc-v6-actions">
              <Link className="pc-v6-button primary" href="/auth?next=/dashboard">Enter the circuit <ArrowUpRight /></Link>
              <Link className="pc-v6-button ghost" href="/proof">See live proof <span className="pc-v6-play">›</span></Link>
            </div>
          </div>

          <div className="pc-v6-hero-mantra" aria-hidden="true"><span>More</span><span>than</span><span>rewards</span><span>a brighter</span><span>you</span></div>
        </div>

        <V6HeroProof />
      </section>

      <section className="pc-v6-section pc-v6-pillars" id="about">
        <div className="pc-v6-mountain-cut" aria-hidden="true"><div className="pc-v6-sprite pc-v6-sprite-mountain" /></div>
        <div className="pc-v6-shell pc-v6-section-grid">
          <div className="pc-v6-section-intro">
            <span className="pc-v6-kicker">The four pillars</span>
            <h2>A different<br />kind of reward<br />platform.</h2>
            <p className="pc-v6-spaced">Same actions.<br />A brighter tomorrow.</p>
            <i className="pc-v6-gold-line" />
          </div>
          <div className="pc-v6-pillar-grid">
            <article><div className="pc-v6-orb lime"><Spark /></div><h3>Pulse</h3><p>Show up hourly.<br />Keep the rhythm.</p><Link href="/#how">Build habits <ArrowUpRight /></Link></article>
            <article><div className="pc-v6-orb gold"><Trend /></div><h3>Momentum</h3><p>Turn time into<br />progress.</p><Link href="/progress">Climb higher <ArrowUpRight /></Link></article>
            <article><div className="pc-v6-orb green"><Shield /></div><h3>Vault</h3><p>Track rewards.<br />See payout readiness.</p><Link href="/wallet">Open the Vault <ArrowUpRight /></Link></article>
            <article><div className="pc-v6-orb amber"><Users /></div><h3>Share</h3><p>Spread the pulse.<br />Grow together.</p><Link href="/invite">Multiply impact <ArrowUpRight /></Link></article>
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-v6-chamber-section" id="how">
        <div className="pc-v6-shell pc-v6-chamber-grid">
          <div className="pc-v6-section-intro compact">
            <span className="pc-v6-kicker">The core experience</span>
            <h2>Pulse<br />Chamber</h2>
            <p className="pc-v6-spaced">Real history.<br />Funded rewards only.<br />One focused loop.</p>
            <Link className="pc-v6-outline-link" href="/dashboard">Explore the dashboard <ArrowUpRight /></Link>
          </div>

          <div className="pc-v6-chamber-stage">
            <div className="pc-v6-chamber">
              <div className="pc-v6-chamber-head">
                <div><span className="pc-v6-badge">✦</span><small>Public preview</small><strong>Pulse Chamber</strong></div>
                <div className="pc-v6-live preview"><i /> Preview<br /><span>sign in for live state</span></div>
              </div>
              <div className="pc-v6-chamber-body">
                <div className="pc-v6-chamber-left">
                  <div className="pc-v6-mini-card"><small>Rank path</small><strong>Start at Spark</strong><div className="pc-v6-preview-track" aria-hidden="true"><span /></div></div>
                  <div className="pc-v6-mini-card"><small>Return rhythm</small><strong>Build your rhythm</strong><span>Created from real claim history</span></div>
                </div>

                <div className="pc-v6-pulse-core">
                  <div className="pc-v6-pulse-ring"><div className="pc-v6-wave">⌁</div><small>Pulse Chamber</small><strong>PREVIEW</strong></div>
                  <Link href="/auth?next=/dashboard">Enter the Pulse</Link>
                </div>

                <div className="pc-v6-chamber-right">
                  <div className="pc-v6-mini-card accent"><small>Next unlock</small><strong>Milestone seal</strong><span>Built from real history</span></div>
                  <div className="pc-v6-mini-card vault"><small>Vault balance</small><strong>Live after sign-in</strong><span><i /> authoritative only</span><Link href="/wallet">View Vault <ArrowUpRight /></Link></div>
                </div>
              </div>
            </div>
            <blockquote className="pc-v6-chamber-quote">“Small consistent actions<br />create extraordinary freedom.”</blockquote>
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-v6-momentum-section">
        <div className="pc-v6-road-cut" aria-hidden="true"><div className="pc-v6-sprite pc-v6-sprite-road" /></div>
        <div className="pc-v6-shell pc-v6-momentum-grid">
          <div className="pc-v6-section-intro compact">
            <span className="pc-v6-kicker">Your journey</span>
            <h2>Momentum<br />Lives Here</h2>
            <p className="pc-v6-spaced">Higher ranks.<br />Bigger possibilities.</p>
            <Link className="pc-v6-outline-link" href="/progress">View all ranks <ArrowUpRight /></Link>
          </div>
          <div className="pc-v6-ranks">
            {ranks.map((rank) => <article key={rank.id}><div className={`pc-v6-rank-art rank-${rank.id}`} /><strong>{rank.name}</strong><span>{rank.note}</span></article>)}
          </div>
          <div className="pc-v6-side-mantra"><span>Progress</span><span>turns</span><span>people</span><span>into</span><span>possibilities</span></div>
        </div>
      </section>

      <section className="pc-v6-section pc-v6-share" id="community">
        <div className="pc-v6-shell pc-v6-share-grid">
          <div className="pc-v6-section-intro compact">
            <span className="pc-v6-kicker">Share Studio</span>
            <h2>Moments<br />Move People</h2>
            <p>Your progress can<br />inspire the next one.</p>
            <Link className="pc-v6-outline-link" href="/progress#circuit-moments">Create your card <ArrowUpRight /></Link>
          </div>
          <div className="pc-v6-share-cards">
            <article className="pc-v6-social-card violet"><small>Pulsercuit</small><strong>RHYTHM</strong><span>Show the streak.<br />Keep the story moving.</span></article>
            <article className="pc-v6-social-card gold"><small>Pulsercuit</small><strong>RANK</strong><span>Spark to Resonance.<br />Earn every stage.</span></article>
            <article className="pc-v6-social-card lime"><small>Pulsercuit</small><strong>PROOF</strong><span>Real state.<br />No invented activity.</span></article>
            <article className="pc-v6-social-card eclipse"><small>Pulsercuit</small><strong>Still showing up.</strong><span>Return. Rise. Repeat.</span></article>
          </div>
          <div className="pc-v6-share-side"><span className="pc-v6-spaced">Be a signal<br />not noise</span><div className="pc-v6-social-icons"><i>𝕏</i><i>◎</i><i>◉</i><i>◫</i><i>↗</i></div><Link className="pc-v6-outline-link" href="/invite">Share the pulse <ArrowUpRight /></Link></div>
        </div>
      </section>

      <section className="pc-v6-section pc-v6-vault-section">
        <div className="pc-v6-space-cut" aria-hidden="true"><div className="pc-v6-sprite pc-v6-sprite-space" /></div>
        <div className="pc-v6-shell pc-v6-vault-grid">
          <div className="pc-v6-section-intro compact">
            <span className="pc-v6-kicker">The Vault</span>
            <h2>Your Effort<br />Deserves More</h2>
            <p>Track authoritative rewards.<br />Follow a verified payout path.</p>
            <Link className="pc-v6-outline-link" href="/wallet">Open your vault <ArrowUpRight /></Link>
          </div>
          <div className="pc-v6-vault-art"><div className="pc-v6-sprite pc-v6-sprite-vault" /><span>Build today<br />progress<br />tomorrow</span></div>
          <div className="pc-v6-vault-benefits">
            <div><span>◇</span><p><strong>Ledger-backed rewards</strong><small>Only authoritative credits appear as value.</small></p></div>
            <div><span className="lime">✓</span><p><strong>Verified payout path</strong><small>Provider and financial gates must be proven first.</small></p></div>
            <div><span>≋</span><p><strong>Your request</strong><small>Request withdrawal only when your account is eligible.</small></p></div>
          </div>
        </div>
      </section>

      <section className="pc-v6-final">
        <div className="pc-v6-eclipse" aria-hidden="true" />
        <div className="pc-v6-shell pc-v6-final-grid">
          <div className="pc-v6-final-mantra">Discipline<br />creates<br />freedom</div>
          <div className="pc-v6-final-copy"><span className="pc-v6-kicker">— Pulsercuit —</span><h2>A Brighter You<br />Starts Now.</h2><p>Return. Rise. Repeat.</p><Link className="pc-v6-button primary" href="/auth?next=/dashboard">Enter the circuit <ArrowUpRight /></Link></div>
          <V6FinalProof />
        </div>
      </section>

      <footer className="pc-v6-footer"><div className="pc-v6-shell"><strong>Pulsercuit</strong><span>© 2026 · Return. Rise. Repeat.</span><nav><Link href="/proof">Proof</Link><Link href="/support">Help</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></div></footer>
    </main>
  );
}
