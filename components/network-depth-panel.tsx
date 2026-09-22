import { getPulseEcosystemSnapshot } from "@/lib/pulse-ecosystem";

export async function NetworkDepthPanel() {
  const ecosystem = await getPulseEcosystemSnapshot();

  return (
    <section className="pc-v13-network-panel">
      <div className="app-section-head">
        <div>
          <span className="app-eyebrow">Referral network</span>
          <h2>Three levels of referral activity.</h2>
          <p>See how many referred members are active at each level. Monetary rewards apply only when the displayed referral rule is active.</p>
        </div>
        <strong className="pc-v13-rank-chip">{ecosystem.rank} · {ecosystem.xp} XP</strong>
      </div>

      <div className="pc-v13-network-grid">
        {ecosystem.network.map((row) => (
          <article key={row.level}>
            <small>Level {row.level}</small>
            <strong>{row.members}</strong>
            <span>{row.active} active</span>
          </article>
        ))}
      </div>

      <div className="pc-v13-network-summary">
        <span><small>Total referrals</small><strong>{ecosystem.networkMembers}</strong></span>
        <span><small>Active</small><strong>{ecosystem.networkActive}</strong></span>
        <span><small>Referral rewards</small><strong>{ecosystem.networkCommissionEnabled ? "Active" : "No active bonus"}</strong></span>
      </div>
    </section>
  );
}
