import { Bolt, Check, Clock, Spark } from "./icons";
import { PulseOrb } from "./pulse-orb";

export function ProductPreview() {
  return (
    <div className="product-preview" aria-label="Illustrative Reward Pulse interface preview">
      <div className="preview-topbar"><span /><span /><span /></div>
      <div className="preview-grid">
        <div className="preview-main">
          <PulseOrb />
          <div className="preview-progress">
            <div className="preview-progress-head"><span>Interface preview</span><strong>Verified flow</strong></div>
            <div className="progress-track"><span style={{ width: "72%" }} /></div>
            <p><Spark /> Illustrative UI — no fabricated earnings</p>
          </div>
        </div>
        <div className="preview-feed">
          <div className="mini-label">Example states</div>
          <div className="activity-row"><span className="activity-icon"><Check /></span><div><strong>Confirmed</strong><small>Provider callback</small></div><time>server</time></div>
          <div className="activity-row"><span className="activity-icon"><Bolt /></span><div><strong>Available</strong><small>Ledger credit</small></div><time>ledger</time></div>
          <div className="activity-row"><span className="activity-icon"><Clock /></span><div><strong>Reserved</strong><small>Payout protection</small></div><time>safe</time></div>
        </div>
      </div>
    </div>
  );
}
