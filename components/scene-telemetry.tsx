export type SceneTelemetryItem = {
  label: string;
  value: string;
  meta?: string;
};

export function SceneTelemetry({
  variant,
  status,
  items,
}: {
  variant: "reward" | "earn" | "wallet" | "progress" | "invite";
  status: string;
  items: [SceneTelemetryItem, SceneTelemetryItem, SceneTelemetryItem];
}) {
  return (
    <aside className={`pc-scene-telemetry pc-scene-telemetry-${variant}`} aria-label="Current product state">
      <div className="pc-scene-telemetry-orbit" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="pc-scene-telemetry-status">
        <small>Current</small>
        <strong>{status}</strong>
      </div>
      {items.map((item, index) => (
        <div className={`pc-scene-telemetry-item item-${index + 1}`} key={item.label}>
          <small>{item.label}</small>
          <strong>{item.value}</strong>
          {item.meta ? <span>{item.meta}</span> : null}
        </div>
      ))}
    </aside>
  );
}
