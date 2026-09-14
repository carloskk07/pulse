import { ImageResponse } from "next/og";

export const alt = "Pulsercuit — Return. Pulse. Repeat.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#040609", color: "#f8fbff", padding: "72px 82px", fontFamily: "sans-serif", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: 999, right: -120, top: -160, background: "radial-gradient(circle, rgba(207,255,103,.20), rgba(114,243,255,.07) 45%, transparent 72%)" }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 850 }}>
          <div style={{ width: 38, height: 38, borderRadius: 99, border: "1px solid rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 10, height: 10, borderRadius: 99, background: "#cfff67" }} /></div>
          <span>Pulsercuit</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 84, lineHeight: .9, letterSpacing: "-5px", fontWeight: 880 }}><span>Return. Pulse.&nbsp;</span><span style={{ color: "#cfff67" }}>Repeat.</span></div>
          <div style={{ display: "flex", fontSize: 23, color: "#96a1af", marginTop: 30 }}><span>A new rhythm for recurring rewards.</span></div>
        </div>
        <div style={{ display: "flex", gap: 28, color: "#6f7b8a", fontSize: 17 }}><span>Pulse</span><span>•</span><span>Trust</span><span>•</span><span>Proof</span><span>•</span><span>Turbo</span></div>
      </div>
    </div>,
    size,
  );
}
