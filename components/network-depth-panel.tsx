import { getPulseEcosystemSnapshot } from "@/lib/pulse-ecosystem";

export async function NetworkDepthPanel() {
  const ecosystem = await getPulseEcosystemSnapshot();

  return (
    <section className="pc-v13-network-panel">
      <div className="app-section-head">
        <div>
          <span className="app-eyebrow">Referral network</span>
          <h2>Three levels. Three reward rates.</h2>
          <p>When network rewards are active, eligible verified partner activity can reward all three levels from remaining partner margin after the member&apos;s own reward.</p>
        </div>
        <strong className="pc-v13-rank-chip">{ecosystem.rank} · {ecosystem.xp} XP</strong>
      </div>

      <div className="pc-v13-network-grid">
        {ecosystem.network.map((row) => (
          <article key={row.level}>
            <small>Level {row.level}</small>
            <strong>{row.members}</strong>
            <span>{row.active} active</span>
            <b>{ecosystem.networkCommissionEnabled ? `${row.commissionBps / 100}% reward rate` : "Reward rate inactive"}</b>
          </article>
        ))}
      </div>

      <div className="pc-v13-network-summary">
        <span><small>Total referrals</small><strong>{ecosystem.networkMembers}</strong></span>
        <span><small>Active</small><strong>{ecosystem.networkActive}</strong></span>
        <span><small>Network rewards</small><strong>{ecosystem.networkCommissionEnabled ? "10% · 3% · 1%" : "Inactive"}</strong></span>
      </div>
    </section>
  );
}
