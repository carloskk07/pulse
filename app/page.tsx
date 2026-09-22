import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { FunnelBeacon } from "@/components/funnel-beacon";
import { FunnelLink } from "@/components/funnel-link";
import { PulsercuitSensoryLayer } from "@/components/pulsercuit-sensory-layer";
import { V6FinalProof, V6HeroProof, V6RecentActivity } from "@/components/v6-live-proof";
import { ArrowUpRight, Check, Clock, Shield, Spark, Wallet } from "@/components/icons";
import { getFaucetLaunchState } from "@/lib/faucet-launch";
import { getHomeBootstrapProof } from "@/lib/social-proof";

export const revalidate = 60;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pulsercuit",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "Pulsercuit is a faucet-first reward loop built around recurring Pulse claims, a visible Vault and FaucetPay payout.",
};

function intervalLabel(minutes: number) {
  if (minutes === 60) return "Every 60 min";
  if (minutes < 60) return `Every ${minutes} min`;
  if (minutes % 60 === 0) return `Every ${minutes / 60}h`;
  return `Every ${minutes} min`;
}

export default async function HomePage() {
  const [initialProof, launch] = await Promise.all([
    getHomeBootstrapProof(),
    getFaucetLaunchState(),
  ]);

  const pulseInterval = Math.max(15, launch.intervalMinutes || 60);
  const rewardCredits = Math.max(1, launch.rewardCredits || 1);
  const publicLive = launch.publicClaimsOpen;

  return (
    <main className="pc-v6 pc-home-lobby">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <FunnelBeacon event="home_view" />
      <PulsercuitSensoryLayer />
      <SiteHeader overlay />

      <section className="pc-home-hero">
        <div className="pc-home-grid" aria-hidden="true" />
        <div className="pc-v6-shell pc-home-hero-grid">
          <div className="pc-home-hero-copy">
            <div className="pc-home-live-kicker">
              <span className={publicLive ? "is-live" : "is-preparing"} />
              {publicLive ? "Public faucet live" : "Pulsercuit faucet"}
            </div>

            <h1>Claim. Return.<br /><em>Get closer to payout.</em></h1>
            <p>
              A faucet built around one simple loop: claim a Pulse, come back when your personal timer reopens,
              grow your Vault and withdraw through FaucetPay.
            </p>

            <div className="pc-home-actions">
              <FunnelLink
                className="pc-v6-button primary pc-home-primary"
                href="/auth?mode=signup&next=/dashboard"
                eventLabel="home_hero_signup"
              >
                {publicLive ? "Enter the circuit" : "Create free account"} <ArrowUpRight />
              </FunnelLink>
              <FunnelLink
                className="pc-v6-button ghost"
                href="/proof"
                eventLabel="home_hero_proof"
              >
                See live proof
              </FunnelLink>
            </div>

            <div className="pc-home-trust-row" aria-label="Pulsercuit entry benefits">
              <span><Check /> Free to join</span>
              <span><Shield /> No purchase required</span>
              <span><Wallet /> FaucetPay payout path</span>
            </div>
          </div>

          <aside className="pc-home-core-stage" aria-label="Pulse rhythm">
            <div className="pc-home-core-radar" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="pc-home-core">
              <span className="pc-home-core-label">Hourly Pulse</span>
              <strong>+{rewardCredits} P</strong>
              <small>{intervalLabel(pulseInterval)} after a successful claim</small>
            </div>
            <div className="pc-home-core-status">
              <span><i className={publicLive ? "is-live" : "is-preparing"} /> {publicLive ? "Claiming open" : "Personal claim rhythm"}</span>
              <small>Your personal timer lives inside the app.</small>
            </div>
          </aside>
        </div>

        <div className="pc-v6-shell pc-home-proof-strip">
          <V6HeroProof initialProof={initialProof} />
          <div className="pc-home-proof-note">
            <span>Live circuit</span>
            <strong>Real activity. Real payout evidence.</strong>
            <Link href="/proof">Open proof center <ArrowUpRight /></Link>
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-home-section pc-home-loop" id="how">
        <div className="pc-v6-shell">
          <div className="pc-home-section-head">
            <div>
              <span className="pc-home-eyebrow">The loop</span>
              <h2>Three moves.<br />No obstacle course.</h2>
            </div>
            <p>The faucet is the entry point, not a maze of ads before the reward.</p>
          </div>

          <div className="pc-home-loop-grid">
            <article>
              <div className="pc-home-step-icon"><Spark /></div>
              <span>01</span>
              <h3>Claim your Pulse</h3>
              <p>When your personal Pulse is available, one clear action moves the reward into your circuit.</p>
            </article>
            <article>
              <div className="pc-home-step-icon"><Clock /></div>
              <span>02</span>
              <h3>Come back on your rhythm</h3>
              <p>Your return window follows your own claim history, so the rhythm stays personal to your account.</p>
            </article>
            <article>
              <div className="pc-home-step-icon"><Wallet /></div>
              <span>03</span>
              <h3>Grow the Vault</h3>
              <p>Keep your balance and payout distance visible until you are ready to use the payout path.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-home-section pc-home-return">
        <div className="pc-v6-shell pc-home-return-grid">
          <div className="pc-home-return-copy">
            <span className="pc-home-eyebrow">Why return?</span>
            <h2>The faucet is only the first layer.</h2>
            <p>
              Pulsercuit keeps the core claim simple, then gives the rest of the product room to make each return more useful.
            </p>
            <Link className="pc-home-inline-link" href="/progress">Explore Momentum <ArrowUpRight /></Link>
          </div>

          <div className="pc-home-return-board">
            <article><span>01</span><div><strong>Personal return rhythm</strong><small>Your next Pulse stays visible after sign-in.</small></div></article>
            <article><span>02</span><div><strong>Momentum</strong><small>Ranks and milestones turn repeated visits into visible progress.</small></div></article>
            <article><span>03</span><div><strong>Network</strong><small>Invite activity can build a deeper reward layer around your account.</small></div></article>
            <article><span>04</span><div><strong>More earning paths</strong><small>Optional sponsored and verified opportunities can live between Pulses.</small></div></article>
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-home-section pc-home-live-section">
        <div className="pc-v6-shell">
          <div className="pc-home-section-head">
            <div>
              <span className="pc-home-eyebrow">Live circuit</span>
              <h2>Proof before promises.</h2>
            </div>
            <p>Public numbers come from the production system, not from decorative counters.</p>
          </div>

          <div className="pc-home-live-grid">
            <div className="pc-home-activity-panel">
              <div className="pc-home-panel-head">
                <span><i /> Recent verified activity</span>
                <Link href="/proof">View all <ArrowUpRight /></Link>
              </div>
              <V6RecentActivity initialProof={initialProof} />
            </div>

            <div className="pc-home-proof-card">
              <span className="pc-home-eyebrow">Public proof</span>
              <V6FinalProof initialProof={initialProof} />
              <p>Members, reward events and paid withdrawals are published from the same production evidence used by the proof center.</p>
              <FunnelLink className="pc-home-proof-cta" href="/proof" eventLabel="home_hero_proof">
                Inspect the proof <ArrowUpRight />
              </FunnelLink>
            </div>
          </div>
        </div>
      </section>

      <section className="pc-v6-final pc-home-final">
        <div className="pc-home-final-glow" aria-hidden="true" />
        <div className="pc-v6-shell pc-home-final-grid">
          <div>
            <span className="pc-home-eyebrow">Pulsercuit</span>
            <h2>Your next return<br />can mean something.</h2>
            <p>Start with one account. Claim when your Pulse opens. Keep the payout path in view.</p>
          </div>
          <FunnelLink
            className="pc-v6-button primary pc-home-primary"
            href="/auth?mode=signup&next=/dashboard"
            eventLabel="home_final_signup"
          >
            Create your circuit <ArrowUpRight />
          </FunnelLink>
        </div>
      </section>

      <footer className="pc-v6-footer pc-home-footer">
        <div className="pc-v6-shell">
          <strong>Pulsercuit</strong>
          <span>© 2026 · Faucet-first rewards.</span>
          <nav>
            <Link href="/faucet">Faucet</Link>
            <Link href="/proof">Proof</Link>
            <Link href="/business">Business</Link>
            <Link href="/support">Help</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
