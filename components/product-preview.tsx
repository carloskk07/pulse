import { Bolt, Check, Clock, Spark } from "./icons";
import { PulseOrb } from "./pulse-orb";

export function ProductPreview() {
  return (
    <div className="product-preview" aria-label="Reward Pulse product preview">
      <div className="preview-topbar"><span /><span /><span /></div>
      <div className="preview-grid">
        <div className="preview-main">
          <PulseOrb />
          <div className="preview-progress">
            <div className="preview-progress-head"><span>Today&apos;s pulse</span><strong>82%</strong></div>
            <div className="progress-track"><span style={{ width: "82%" }} /></div>
            <p><Spark /> $1.18 until your next withdrawal</p>
          </div>
        </div>
        <div className="preview-feed">
          <div className="mini-label">Live activity</div>
          <div className="activity-row"><span className="activity-icon"><Check /></span><div><strong>+$0.74</strong><small>Starter quest</small></div><time>now</time></div>
          <div className="activity-row"><span className="activity-icon"><Bolt /></span><div><strong>+$1.20</strong><small>App quest</small></div><time>8m</time></div>
          <div className="activity-row"><span className="activity-icon"><Clock /></span><div><strong>+$0.42</strong><small>Quick survey</small></div><time>4m</time></div>
        </div>
      </div>
    </div>
  );
}
