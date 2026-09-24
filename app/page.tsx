import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FunnelBeacon } from "@/components/funnel-beacon";
import { FunnelLink } from "@/components/funnel-link";
import { PulsercuitSensoryLayer } from "@/components/pulsercuit-sensory-layer";
import { PulseCoreVisual } from "@/components/pulse-core-visual";
import { EarnSpectrumArtwork, RewardArtifact } from "@/components/pulse-visuals";
import { V6RecentActivity } from "@/components/v6-live-proof";
import { ArrowUpRight, Check, Clock, Shield, Spark, Wallet } from "@/components/icons";
import { getFaucetLaunchState } from "@/lib/faucet-launch";
import { formatUsdFromCredits } from "@/lib/reward-state";
import { getHomeBootstrapProof } from "@/lib/social-proof";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export const revalidate = 60;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pulsercuit",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "Pulsercuit is a free crypto reward platform with a recurring faucet, extra earning paths and FaucetPay payouts.",
};

function intervalLabel(minutes: number) {
  if (minutes === 60) return "Every hour";
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
  const rewardVariable = launch.rewardVariable;
  const publicLive = launch.publicClaimsOpen;
  const rewardValue = formatUsdFromCredits(rewardCredits);
  const rewardMinValue = formatUsdFromCredits(Math.max(1, launch.rewardMinCredits || rewardCredits));
  const rewardMaxValue = formatUsdFromCredits(Math.max(1, launch.rewardMaxCredits || rewardCredits));
  const rewardDisplay = rewardVariable ? `${rewardMinValue}–${rewardMaxValue}` : rewardValue;
  const payout = getFaucetPayPackConfig();
  const payoutAsset = payout.asset || "USDT";

  return (
    <main className="pc-v6 pc-home-lobby pc-value-first-home">
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
              {publicLive ? "Hourly crypto faucet · live" : "Free crypto rewards · early access"}
            </div>

            <h1>
              Earn crypto.<br />
              <em>Know what it is worth.</em>
            </h1>
            <p>
              Claim a recurring faucet reward where each eligible claim can reveal a different value from the published
              range. See the money value clearly before and after every draw. No purchase is required to join.
            </p>

            <div className="pc-home-actions">
              <FunnelLink
                className="pc-v6-button primary pc-home-primary"
                href="/auth?mode=signup&next=/dashboard"
                eventLabel="home_hero_signup"
              >
                {publicLive ? "Start earning free crypto" : "Create free account"} <ArrowUpRight />
              </FunnelLink>
              <FunnelLink
                className="pc-v6-button ghost"
                href="/faucet"
                eventLabel="home_hero_faucet"
              >
                See how the faucet works
              </FunnelLink>
            </div>

            <div className="pc-home-trust-row" aria-label="Pulsercuit entry benefits">
              <span><Check /> Free to join</span>
              <span><Shield /> No purchase required</span>
              <span><Wallet /> {payoutAsset} payout through FaucetPay</span>
            </div>
          </div>

          <aside className="pc-home-core-stage pc-home-money-stage" aria-label="Current faucet reward">
            <div className="pc-home-capsule-art" aria-hidden="true">
              <RewardArtifact
                value={rewardDisplay}
                eyebrow="Reward"
                meta={intervalLabel(pulseInterval)}
                readout={false}
              />
            </div>
            <PulseCoreVisual
              state={publicLive ? "ready" : "limited"}
              eyebrow={rewardVariable ? (publicLive ? "Live reward range" : "Launch reward range") : "Current reward rule"}
              caption={rewardVariable ? `${publicLive ? "Variable draw" : "Prepared for launch"} · ${intervalLabel(pulseInterval)}` : `${payoutAsset} value · ${intervalLabel(pulseInterval)}`}
            >
              <span className="pulse-core-word pc-home-money-value">+{rewardDisplay}</span>
            </PulseCoreVisual>
            <div className="pc-home-core-status">
              <span><i className={publicLive ? "is-live" : "is-preparing"} /> {publicLive ? "Hourly reward available" : "Account access is open"}</span>
              <small>{rewardVariable ? (publicLive ? "Each eligible claim reveals one value from the live range." : "The launch reward range is prepared; public claiming is still closed.") : "The active reward rule is shown before every eligible claim."}</small>
            </div>
          </aside>
        </div>

        <div className="pc-v6-shell pc-home-value-strip" aria-label="Pulsercuit reward summary">
          <article>
            <small>{rewardVariable ? (publicLive ? "Live reward range" : "Launch reward range") : "Current reward rule"}</small>
            <strong>{rewardDisplay}</strong>
            <span>{rewardVariable ? (publicLive ? "one value is revealed per eligible claim" : "ready for public claiming when access opens") : "the active rule can change over time"}</span>
          </article>
          <article>
            <small>Return window</small>
            <strong>{intervalLabel(pulseInterval)}</strong>
            <span>after a successful claim</span>
          </article>
          <article>
            <small>Payout route</small>
            <strong>{payoutAsset}</strong>
            <span>through FaucetPay</span>
          </article>
          <article>
            <small>More earning paths</small>
            <strong>Optional</strong>
            <span>tasks, referrals and cashback when available</span>
          </article>
        </div>
      </section>

      <section className="pc-v6-section pc-home-section pc-home-loop" id="how">
        <div className="pc-v6-shell">
          <div className="pc-home-section-head">
            <div>
              <span className="pc-home-eyebrow">How it works</span>
              <h2>Claim. Earn more.<br />Cash out.</h2>
            </div>
            <p>Three plain steps. You should not need to learn our vocabulary before you understand the reward.</p>
          </div>

          <div className="pc-home-loop-grid">
            <article>
              <div className="pc-home-step-icon"><Spark /></div>
              <span>01</span>
              <h3>Claim the hourly reward</h3>
              <p>{rewardVariable
                ? "When your timer opens, claim and reveal one reward from the published live range."
                : "When your timer opens, the current reward rule is shown before you claim; it is not a permanent prize amount."}</p>
            </article>
            <article>
              <div className="pc-home-step-icon"><Clock /></div>
              <span>02</span>
              <h3>Add extra rewards</h3>
              <p>Between claims, choose optional tasks, partner rewards, cashback or referral activity when available.</p>
            </article>
            <article>
              <div className="pc-home-step-icon"><Wallet /></div>
              <span>03</span>
              <h3>Withdraw through FaucetPay</h3>
              <p>Your balance and payout distance stay visible so you always know what you have and what comes next.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-home-section pc-home-return">
        <div className="pc-v6-shell pc-home-return-grid">
          <div className="pc-home-return-copy">
            <span className="pc-home-eyebrow">More than one faucet claim</span>
            <h2>More reasons to earn. Fewer reasons to guess.</h2>
            <p>
              The hourly faucet is the entry point. The rest of Pulsercuit is designed to make repeat visits useful
              without forcing you through an ad wall before the core reward.
            </p>
            <Link className="pc-home-inline-link" href="/earn">Explore earning options <ArrowUpRight /></Link>
          </div>

          <div className="pc-home-return-visual">
            <EarnSpectrumArtwork />
            <div className="pc-home-return-board pc-home-benefit-board">
              <article><span>01</span><div><strong>Hourly faucet</strong><small>See the current reward value and your next eligible time.</small></div></article>
              <article><span>02</span><div><strong>Extra rewards</strong><small>Choose higher-value tasks and verified partner actions when they are available.</small></div></article>
              <article><span>03</span><div><strong>Referral rewards</strong><small>Invite people and see the active reward rule in plain money terms before you share.</small></div></article>
              <article><span>04</span><div><strong>Cashback and progress</strong><small>Verified cashback, milestones and account progress add value around the faucet.</small></div></article>
            </div>
          </div>
        </div>
      </section>

      <section className="pc-v6-section pc-home-section pc-home-live-section">
        <div className="pc-v6-shell">
          <div className="pc-home-section-head">
            <div>
              <span className="pc-home-eyebrow">Transparent by design</span>
              <h2>Real records.<br />No inflated counters.</h2>
            </div>
            <p>The public Proof Center separates credited rewards from completed payouts and keeps early-stage numbers honest.</p>
          </div>

          <div className="pc-home-live-grid pc-home-trust-grid">
            <div className="pc-home-activity-panel">
              <div className="pc-home-panel-head">
                <span><i /> Recent verified activity</span>
                <Link href="/proof">Open Proof Center <ArrowUpRight /></Link>
              </div>
              <V6RecentActivity initialProof={initialProof} />
            </div>

            <div className="pc-home-proof-card pc-home-proof-explainer">
              <span className="pc-home-eyebrow">What we show publicly</span>
              <div className="pc-home-proof-points">
                <article><Check /><div><strong>Recorded reward activity</strong><span>Only events that exist in production are counted.</span></div></article>
                <article><Wallet /><div><strong>Completed payouts</strong><span>Credited balance and paid withdrawals are kept separate.</span></div></article>
                <article><Shield /><div><strong>No decorative social proof</strong><span>Zero stays zero. Small numbers stay small while the network grows.</span></div></article>
              </div>
              <FunnelLink className="pc-home-proof-cta" href="/proof" eventLabel="home_hero_proof">
                Inspect live proof <ArrowUpRight />
              </FunnelLink>
            </div>
          </div>
        </div>
      </section>

      <section className="pc-v6-final pc-home-final">
        <div className="pc-home-final-glow" aria-hidden="true" />
        <div className="pc-v6-shell pc-home-final-grid">
          <div>
            <span className="pc-home-eyebrow">Start free</span>
            <h2>See every reward<br />in real value.</h2>
            <p>Create your account, check the current faucet reward, and decide which earning options are worth your time.</p>
          </div>
          <FunnelLink
            className="pc-v6-button primary pc-home-primary"
            href="/auth?mode=signup&next=/dashboard"
            eventLabel="home_final_signup"
          >
            Create free account <ArrowUpRight />
          </FunnelLink>
        </div>
      </section>

      <SiteFooter className="pc-home-footer" />
    </main>
  );
}
