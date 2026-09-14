import { Bolt, Check, Clock, Shield, Spark } from "./icons";

export function ProductPreview() {
  return (
    <div className="product-preview" aria-label="Illustrative Pulsercuit interface preview">
      <div className="preview-topbar"><span /><span /><span /></div>
      <div className="preview-grid">
        <div className="preview-main">
          <article className="preview-drop">
            <div className="preview-drop-top">
              <span className="status-pill status-lime"><Spark /> Pulse</span>
              <div className="preview-value"><small>Reward rail</small><strong>Treasury gated</strong></div>
            </div>
            <div>
              <div className="pulse-line protected">Pulsercuit protected</div>
              <h3>Return. Pulse. Build your rhythm.</h3>
              <p>Claim when eligible, come back on the rolling timer and use Turbo only when extra earning is worth it.</p>
            </div>
            <div className="preview-drop-bottom">
              <span className="preview-protect"><Shield /> Budget required</span>
              <span className="preview-time">No simulated amount</span>
            </div>
          </article>
          <div className="preview-progress">
            <div className="preview-progress-head"><span>Circuit progress</span><strong>Rolling rhythm</strong></div>
            <div className="progress-track"><span style={{ width: "72%" }} /></div>
            <p><Spark /> Illustrative UI — live state appears after sign-in</p>
          </div>
        </div>
        <div className="preview-feed">
          <div className="mini-label">Your circuit</div>
          <div className="activity-row"><span className="activity-icon"><Check /></span><div><strong>Pulse</strong><small>Eligible + funded</small></div><time>base</time></div>
          <div className="activity-row"><span className="activity-icon"><Clock /></span><div><strong>Return</strong><small>Rolling eligibility</small></div><time>rhythm</time></div>
          <div className="activity-row"><span className="activity-icon"><Bolt /></span><div><strong>Turbo</strong><small>Optional extra reward</small></div><time>choice</time></div>
        </div>
      </div>
    </div>
  );
}
