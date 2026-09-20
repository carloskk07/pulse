import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { FunnelBeacon } from "@/components/funnel-beacon";
import { FunnelLink } from "@/components/funnel-link";
import { PulsercuitSensoryLayer } from "@/components/pulsercuit-sensory-layer";
import { V6FinalProof, V6HeroProof } from "@/components/v6-live-proof";
import { ArrowUpRight, Shield, Spark, Trend } from "@/components/icons";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pulsercuit",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "Pulsercuit is a simple reward loop built around Pulse, Vault and payout.",
};

const ranks = [
  { id: "spark", name: "Spark", note: "Start with one Pulse" },
  { id: "flow", name: "Flow", note: "Build a return rhythm" },
  { id: "rhythm", name: "Rhythm", note: "Grow verified history" },
  { id: "circuit", name: "Circuit", note: "Keep the loop moving" },
  { id: "resonance", name: "Resonance", note: "Reach the highest stage" },
] as const;

export default function HomePage() {
  return (
    <main className="pc-v6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <FunnelBeacon event="home_view" />
      <PulsercuitSensoryLayer />
      <SiteHeader overlay />

      <section className="pc-v6-hero">
        <div className="pc-v6-hero-bg" aria-hidden="true"><div className="pc-v6-sprite pc-v6-sprite-hero" /></div>
        <div className="pc-v6-shell pc-v6-hero-grid">
          <div className="pc-v6-hero-copy">
            <span className="pc-v6-kicker">A simpler reward loop</span>
            <h1>Return. <em>Rise.</em> Repeat.</h1>
            <p>Claim a Pulse. Grow your Vault. Build toward payout.</p>
            <div className="pc-v6-actions">
              <FunnelLink className="pc-v6-button primary" href="/auth?mode=signup&next=/dashboard" eventLabel="home_hero_signup">Create free account <ArrowUpRight /></FunnelLink>
              <FunnelLink className="pc-v6-button ghost" href="/proof" eventLabel="home_hero_proof">See live proof <span className="pc-v6-play">›</span></FunnelLink>
            </div>
            <div className="pc-v10-hero-micro" aria-label="Entry benefits">
              <span>Free to join</span><span>No purchase required</span><span>Payout safeguards</span>
            </div>
          </div>

          <div className="pc-v11-hero-thesis" aria-label="Pulsercuit path">
            <small>Pulse → Vault → Payout</small>
            <span><b>01</b><strong>Claim your Pulse</strong></span>
            <span><b>02</b><strong>Grow your Vault</strong></span>
            <span><b>03</b><strong>Reach payout</strong></span>
          </div>
        </div>

        <V6HeroProof />
      </section>

      <section className="pc-v6-section pc-v6-pillars" id="about">
        <div className="pc-v6-mountain-cut" aria-hidden="true"><div className="pc-v6-sprite pc-v6-sprite-mountain" /></div>
        <div className="pc-v6-shell pc-v6-section-grid">
          <div className="pc-v6-section-intro">
            <span className="pc-v6-kicker">How it works</span>
            <h2>Simple by<br />design.</h2>
            <p className="pc-v6-spaced">Pulse. Vault.<br />Payout.</p>
            <i className="pc-v6-gold-line" />
          </div>
          <div className="pc-v6-pillar-grid pc-v12-pillar-grid">
            <article><div className="pc-v6-orb lime"><Spark /></div><h3>Pulse</h3><p>Claim when your next<br />Pulse opens.</p><FunnelLink href="/auth?mode=signup&next=/dashboard" eventLabel="home_pillar_signup">Claim your first Pulse <ArrowUpRight /></FunnelLink></article>
            <article><div className="pc-v6-orb gold"><Trend /></div><h3>Vault</h3><p>Keep your balance<br />easy to follow.</p><Link href="/wallet">See the Vault <ArrowUpRight /></Link></article>
            <article><div className="pc-v6-orb green"><Shield /></div><h3>Payout</h3><p>Build toward your<br />payout target.</p><FunnelLink href="/proof" eventLabel="home_pillar_proof">See payout proof <ArrowUpRight /></FunnelLink></article>
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-v6-chamber-section" id="how">
        <div className="pc-v6-shell pc-v6-chamber-grid">
          <div className="pc-v6-section-intro compact">
            <span className="pc-v6-kicker">Your Pulse</span>
            <h2>One clear<br />next move.</h2>
            <p className="pc-v6-spaced">Claim. Return.<br />Keep moving.</p>
            <Link className="pc-v6-outline-link" href="/dashboard">See the live experience <ArrowUpRight /></Link>
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
                  <div className="pc-v6-mini-card"><small>Return rhythm</small><strong>Build your rhythm</strong><span>Grows as you return</span></div>
                </div>

                <div className="pc-v6-pulse-core">
                  <div className="pc-v6-pulse-ring"><div className="pc-v6-wave">⌁</div><small>Pulse Chamber</small><strong>PREVIEW</strong></div>
                  <FunnelLink href="/auth?mode=signup&next=/dashboard" eventLabel="home_chamber_signup">Create account</FunnelLink>
                </div>

                <div className="pc-v6-chamber-right">
                  <div className="pc-v6-mini-card accent"><small>Next unlock</small><strong>Milestone seal</strong><span>Unlocks as you progress</span></div>
                  <div className="pc-v6-mini-card vault"><small>Vault balance</small><strong>Visible after sign-in</strong><Link href="/wallet">View Vault <ArrowUpRight /></Link></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-v6-momentum-section">
        <div className="pc-v6-road-cut" aria-hidden="true"><div className="pc-v6-sprite pc-v6-sprite-road" /></div>
        <div className="pc-v6-shell pc-v6-momentum-grid pc-v12-momentum-grid">
          <div className="pc-v6-section-intro compact">
            <span className="pc-v6-kicker">Momentum</span>
            <h2>Progress<br />you can feel.</h2>
            <p className="pc-v6-spaced">Ranks and milestones grow<br />as you return.</p>
            <Link className="pc-v6-outline-link" href="/progress">See Momentum <ArrowUpRight /></Link>
          </div>
          <div className="pc-v6-ranks">
            {ranks.map((rank) => <article key={rank.id}><div className={`pc-v6-rank-art rank-${rank.id}`} /><strong>{rank.name}</strong><span>{rank.note}</span></article>)}
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-v6-vault-section">
        <div className="pc-v6-space-cut" aria-hidden="true"><div className="pc-v6-sprite pc-v6-sprite-space" /></div>
        <div className="pc-v6-shell pc-v6-vault-grid">
          <div className="pc-v6-section-intro compact">
            <span className="pc-v6-kicker">The Vault</span>
            <h2>Your balance.<br />In view.</h2>
            <p>Know where you are and how close<br />you are to payout.</p>
            <Link className="pc-v6-outline-link" href="/wallet">Open your vault <ArrowUpRight /></Link>
          </div>
          <div className="pc-v6-vault-art"><div className="pc-v6-sprite pc-v6-sprite-vault" /></div>
          <div className="pc-v6-vault-benefits">
            <div><span>◇</span><p><strong>Clear balance</strong><small>Everything in one place.</small></p></div>
            <div><span className="lime">✓</span><p><strong>Payout in view</strong><small>See how close you are.</small></p></div>
            <div><span>≋</span><p><strong>One simple request</strong><small>Withdraw when you&apos;re ready.</small></p></div>
          </div>
        </div>
      </section>

      <section className="pc-v6-final">
        <div className="pc-v6-eclipse" aria-hidden="true" />
        <div className="pc-v6-shell pc-v6-final-grid">
          <div className="pc-v6-final-mantra">One Pulse<br />at a<br />time</div>
          <div className="pc-v6-final-copy"><span className="pc-v6-kicker">— Pulsercuit —</span><h2>Start With<br />One Pulse.</h2><p>Start free. Come back when you&apos;re ready.</p><FunnelLink className="pc-v6-button primary" href="/auth?mode=signup&next=/dashboard" eventLabel="home_final_signup">Create free account <ArrowUpRight /></FunnelLink></div>
          <V6FinalProof />
        </div>
      </section>

      <footer className="pc-v6-footer"><div className="pc-v6-shell"><strong>Pulsercuit</strong><span>© 2026 · Return. Rise. Repeat.</span><nav><Link href="/proof">Proof</Link><Link href="/business">Business</Link><Link href="/support">Help</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></div></footer>
    </main>
  );
}
