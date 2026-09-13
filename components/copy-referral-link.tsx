"use client";

import { useState } from "react";

export function CopyReferralLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({
        title: "Join my Pulse",
        text: "I use Pulse for a recurring reward rhythm. The base Pulse is independent of optional Turbo offers.",
        url: value,
      });
    } catch {
      // The user may dismiss the native share sheet. No fallback is needed.
    }
  }

  return <div className="referral-actions"><button type="button" onClick={share}>Share</button><button type="button" onClick={copy} aria-live="polite">{copied ? "Copied" : "Copy"}</button></div>;
}
