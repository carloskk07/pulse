import type { ReactNode } from "react";

type PulseCoreState = "paused" | "ready" | "charging" | "preview" | "limited";

export function PulseCoreVisual({
  state,
  children,
  eyebrow,
  caption,
}: {
  state: PulseCoreState;
  children: ReactNode;
  eyebrow: string;
  caption: string;
}) {
  return (
    <div className={`pulse-core-visual is-${state}`} data-state={state}>
      <div className="pulse-core-field" aria-hidden="true">
        <span className="pulse-core-field-glow" />
        <span className="pulse-core-horizon" />
        <span className="pulse-core-scan" />
        <span className="pulse-core-axis axis-x" />
        <span className="pulse-core-axis axis-y" />
      </div>
      <div className="pulse-core-orbit" aria-hidden="true">
        <span className="pulse-core-ring ring-one" />
        <span className="pulse-core-ring ring-two" />
        <span className="pulse-core-ring ring-three" />
        <span className="pulse-core-ring ring-four" />
        <span className="pulse-core-node node-one" />
        <span className="pulse-core-node node-two" />
        <span className="pulse-core-node node-three" />
        <span className="pulse-core-node node-four" />
        <span className="pulse-core-heart" />
      </div>
      <div className="pulse-core-readout">
        <small>{eyebrow}</small>
        <div className="pulse-core-value">{children}</div>
        <span>{caption}</span>
      </div>
    </div>
  );
}
