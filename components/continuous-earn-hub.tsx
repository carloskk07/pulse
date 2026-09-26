import Link from "next/link";
import { ArrowUpRight, Check } from "@/components/icons";
import { getPulseEcosystemSnapshot } from "@/lib/pulse-ecosystem";
import { formatUsdFromCredits } from "@/lib/reward-state";
import { productRouteTransitionTypes } from "@/lib/product-route-navigation";

export async function ContinuousEarnHub() {
  const ecosystem = await getPulseEcosystemSnapshot();

  return (
    <>
      <section className="pc-v13-mission-section">
        <div className="app-section-head">
          <div>
            <span className="app-eyebrow">Today</span>
            <h2>Build progress while you earn.</h2>
            <p>XP tracks account progress and unlocks milestones. Your withdrawable reward balance stays separate.</p>
          </div>
          <strong className="pc-v13-rank-chip">{ecosystem.rank} · {ecosystem.xp} XP</strong>
        </div>

        <div className="pc-v13-rank-track" aria-label="Rank progress">
          <span style={{ width: ecosystem.rankProgress + "%" }} />
        </div>

        <div className="pc-v13-mission-grid">
          {ecosystem.missions.map((mission) => (
            <Link href={mission.href} transitionTypes={productRouteTransitionTypes("earn", mission.href)} className={"pc-v13-mission-card " + (mission.complete ? "done" : "")} key={mission.id}>
              <span className="pc-v13-mission-status">{mission.complete ? <Check /> : mission.current + "/" + mission.target}</span>
              <div>
                <strong>{mission.title}</strong>
                <p>{mission.detail}</p>
              </div>
              <ArrowUpRight />
            </Link>
          ))}
        </div>
      </section>

      <section className="pc-v13-economy-grid">
        <article className="pc-v13-economy-card">
          <span className="app-eyebrow">Cashback</span>
          <h2>{ecosystem.cashbackOffers > 0 ? ecosystem.cashbackOffers + " cashback route" + (ecosystem.cashbackOffers === 1 ? "" : "s") + " available." : "Cashback opens when a verified partner is live."}</h2>
          <p>When cashback is available, eligible partner purchases can return part of the confirmed value to your reward balance.</p>
          <div className="pc-v13-economy-metrics">
            <span><small>Pending</small><strong>{formatUsdFromCredits(ecosystem.cashbackPendingCredits)}</strong></span>
            <span><small>Confirmed</small><strong>{formatUsdFromCredits(ecosystem.cashbackConfirmedCredits)}</strong></span>
          </div>
        </article>

        <article className="pc-v13-economy-card">
          <span className="app-eyebrow">Referrals</span>
          <h2>{ecosystem.networkMembers > 0 ? ecosystem.networkMembers + " people across your first three referral levels." : "Your referral network starts with one active member."}</h2>
          <p>See your referral activity and any currently active reward rule before you share.</p>
          <Link href="/invite" transitionTypes={productRouteTransitionTypes("earn", "/invite")} className="inline-action">Open referrals <ArrowUpRight /></Link>
        </article>
      </section>
    </>
  );
}
