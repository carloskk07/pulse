import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { FunnelBeacon } from "@/components/funnel-beacon";
import { PulsercuitSensoryLayer } from "@/components/pulsercuit-sensory-layer";
import { V6FinalProof, V6HeroProof } from "@/components/v6-live-proof";
import { ArrowUpRight, Shield, Spark, Trend, Users } from "@/components/icons";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pulsercuit",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "Pulsercuit lets people claim funded Pulse rewards, build a verified balance and withdraw through a protected payout path.",
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
            <span className="pc-v6-kicker">Funded rewards · live proof</span>
            <h1>Return. <em>Rise.</em> Repeat.</h1>
            <p>Claim a funded Pulse. Build your balance. Withdraw when your Vault is ready.</p>
            <div className="pc-v6-actions">
              <Link className="pc-v6-button primary" href="/auth?mode=signup&next=/dashboard">Create free account <ArrowUpRight /></Link>
              <Link className="pc-v6-button ghost" href="/proof">See live proof <span className="pc-v6-play">›</span></Link>
            </div>
            <div className="pc-v10-hero-micro" aria-label="Entry benefits">
              <span>Free to join</span><span>No payment required</span><span>Production proof</span>
            </div>
          </div>

          <div className="pc-v11-hero-thesis" aria-label="Pulsercuit trust model">
            <small>How value becomes real</small>
            <span><b>01</b><strong>Funded before claim</strong><em>Reward windows depend on real Treasury authority.</em></span>
            <span><b>02</b><strong>Verified into balance</strong><em>Only authoritative activity becomes visible value.</em></span>
            <span><b>03</b><strong>Payout after eligibility</strong><em>Withdrawal stays gated until the protected path is ready.</em></span>
          </div>
        </div>

        <V6HeroProof />
      </section>

      <section className="pc-v11-trust-rail" aria-label="Why Pulsercuit is different">
        <div className="pc-v6-shell">
          <div><small>01 / FUNDING</small><strong>Reward authority before excitement.</strong><span>No invented earning state.</span></div>
          <div><small>02 / PROOF</small><strong>Production numbers stay visible.</strong><span>Zero remains a valid answer.</span></div>
          <div><small>03 / FOCUS</small><strong>One next action at a time.</strong><span>Progress without offerwall clutter.</span></div>
        </div>
      </section>

      <section className="pc-v6-section pc-v6-pillars" id="about">
        <div className="pc-v6-mountain-cut" aria-hidden="true"><div className="pc-v6-sprite pc-v6-sprite-mountain" /></div>
        <div className="pc-v6-shell pc-v6-section-grid">
          <div className="pc-v6-section-intro">
            <span className="pc-v6-kicker">How it works</span>
            <h2>Three clear<br />steps.<br />Then more.</h2>
            <p className="pc-v6-spaced">Pulse. Balance.<br />Protected payout.</p>
            <i className="pc-v6-gold-line" />
          </div>
          <div className="pc-v6-pillar-grid">
            <article><div className="pc-v6-orb lime"><Spark /></div><h3>Pulse</h3><p>Claim one funded reward<br />when your window opens.</p><Link href="/auth?mode=signup&next=/dashboard">Claim your first Pulse <ArrowUpRight /></Link></article>
            <article><div className="pc-v6-orb gold"><Trend /></div><h3>Vault</h3><p>Verified rewards build<br />one visible balance.</p><Link href="/wallet">See the Vault <ArrowUpRight /></Link></article>
            <article><div className="pc-v6-orb green"><Shield /></div><h3>Payout</h3><p>Reach the target, then use<br />the protected withdrawal path.</p><Link href="/proof">See payout proof <ArrowUpRight /></Link></article>
            <article><div className="pc-v6-orb amber"><Users /></div><h3>Share</h3><p>After real progress, invite<br />people without fake activity.</p><Link href="/invite">See sharing <ArrowUpRight /></Link></article>
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-v6-chamber-section" id="how">
        <div className="pc-v6-shell pc-v6-chamber-grid">
          <div className="pc-v6-section-intro compact">
            <span className="pc-v6-kicker">The core experience</span>
            <h2>One Pulse.<br />One next<br />move.</h2>
            <p className="pc-v6-spaced">One funded reward.<br />One live timer.<br />No clutter.</p>
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
                  <div className="pc-v6-mini-card"><small>Return rhythm</small><strong>Build your rhythm</strong><span>Created from real claim history</span></div>
                </div>

                <div className="pc-v6-pulse-core">
                  <div className="pc-v6-pulse-ring"><div className="pc-v6-wave">⌁</div><small>Pulse Chamber</small><strong>PREVIEW</strong></div>
                  <Link href="/auth?mode=signup&next=/dashboard">Create account</Link>
                </div>

                <div className="pc-v6-chamber-right">
                  <div className="pc-v6-mini-card accent"><small>Next unlock</small><strong>Milestone seal</strong><span>Built from real history</span></div>
                  <div className="pc-v6-mini-card vault"><small>Vault balance</small><strong>Live after sign-in</strong><span><i /> authoritative only</span><Link href="/wallet">View Vault <ArrowUpRight /></Link></div>
                </div>
              </div>
            </div>
            <blockquote className="pc-v6-chamber-quote">“The interface only moves<br />when real activity does.”</blockquote>
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-v6-momentum-section">
        <div className="pc-v6-road-cut" aria-hidden="true"><div className="pc-v6-sprite pc-v6-sprite-road" /></div>
        <div className="pc-v6-shell pc-v6-momentum-grid">
          <div className="pc-v6-section-intro compact">
            <span className="pc-v6-kicker">After the core loop</span>
            <h2>Progress<br />After Proof</h2>
            <p className="pc-v6-spaced">Ranks and milestones grow<br />only from real Pulse history.</p>
            <Link className="pc-v6-outline-link" href="/progress">See Momentum <ArrowUpRight /></Link>
          </div>
          <div className="pc-v6-ranks">
            {ranks.map((rank) => <article key={rank.id}><div className={`pc-v6-rank-art rank-${rank.id}`} /><strong>{rank.name}</strong><span>{rank.note}</span></article>)}
          </div>
          <div className="pc-v6-side-mantra"><span>Progress</span><span>turns</span><span>people</span><span>into</span><span>possibilities</span></div>
        </div>
      </section>

      <section className="pc-v6-section pc-v6-vault-section">
        <div className="pc-v6-space-cut" aria-hidden="true"><div className="pc-v6-sprite pc-v6-sprite-space" /></div>
        <div className="pc-v6-shell pc-v6-vault-grid">
          <div className="pc-v6-section-intro compact">
            <span className="pc-v6-kicker">The Vault</span>
            <h2>Balance You<br />Can Understand</h2>
            <p>See what is available, what is missing<br />and when payout becomes eligible.</p>
            <Link className="pc-v6-outline-link" href="/wallet">Open your vault <ArrowUpRight /></Link>
          </div>
          <div className="pc-v6-vault-art"><div className="pc-v6-sprite pc-v6-sprite-vault" /><span>Build today<br />progress<br />tomorrow</span></div>
          <div className="pc-v6-vault-benefits">
            <div><span>◇</span><p><strong>Ledger-backed rewards</strong><small>Only verified rewards appear in your balance.</small></p></div>
            <div><span className="lime">✓</span><p><strong>Verified payout path</strong><small>Payments stay unavailable until the protected path is ready.</small></p></div>
            <div><span>≋</span><p><strong>Your request</strong><small>One withdrawal request at a time when your account is eligible.</small></p></div>
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-v6-share" id="community">
        <div className="pc-v6-shell pc-v6-share-grid">
          <div className="pc-v6-section-intro compact">
            <span className="pc-v6-kicker">Share Studio</span>
            <h2>Moments<br />Move People</h2>
            <p>Share verified progress<br />without sharing balance.</p>
            <Link className="pc-v6-outline-link" href="/progress#circuit-moments">Create your card <ArrowUpRight /></Link>
          </div>
          <div className="pc-v6-share-cards">
            <article className="pc-v6-social-card violet"><small>Pulsercuit</small><strong>RHYTHM</strong><span>Show the streak.<br />Keep the story moving.</span></article>
            <article className="pc-v6-social-card gold"><small>Pulsercuit</small><strong>RANK</strong><span>Spark to Resonance.<br />Build every stage.</span></article>
            <article className="pc-v6-social-card lime"><small>Pulsercuit</small><strong>PROOF</strong><span>Real state.<br />No invented activity.</span></article>
            <article className="pc-v6-social-card eclipse"><small>Pulsercuit</small><strong>Still showing up.</strong><span>Return. Rise. Repeat.</span></article>
          </div>
          <div className="pc-v6-share-side"><span className="pc-v6-spaced">Be a signal<br />not noise</span><div className="pc-v6-social-icons"><i>𝕏</i><i>◎</i><i>◉</i><i>◫</i><i>↗</i></div><Link className="pc-v6-outline-link" href="/invite">Share progress <ArrowUpRight /></Link></div>
        </div>
      </section>

      <section className="pc-v6-final">
        <div className="pc-v6-eclipse" aria-hidden="true" />
        <div className="pc-v6-shell pc-v6-final-grid">
          <div className="pc-v6-final-mantra">Proof<br />before<br />hype</div>
          <div className="pc-v6-final-copy"><span className="pc-v6-kicker">— Pulsercuit —</span><h2>Start With<br />One Pulse.</h2><p>Free to join. Real progress starts after real activity.</p><Link className="pc-v6-button primary" href="/auth?mode=signup&next=/dashboard">Create free account <ArrowUpRight /></Link></div>
          <V6FinalProof />
        </div>
      </section>

      <footer className="pc-v6-footer"><div className="pc-v6-shell"><strong>Pulsercuit</strong><span>© 2026 · Return. Rise. Repeat.</span><nav><Link href="/proof">Proof</Link><Link href="/business">Business</Link><Link href="/support">Help</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></div></footer>
    </main>
  );
}
