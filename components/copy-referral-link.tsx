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
        title: "Enter my Pulsercuit",
        text: "I’m building momentum on Pulsercuit. Join my circuit and make your returns count.",
        url: value,
      });
    } catch {
      // Native share can be dismissed without changing referral state.
    }
  }

  return <div className="referral-actions"><button type="button" onClick={share}>Share invite</button><button type="button" onClick={copy} aria-live="polite">{copied ? "Copied" : "Copy link"}</button></div>;
}
