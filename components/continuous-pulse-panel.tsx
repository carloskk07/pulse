import Link from "next/link";
import { ArrowUpRight } from "@/components/icons";
import { getPulseEcosystemSnapshot } from "@/lib/pulse-ecosystem";
import { productRouteTransitionTypes } from "@/lib/product-route-navigation";

export async function ContinuousPulsePanel() {
  const ecosystem = await getPulseEcosystemSnapshot();

  return (
    <section className="pc-v13-continuous-panel">
      <div>
        <span className="app-eyebrow">Hourly faucet</span>
        <h2>Every hour can open another reward.</h2>
        <p>There is no artificial daily claim cap. Return when each hourly window opens and keep building your balance at your own pace.</p>
      </div>
      <div className="pc-v13-continuous-metrics">
        <span><small>Hourly windows</small><strong>24/day available</strong></span>
        <span><small>Today</small><strong>{ecosystem.claimsToday} claimed</strong></span>
        <span><small>Rank</small><strong>{ecosystem.rank}</strong></span>
        <span><small>XP</small><strong>{ecosystem.xp}</strong></span>
      </div>
      <div className="pc-v13-continuous-actions">
        <Link href="/earn" transitionTypes={productRouteTransitionTypes("home", "/earn")} className="button button-secondary">Explore extra rewards <ArrowUpRight /></Link>
        <Link href="/invite" transitionTypes={productRouteTransitionTypes("home", "/invite")} className="inline-action">Open referrals <ArrowUpRight /></Link>
      </div>
    </section>
  );
}
