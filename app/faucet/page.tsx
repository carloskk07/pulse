import type { Metadata } from "next";
import Link from "next/link";
import { FunnelBeacon } from "@/components/funnel-beacon";
import { FunnelLink } from "@/components/funnel-link";
import { ArrowUpRight, Check, Shield, Spark, Wallet } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PulseCoreVisual } from "@/components/pulse-core-visual";
import { getFaucetLaunchState } from "@/lib/faucet-launch";
import { formatUsdFromCredits } from "@/lib/reward-state";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const launch = await getFaucetLaunchState();
  return {
    title: "Free Crypto Faucet",
    description: "Claim a recurring free crypto reward, see its dollar value clearly and build toward a FaucetPay payout.",
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
  const rewardCredits = Math.max(1, launch.rewardCredits || 1);
  const rewardVariable = launch.rewardVariable;
  const rewardValue = formatUsdFromCredits(rewardCredits);
  const rewardMinValue = formatUsdFromCredits(Math.max(1, launch.rewardMinCredits || rewardCredits));
  const rewardMaxValue = formatUsdFromCredits(Math.max(1, launch.rewardMaxCredits || rewardCredits));
  const rewardDisplay = rewardVariable ? `${rewardMinValue}–${rewardMaxValue}` : rewardValue;
  const payout = getFaucetPayPackConfig();
  const payoutAsset = payout.asset || "USDT";

  return (
    <main className="marketing-page pc-faucet-page pc-value-first-faucet">
      <FunnelBeacon event="faucet_view" />
      <SiteHeader />

      <section className="pc-faucet-hero shell">
        <div className="pc-faucet-copy">
          <div className="eyebrow"><span className="live-dot" /> Free crypto faucet</div>
          <h1>{!launch.publicClaimsOpen ? <>A clearer way to <em>earn free crypto.</em></> : rewardVariable ? <>Claim every hour. <em>Reveal your reward.</em></> : <>Earn crypto <em>every hour.</em></>}</h1>
          <p>
            {rewardVariable ? <>The live faucet range is <strong>{rewardDisplay}</strong>. Each eligible claim reveals one value from that published range.</> : <>The current live rule is <strong>{rewardDisplay}</strong> per eligible claim, but Pulsercuit is not tied to one permanent prize amount.</>}
            {" "}Your balance stays visible in money terms, and payouts use {payoutAsset} through FaucetPay.
          </p>

          <div className="hero-actions">
            <FunnelLink className="button button-light button-lg" href="/auth?mode=signup&next=/dashboard" eventLabel="faucet_signup">
              {launch.publicClaimsOpen ? "Start earning free crypto" : "Create free account"} <ArrowUpRight />
            </FunnelLink>
            <FunnelLink className="button button-ghost button-lg" href="/proof" eventLabel="faucet_proof">
              See payout proof
            </FunnelLink>
          </div>

          <div className="pc-faucet-trust">
            <span><Check /> {rewardVariable ? "Live reward range shown before claim" : "Current reward rule shown before claim"}</span>
            <span><Wallet /> {payoutAsset} through FaucetPay</span>
            <span><Shield /> No purchase required</span>
          </div>
        </div>

        <aside className={"pc-faucet-live-card " + (launch.publicClaimsOpen ? "is-open" : "is-limited")}>
          <div className="pc-faucet-live-head">
            <span>{rewardVariable ? "Live reward range" : "Current reward rule"}</span>
            <i />
          </div>
          <PulseCoreVisual
            state={launch.publicClaimsOpen ? "ready" : "limited"}
            eyebrow={rewardVariable ? "Variable reward draw" : "Per eligible claim"}
            caption={rewardVariable ? `Published range · returns ${intervalLabel}` : `${payoutAsset} value · returns ${intervalLabel}`}
          >
            <span className="pulse-core-word pc-faucet-money-value">+{rewardDisplay}</span>
          </PulseCoreVisual>
          <div className="pc-faucet-live-foot">
            {launch.publicClaimsOpen ? (
              <>
                <b>CLAIMING OPEN</b>
                <span>{rewardVariable ? "Sign in to see your timer and reveal the reward for this claim." : "Sign in to see your timer and claim under the current live rule."}</span>
              </>
            ) : (
              <>
                <b>EARLY ACCESS</b>
                <span>{rewardVariable ? `Launch reward range: ${rewardDisplay}. Claiming remains closed until public access opens.` : "Create your account now. Your live eligibility appears inside the app as access opens."}</span>
              </>
            )}
          </div>
        </aside>
      </section>

      <section className="pc-faucet-path shell" aria-label="Faucet journey">
        <article><span>01</span><Spark /><h2>Claim</h2><p>Take the recurring faucet reward when your personal timer is open.</p></article>
        <article><span>02</span><Check /><h2>Earn more</h2><p>Use optional tasks, referrals and other verified rewards when they are worth your time.</p></article>
        <article><span>03</span><Wallet /><h2>Build balance</h2><p>See your balance value and payout distance in plain money terms.</p></article>
        <article><span>04</span><Shield /><h2>Withdraw</h2><p>Use the protected FaucetPay payout path when your current payout target is reached.</p></article>
      </section>

      <section className="pc-faucet-difference shell">
        <div>
          <span className="section-kicker">Why Pulsercuit</span>
          <h2>A faucet should make the reward obvious.</h2>
        </div>
        <div className="pc-faucet-difference-grid">
          <article><strong>Not one permanent prize</strong><p>Pulsercuit can publish variable reward bands. When variable mode is active, each eligible claim is resolved from the live range shown before claiming.</p></article>
          <article><strong>Optional earning paths</strong><p>The hourly faucet stays central. Higher-value tasks and partner rewards are separate choices, not a wall before your claim.</p></article>
          <article><strong>Public payout evidence</strong><p>The Proof Center separates credited rewards from completed withdrawals instead of blending both into one marketing number.</p></article>
        </div>
      </section>

      {!launch.publicClaimsOpen ? (
        <section className="pc-faucet-launch-note shell">
          <Shield />
          <div>
            <span className="section-kicker">Current availability</span>
            <h2>Hourly faucet access is opening gradually.</h2>
            <p>Create an account now and inspect the live Proof Center. Your account shows claim availability as soon as your access is open.</p>
          </div>
          <Link className="button button-secondary" href="/proof">See live proof <ArrowUpRight /></Link>
        </section>
      ) : null}

      <section className="pc-faucet-final shell">
        <div>
          <span className="section-kicker">Start free</span>
          <h2>Claim when your timer opens. See what every reward is worth.</h2>
          <p>Free account, visible reward value, optional ways to earn more, and a FaucetPay payout path.</p>
        </div>
        <FunnelLink className="button button-lg button-dark" href="/auth?mode=signup&next=/dashboard" eventLabel="faucet_signup">
          Create free account <ArrowUpRight />
        </FunnelLink>
      </section>

      <SiteFooter />
    </main>
  );
}
