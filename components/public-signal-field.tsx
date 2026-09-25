type PublicSignalVariant = "auth" | "business" | "ads";

const signalMeta: Record<PublicSignalVariant, { a: string; b: string; c: string }> = {
  auth: { a: "ACCOUNT", b: "CONTINUITY", c: "PROOF" },
  business: { a: "OUTCOME", b: "PREFUND", c: "VERIFY" },
  ads: { a: "AUDIENCE", b: "PREPAID", c: "QUALIFIED" },
};

export function PublicSignalField({ variant }: { variant: PublicSignalVariant }) {
  const meta = signalMeta[variant];

  return (
    <div className={`pc-public-signal-field is-${variant}`} aria-hidden="true">
      <div className="pc-public-signal-grid" />
      <div className="pc-public-signal-orbit orbit-a" />
      <div className="pc-public-signal-orbit orbit-b" />
      <div className="pc-public-signal-carrier"><i /><b /></div>
      <div className="pc-public-signal-beam" />
      <span className="pc-public-signal-node node-a" />
      <span className="pc-public-signal-node node-b" />
      <span className="pc-public-signal-node node-c" />
      <span className="pc-public-signal-label label-a">{meta.a}</span>
      <span className="pc-public-signal-label label-b">{meta.b}</span>
      <span className="pc-public-signal-label label-c">{meta.c}</span>
    </div>
  );
}
