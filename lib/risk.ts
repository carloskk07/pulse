export type RiskBand = "normal" | "observe" | "hold" | "review";

export function riskBand(score: number): RiskBand {
  if (score >= 80) return "review";
  if (score >= 60) return "hold";
  if (score >= 40) return "observe";
  return "normal";
}
