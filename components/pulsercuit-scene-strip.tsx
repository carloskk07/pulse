export function PulsercuitSceneStrip() {
  return (
    <div className="pc-scene-strip" aria-label="Pulsercuit visual system">
      <figure className="pc-scene scene-pulse">
        <div className="pc-scene-art pulse-art" aria-hidden="true"><i className="ring ring-a"/><i className="ring ring-b"/><i className="pulse-line-art"/><i className="scene-core"/></div>
        <figcaption><small>Pulse window</small><strong>A visible moment to return.</strong><span>Clear state, rolling timing, no fake urgency.</span></figcaption>
      </figure>
      <figure className="pc-scene scene-signal">
        <div className="pc-scene-art signal-art" aria-hidden="true"><i className="signal-path"/><i className="signal-node n1"/><i className="signal-node n2"/><i className="signal-node n3"/><i className="signal-node n4"/><i className="signal-node n5"/></div>
        <figcaption><small>Circuit Signal</small><strong>Progress without pretending it is money.</strong><span>A non-financial score derived from real product history.</span></figcaption>
      </figure>
      <figure className="pc-scene scene-proof">
        <div className="pc-scene-art proof-art" aria-hidden="true"><i className="proof-sheet"/><i className="proof-row r1"/><i className="proof-row r2"/><i className="proof-row r3"/><i className="proof-check"/><i className="proof-lens"/></div>
        <figcaption><small>Proof lens</small><strong>Share evidence, not hype.</strong><span>Credited, paid and unavailable stay different facts.</span></figcaption>
      </figure>
    </div>
  );
}
