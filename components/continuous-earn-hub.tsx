import Link from "next/link";
import { ArrowUpRight, Check } from "@/components/icons";
import { getPulseEcosystemSnapshot } from "@/lib/pulse-ecosystem";

export async function ContinuousEarnHub() {
  const ecosystem = await getPulseEcosystemSnapshot();

  return (
    <>
      <section className="pc-v13-mission-section">
        <div className="app-section-head">
          <div>
            <span className="app-eyebrow">Today</span>
            <h2>Keep the circuit moving.</h2>
            <p>XP measures verified participation. It is not cash and never replaces your Vault balance.</p>
          </div>
          <strong className="pc-v13-rank-chip">{ecosystem.rank} · {ecosystem.xp} XP</strong>
        </div>

        <div className="pc-v13-rank-track" aria-label="Rank progress">
          <span style={{ width: ecosystem.rankProgress + "%" }} />
        </div>

        <div className="pc-v13-mission-grid">
          {ecosystem.missions.map((mission) => (
            <Link href={mission.href} className={"pc-v13-mission-card " + (mission.complete ? "done" : "")} key={mission.id}>
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
          <p>Eligible purchases can return part of confirmed partner commission to your Vault. Reversed purchases never become spendable rewards.</p>
          <div className="pc-v13-economy-metrics">
            <span><small>Pending</small><strong>{ecosystem.cashbackPendingCredits} P</strong></span>
            <span><small>Confirmed</small><strong>{ecosystem.cashbackConfirmedCredits} P</strong></span>
          </div>
        </article>

        <article className="pc-v13-economy-card">
          <span className="app-eyebrow">Network</span>
          <h2>{ecosystem.networkMembers > 0 ? ecosystem.networkMembers + " people across your first three levels." : "Your network starts with one real connection."}</h2>
          <p>Progress follows eligible activity, not recruitment alone. Network commissions can only come from real platform contribution.</p>
          <Link href="/invite" className="inline-action">Open Network <ArrowUpRight /></Link>
        </article>
      </section>
    </>
  );
}
