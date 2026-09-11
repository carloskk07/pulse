export function PulseOrb({ value = "$4.82", label = "Ready to earn" }: { value?: string; label?: string }) {
  return (
    <div className="pulse-wrap" aria-label={`${value}, ${label}`}>
      <div className="pulse-aura pulse-aura-one" />
      <div className="pulse-aura pulse-aura-two" />
      <div className="pulse-orb">
        <span className="pulse-kicker">Your balance</span>
        <strong>{value}</strong>
        <span className="pulse-label">{label}</span>
      </div>
    </div>
  );
}
