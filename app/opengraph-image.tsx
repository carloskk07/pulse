import { ImageResponse } from "next/og";

export const alt = "Reward Pulse — Your spare minutes have value";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#080a0f", color: "#f7f8fa", padding: "72px 82px", fontFamily: "sans-serif", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 540, height: 540, borderRadius: 999, right: -100, top: -140, background: "radial-gradient(circle, rgba(184,255,61,.24), rgba(61,232,255,.10) 45%, transparent 72%)" }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontWeight: 800 }}>
          <div style={{ width: 36, height: 36, borderRadius: 99, border: "8px solid #b8ff3d" }} />
          <span>Reward Pulse</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 830 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 76, lineHeight: .96, letterSpacing: "-4px", fontWeight: 850 }}>
            <span>Your spare minutes&nbsp;</span>
            <span style={{ color: "#b8ff3d" }}>have value.</span>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#9ba2af", marginTop: 28 }}>
            <span>Clear quests. Real progress. Transparent rewards.</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 28, color: "#747d8c", fontSize: 18 }}>
          <span>Free to join</span><span>•</span><span>No deposit required</span><span>•</span><span>Built for momentum</span>
        </div>
      </div>
    </div>,
    size,
  );
}
