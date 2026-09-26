import { ViewTransition } from "react";

const sceneMeta: Record<string, { index: string; label: string; secondary: string }> = {
  home: { index: "01", label: "REWARD FIELD", secondary: "VALUE / TIME" },
  progress: { index: "02", label: "PROGRESS FIELD", secondary: "RANK / MOMENTUM" },
  earn: { index: "03", label: "EARNING FIELD", secondary: "VALUE / ROUTES" },
  wallet: { index: "04", label: "PAYOUT FIELD", secondary: "BALANCE / RELEASE" },
  invite: { index: "05", label: "NETWORK FIELD", secondary: "REFERRALS / REACH" },
};

export function SpatialAtmosphere({ active }: { active: string }) {
  const meta = sceneMeta[active];
  if (!meta) return null;

  return (
    <div className="pc-spatial-atmosphere" data-scene={active} aria-hidden="true">
      <div className="pc-space-grid" />
      <div className="pc-space-base-layer">
        <div className="pc-space-haze haze-b" />
        <div className="pc-space-plane plane-b" />
        <div className="pc-space-plane plane-c" />
      </div>

      <div className="pc-space-semantic-layer pc-field-value-layer">
        <div className="pc-space-haze haze-a" />
        <div className="pc-space-plane plane-a" />
      </div>

      <div className="pc-space-semantic-layer pc-field-signal-layer">
        <ViewTransition
          key={`orbit-${active}`}
          name="pc-route-orbit"
          default="none"
          update={{ default: "pc-route-orbit-share", "pc-forward": "pc-route-orbit-forward", "pc-back": "pc-route-orbit-back" }}
          share={{ default: "pc-route-orbit-share", "pc-forward": "pc-route-orbit-forward", "pc-back": "pc-route-orbit-back" }}
        >
          <div className="pc-space-orbit orbit-a" />
        </ViewTransition>
        <div className="pc-space-beam beam-a" />
      </div>

      <div className="pc-space-semantic-layer pc-field-network-layer">
        <div className="pc-space-orbit orbit-b" />
        <div className="pc-space-beam beam-b" />
        <span className="pc-space-node node-a" />
        <span className="pc-space-node node-b" />
        <span className="pc-space-node node-c" />
      </div>

      <ViewTransition
        key={`carrier-${active}`}
        name="pc-route-carrier"
        default="none"
        update={{ default: "pc-route-carrier-share", "pc-forward": "pc-route-carrier-forward", "pc-back": "pc-route-carrier-back" }}
        share={{ default: "pc-route-carrier-share", "pc-forward": "pc-route-carrier-forward", "pc-back": "pc-route-carrier-back" }}
      >
        <div className="pc-route-carrier"><i /><b /></div>
      </ViewTransition>

      <ViewTransition
        key={`index-${active}`}
        name="pc-route-index"
        default="none"
        update={{ default: "pc-route-index-share", "pc-forward": "pc-route-index-forward", "pc-back": "pc-route-index-back" }}
        share={{ default: "pc-route-index-share", "pc-forward": "pc-route-index-forward", "pc-back": "pc-route-index-back" }}
      >
        <span className="pc-space-datum datum-a">{meta.index}</span>
      </ViewTransition>
      <span className="pc-space-datum datum-b">{meta.label}</span>
      <span className="pc-space-datum datum-c">{meta.secondary}</span>
    </div>
  );
}
