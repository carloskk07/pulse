import { getPulseEcosystemSnapshot } from "@/lib/pulse-ecosystem";

export async function NetworkDepthPanel() {
  const ecosystem = await getPulseEcosystemSnapshot();

  return (
    <section className="pc-v13-network-panel">
      <div className="app-section-head">
        <div>
          <span className="app-eyebrow">Your network</span>
          <h2>Three levels. Real activity only.</h2>
          <p>The graph grows from verified connections. Activity, not recruitment by itself, is what can create economic value.</p>
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
        <span><small>Total network</small><strong>{ecosystem.networkMembers}</strong></span>
        <span><small>Active</small><strong>{ecosystem.networkActive}</strong></span>
        <span><small>Commission engine</small><strong>{ecosystem.networkCommissionEnabled ? "Live" : "Protected"}</strong></span>
      </div>
    </section>
  );
}
