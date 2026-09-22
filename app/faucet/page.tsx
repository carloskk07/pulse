import type { Metadata } from "next";
import Link from "next/link";
import { FunnelBeacon } from "@/components/funnel-beacon";
import { FunnelLink } from "@/components/funnel-link";
import { ArrowUpRight, Check, Shield, Spark, Wallet } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PulseCoreVisual } from "@/components/pulse-core-visual";
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
      <FunnelBeacon event="faucet_view" />
      <SiteHeader />

      <section className="pc-faucet-hero shell">
        <div className="pc-faucet-copy">
          <div className="eyebrow"><span className="live-dot" /> Pulsercuit Faucet</div>
          <h1>A faucet designed to be <em>worth coming back to.</em></h1>
          <p>Claim a simple recurring Pulse, watch your Vault grow, and keep your payout path in view. No ad wall before the reward.</p>

          <div className="hero-actions">
            <FunnelLink className="button button-light button-lg" href="/auth?mode=signup&next=/dashboard" eventLabel="faucet_signup">
              {launch.publicClaimsOpen ? "Claim your first Pulse" : "Create free account"} <ArrowUpRight />
            </FunnelLink>
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

        <aside className={"pc-faucet-live-card " + (launch.publicClaimsOpen ? "is-open" : "is-limited")}>
          <div className="pc-faucet-live-head">
            <span>Pulse status</span>
            <i />
          </div>
          <PulseCoreVisual
            state={launch.publicClaimsOpen ? "ready" : "limited"}
            eyebrow="Hourly Pulse"
            caption={`Returns ${intervalLabel}`}
          >
            <span className="pulse-core-word">+{launch.rewardCredits || 1} P</span>
          </PulseCoreVisual>
          <div className="pc-faucet-live-foot">
            {launch.publicClaimsOpen ? (
              <>
                <b>CLAIMING OPEN</b>
                <span>Sign in to see your personal eligibility and claim state.</span>
              </>
            ) : (
              <>
                <b>ACCESS LIMITED</b>
                <span>Create your account now. Claim availability appears in your account when access is open.</span>
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
          <h2>The faucet is the entry point.<br />Everything else builds around it.</h2>
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
            <span className="section-kicker">Current availability</span>
            <h2>Public claiming is currently limited.</h2>
            <p>You can create an account and inspect live proof now. Claim availability is shown inside your account when access is open.</p>
          </div>
          <Link className="button button-secondary" href="/proof">Inspect live proof <ArrowUpRight /></Link>
        </section>
      ) : null}

      <section className="pc-faucet-final shell">
        <div><span className="section-kicker">Pulsercuit</span><h2>Claim. Return. Build toward payout.</h2><p>A cleaner reward loop for people who already know faucets — and expect better.</p></div>
        <FunnelLink className="button button-lg button-dark" href="/auth?mode=signup&next=/dashboard" eventLabel="faucet_signup">
          {launch.publicClaimsOpen ? "Start with one Pulse" : "Create free account"} <ArrowUpRight />
        </FunnelLink>
      </section>

      <SiteFooter />
    </main>
  );
}
