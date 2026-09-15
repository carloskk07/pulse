"use client";

import { useState } from "react";
import { copyTextToClipboard, isNativeShareAbort } from "@/lib/client-share";

type CopyState = "idle" | "copied" | "failed";

export function CopyReferralLink({ value }: { value: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  function resetSoon() {
    window.setTimeout(() => setCopyState("idle"), 1800);
  }

  async function copy() {
    const copied = await copyTextToClipboard(value);
    setCopyState(copied ? "copied" : "failed");
    resetSoon();
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Enter my Pulsercuit",
          text: "I’m building momentum on Pulsercuit. Join my circuit and make your returns count.",
          url: value,
        });
        return;
      } catch (error) {
        if (isNativeShareAbort(error)) return;
      }
    }
    await copy();
  }

  return <div className="referral-actions"><button type="button" onClick={share}>Share invite</button><button type="button" onClick={copy} aria-live="polite">{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy unavailable" : "Copy link"}</button></div>;
}
