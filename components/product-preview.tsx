import { Bolt, Check, Clock, Shield, Spark } from "./icons";

export function ProductPreview() {
  return (
    <div className="product-preview" aria-label="Illustrative Reward Pulse interface preview">
      <div className="preview-topbar"><span /><span /><span /></div>
      <div className="preview-grid">
        <div className="preview-main">
          <article className="preview-drop">
            <div className="preview-drop-top">
              <span className="status-pill status-lime"><Spark /> Reward Drop</span>
              <div className="preview-value"><small>Reward</small><strong>Live value</strong></div>
            </div>
            <div>
              <div className="pulse-line protected">Pulse protected</div>
              <h3>The best opportunity should feel obvious.</h3>
              <p>Reward, time, eligibility and settlement confidence belong in one clear decision.</p>
            </div>
            <div className="preview-drop-bottom">
              <span className="preview-protect"><Shield /> Verified flow</span>
              <span className="preview-time">Live inventory after sign-in</span>
            </div>
          </article>
          <div className="preview-progress">
            <div className="preview-progress-head"><span>Interface preview</span><strong>Truthful by design</strong></div>
            <div className="progress-track"><span style={{ width: "72%" }} /></div>
            <p><Spark /> Illustrative UI — no fabricated earnings</p>
          </div>
        </div>
        <div className="preview-feed">
          <div className="mini-label">Reward lifecycle</div>
          <div className="activity-row"><span className="activity-icon"><Bolt /></span><div><strong>Matched</strong><small>Eligible opportunity</small></div><time>live</time></div>
          <div className="activity-row"><span className="activity-icon"><Check /></span><div><strong>Verified</strong><small>Authoritative event</small></div><time>server</time></div>
          <div className="activity-row"><span className="activity-icon"><Clock /></span><div><strong>Settled</strong><small>Ledger protected</small></div><time>safe</time></div>
        </div>
      </div>
    </div>
  );
}
