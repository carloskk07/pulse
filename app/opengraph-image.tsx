import { ImageResponse } from "next/og";

export const alt = "Pulsercuit — Return. Rise. Repeat.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#020404", color: "#f5f1e6", padding: "68px 78px", fontFamily: "serif", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 520, height: 520, borderRadius: 999, right: -35, top: -125, border: "1px solid rgba(241,210,125,.34)", boxShadow: "0 0 70px rgba(241,210,125,.20)", background: "radial-gradient(circle, rgba(8,10,8,.96) 0 34%, rgba(241,210,125,.26) 35%, rgba(216,255,95,.05) 42%, transparent 70%)" }} />
      <div style={{ position: "absolute", width: 720, height: 260, right: -100, bottom: -115, transform: "rotate(-7deg)", background: "linear-gradient(160deg, transparent 0 48%, #0c0d09 49% 100%)" }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15, fontSize: 28, fontWeight: 700, fontFamily: "sans-serif" }}>
          <div style={{ width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(241,210,125,.55)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(241,210,125,.18)" }}><div style={{ width: 9, height: 9, borderRadius: 99, background: "#f1d27d" }} /></div>
          <span>Pulsercuit</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 850 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 88, lineHeight: .9, letterSpacing: "-5px", fontWeight: 600 }}><span>Return.&nbsp;</span><span style={{ color: "#f1d27d" }}>Rise.</span><span>&nbsp;Repeat.</span></div>
          <div style={{ display: "flex", fontFamily: "sans-serif", fontSize: 22, color: "#b7b4aa", marginTop: 28 }}><span>Pulse. Momentum. Vault. Share.</span></div>
        </div>
        <div style={{ display: "flex", gap: 25, color: "#9a9b91", fontFamily: "sans-serif", fontSize: 16 }}><span>Funded Pulses</span><span>•</span><span>Visible progress</span><span>•</span><span>Verified proof</span></div>
      </div>
    </div>,
    size,
  );
}
