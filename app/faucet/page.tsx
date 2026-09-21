import type { Metadata } from "next";
import Link from "next/link";
import { FunnelBeacon } from "@/components/funnel-beacon";
import { FunnelLink } from "@/components/funnel-link";
import { ArrowUpRight, Check, Shield, Spark, Wallet } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { getFaucetLaunchState } from "@/lib/faucet-launch";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const launch = await getFaucetLaunchState();
  return {
    title: "Faucet",
    description: "A simple recurring faucet experience with visible progress and FaucetPay payout.",
    robots: launch.publicClaimsOpen
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function FaucetPage() {
  const launch = await getFaucetLaunchState();
  const hours = launch.intervalMinutes / 60;
  const intervalLabel = launch.intervalMinutes % 60 === 0
    ? hours === 1 ? "every hour" : `every ${hours} hours`
    : `every ${launch.intervalMinutes} minutes`;

  return (
    <main className="marketing-page pc-faucet-page">
      <FunnelBeacon event="home_view" />
      <SiteHeader />

      <section className="pc-faucet-hero shell">
        <div className="pc-faucet-copy">
          <div className="eyebrow"><span className="live-dot" /> Pulsercuit Faucet</div>
          <h1>A faucet designed to be <em>worth coming back to.</em></h1>
          <p>Claim a simple recurring Pulse, watch your Vault grow, and keep your payout path in view. No ad wall before the reward.</p>

          <div className="hero-actions">
            {launch.publicClaimsOpen ? (
              <FunnelLink className="button button-lg" href="/auth?mode=signup&next=/dashboard" eventLabel="faucet_signup">
                Claim your first Pulse <ArrowUpRight />
              </FunnelLink>
            ) : (
              <FunnelLink className="button button-lg" href="/proof" eventLabel="faucet_proof">
                See live proof <ArrowUpRight />
              </FunnelLink>
            )}
            <FunnelLink className="button button-ghost button-lg" href="/proof" eventLabel="faucet_proof">
              Proof & payouts
            </FunnelLink>
          </div>

          <div className="pc-faucet-trust">
            <span><Check /> Simple claim</span>
            <span><Wallet /> FaucetPay payout path</span>
            <span><Shield /> No paid click required</span>
          </div>
        </div>

        <aside className={"pc-faucet-live-card " + (launch.publicClaimsOpen ? "is-open" : "is-pilot")}>
          <div className="pc-faucet-live-head">
            <span>{launch.publicClaimsOpen ? "Public faucet" : "Launch status"}</span>
            <i />
          </div>
          <div className="pc-faucet-live-core">
            <small>Pulse reward</small>
            <strong>+{launch.rewardCredits || 1} P</strong>
            <span>{intervalLabel}</span>
          </div>
          <div className="pc-faucet-live-foot">
            {launch.publicClaimsOpen ? (
              <>
                <b>OPEN</b>
                <span>Current funded capacity is live.</span>
              </>
            ) : (
              <>
                <b>PREPARING</b>
                <span>Public claiming stays closed until funded capacity and fair-share are ready.</span>
              </>
            )}
          </div>
        </aside>
      </section>

      <section className="pc-faucet-path shell" aria-label="Faucet journey">
        <article><span>01</span><Spark /><h2>Claim</h2><p>One clear Pulse action. The faucet comes first.</p></article>
        <article><span>02</span><Check /><h2>Return</h2><p>Your next eligibility window stays visible instead of hidden behind ad loops.</p></article>
        <article><span>03</span><Wallet /><h2>Build</h2><p>Your rewards accumulate in the Vault toward the current payout target.</p></article>
        <article><span>04</span><Shield /><h2>Payout</h2><p>Withdrawal uses the same protected FaucetPay payout path already proven by Pulsercuit.</p></article>
      </section>

      <section className="pc-faucet-difference shell">
        <div>
          <span className="section-kicker">Why Pulsercuit</span>
          <h2>The faucet is the entry point.<br />Not the obstacle course.</h2>
        </div>
        <div className="pc-faucet-difference-grid">
          <article><strong>No ad wall before claim</strong><p>Sponsored inventory is placed after successful Pulse activity, not between the visitor and the core reward.</p></article>
          <article><strong>Visible progress</strong><p>Pulse, Momentum and Vault create a reason to return beyond a single micro-payment.</p></article>
          <article><strong>Proof in public</strong><p>Aggregate claims and completed payouts remain visible without fake activity or synthetic counters.</p></article>
        </div>
      </section>

      {!launch.publicClaimsOpen ? (
        <section className="pc-faucet-launch-note shell">
          <Shield />
          <div>
            <span className="section-kicker">Controlled launch</span>
            <h2>We are not opening the faucet before the economics can support it.</h2>
            <p>The public entry is ready for validation, but claims remain controlled while Treasury capacity and fair-share are prepared for real FaucetPay traffic.</p>
          </div>
          <Link className="button button-secondary" href="/proof">Inspect current proof <ArrowUpRight /></Link>
        </section>
      ) : null}

      <section className="pc-faucet-final shell">
        <div><span className="section-kicker">Pulsercuit</span><h2>Claim. Return. Build toward payout.</h2><p>A cleaner reward loop for people who already know faucets — and expect better.</p></div>
        {launch.publicClaimsOpen ? (
          <FunnelLink className="button button-lg button-dark" href="/auth?mode=signup&next=/dashboard" eventLabel="faucet_signup">
            Start with one Pulse <ArrowUpRight />
          </FunnelLink>
        ) : <FunnelLink className="button button-lg button-dark" href="/proof" eventLabel="faucet_proof">See live proof <ArrowUpRight /></FunnelLink>}
      </section>

      <footer className="footer shell">
        <div><strong>Pulsercuit</strong><span>© 2026 · Faucet-first rewards.</span></div>
        <div><Link href="/">Home</Link><Link href="/proof">Proof</Link><Link href="/support">Help</Link></div>
      </footer>
    </main>
  );
}
