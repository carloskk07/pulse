import Image from "next/image";

export function RewardArtifact({
  value,
  eyebrow,
  meta,
  compact = false,
  readout = true,
}: {
  value: string;
  eyebrow: string;
  meta: string;
  compact?: boolean;
  readout?: boolean;
}) {
  return (
    <div className={"pc-artifact pc-artifact-reward" + (compact ? " is-compact" : "")}>
      <Image
        className="pc-artifact-image"
        src="/visual/reward-capsule.svg"
        alt=""
        width={800}
        height={800}
        sizes={compact ? "280px" : "(max-width: 760px) 88vw, 450px"}
      />
{readout ? (
        <div className="pc-artifact-readout">
          <small>{eyebrow}</small>
          <strong>{value}</strong>
          <span>{meta}</span>
        </div>
      ) : null}
      <span className="pc-artifact-tag tag-a" aria-hidden="true">01</span>
      <span className="pc-artifact-tag tag-b" aria-hidden="true">PULSE</span>
    </div>
  );
}

export function EarnSpectrumArtwork() {
  return (
    <div className="pc-artifact pc-artifact-spectrum" aria-hidden="true">
      <Image
        className="pc-artifact-image"
        src="/visual/earn-spectrum.svg"
        alt=""
        width={900}
        height={650}
        sizes="(max-width: 760px) 90vw, 520px"
      />
    </div>
  );
}

export function ReferralNetworkArtwork({
  active,
  waiting,
}: {
  active: number | string;
  waiting: number | string;
}) {
  return (
    <div className="pc-artifact pc-artifact-network">
      <Image
        className="pc-artifact-image"
        src="/visual/referral-network.svg"
        alt=""
        width={900}
        height={650}
        sizes="(max-width: 760px) 92vw, 520px"
      />
      <div className="pc-network-metric metric-active">
        <small>Active</small>
        <strong>{active}</strong>
      </div>
      <div className="pc-network-metric metric-waiting">
        <small>Waiting</small>
        <strong>{waiting}</strong>
      </div>
    </div>
  );
}

export function VaultProgressArtwork({
  percent,
  value,
}: {
  percent: number;
  value: string;
}) {
  return (
    <div className="pc-artifact pc-artifact-vault">
      <Image
        className="pc-artifact-image"
        src="/visual/vault-progress.svg"
        alt=""
        width={900}
        height={650}
        sizes="(max-width: 760px) 90vw, 440px"
      />
      <div className="pc-vault-visual-readout">
        <small>Payout progress</small>
        <strong>{percent}%</strong>
        <span>{value}</span>
      </div>
    </div>
  );
}
