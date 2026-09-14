"use client";

import { useState } from "react";

export function ShareRhythmButton({ days, signal }: { days: number; signal: number }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window === "undefined" ? "https://pulsercuit.pro" : window.location.origin;
    const text = days > 0
      ? `I’m building a ${days}-day rhythm on Pulsercuit. Circuit Signal: ${signal}/100. Progress comes from real product history; Turbo stays optional.`
      : `I’m building my reward rhythm on Pulsercuit. Progress comes from real product history; Turbo stays optional.`;

    try {
      if (navigator.share) {
        await navigator.share({ title: "My Pulsercuit rhythm", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return <button className="pc-share-rhythm" type="button" onClick={share}>{copied ? "Copied" : "Share this rhythm"}</button>;
}
