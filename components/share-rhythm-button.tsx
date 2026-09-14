"use client";

import { useState } from "react";

export function ShareRhythmButton({ days, signal }: { days: number; signal: number }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window === "undefined" ? "https://pulsercuit.pro" : window.location.origin;
    const text = days > 0
      ? `${days}-day Pulsercuit rhythm · Signal ${signal}/100. Still climbing.`
      : `My Pulsercuit circuit is live · Signal ${signal}/100.`;

    try {
      if (navigator.share) {
        await navigator.share({ title: "My Pulsercuit moment", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return <button className="pc-share-rhythm" type="button" onClick={share}>{copied ? "Copied" : "Share moment"}</button>;
}
