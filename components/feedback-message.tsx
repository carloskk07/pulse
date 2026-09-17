import type { ReactNode } from "react";

export type FeedbackTone = "success" | "neutral" | "error";

export function FeedbackMessage({ tone, children }: { tone: FeedbackTone; children: ReactNode }) {
  return <div className={`claim-message ${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
