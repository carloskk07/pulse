"use client";

import { useState } from "react";
import { copyTextToClipboard, isNativeShareAbort } from "@/lib/client-share";

type ShareState = "idle" | "copied" | "failed";

export function ShareRhythmButton({ days, signal }: { days: number; signal: number }) {
  const [state, setState] = useState<ShareState>("idle");

  function resetSoon() {
    window.setTimeout(() => setState("idle"), 1800);
  }

  async function share() {
    const url = new URL("/progress", window.location.origin).toString();
    const text = days > 0
      ? `${days}-day Pulsercuit rhythm · Signal ${signal}/100. Still climbing.`
      : `My Pulsercuit circuit is live · Signal ${signal}/100.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "My Pulsercuit moment", text, url });
        return;
      } catch (error) {
        if (isNativeShareAbort(error)) return;
      }
    }

    const copied = await copyTextToClipboard(`${text} ${url}`);
    setState(copied ? "copied" : "failed");
    resetSoon();
  }

  return <button className="pc-share-rhythm" type="button" onClick={share} aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy unavailable" : "Share moment"}</button>;
}
