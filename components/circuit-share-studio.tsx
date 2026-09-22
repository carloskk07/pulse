"use client";

import { useMemo, useState } from "react";
import { copyTextToClipboard, isNativeShareAbort } from "@/lib/client-share";

type ShareMode = "rhythm" | "signal" | "achievement";
type ShareStatus = "idle" | "copied" | "shared" | "failed";

type Props = {
  days: number;
  signal: number;
  stage: string;
  pulseCount: number;
  achievement?: string | null;
};

function safeInt(value: number, max = 9999) {
  return Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
}

export function CircuitShareStudio({ days, signal, stage, pulseCount, achievement }: Props) {
  const normalizedDays = safeInt(days, 366);
  const normalizedSignal = safeInt(signal, 100);
  const normalizedPulses = safeInt(pulseCount, 999999);
  const [mode, setMode] = useState<ShareMode>(achievement ? "achievement" : normalizedDays > 0 ? "rhythm" : "signal");
  const [status, setStatus] = useState<ShareStatus>("idle");

  const moment = useMemo(() => {
    if (mode === "achievement" && achievement) {
      return {
        eyebrow: "Milestone unlocked",
        headline: achievement,
        detail: `${normalizedPulses} verified claim${normalizedPulses === 1 ? "" : "s"} behind this milestone.`,
        text: `Unlocked: ${achievement} on Pulsercuit after ${normalizedPulses} verified claim${normalizedPulses === 1 ? "" : "s"}.`,
      };
    }

    if (mode === "signal") {
      return {
        eyebrow: "Circuit rank",
        headline: stage,
        detail: `Progress ${normalizedSignal}/100 · based on verified account history.`,
        text: `My Pulsercuit rank is ${stage} — progress ${normalizedSignal}/100 from verified activity.`,
      };
    }

    return {
      eyebrow: "Return streak",
      headline: normalizedDays > 0 ? `${normalizedDays}-day streak` : "Progress started",
      detail: `${normalizedPulses} verified claim${normalizedPulses === 1 ? "" : "s"}.`,
      text: normalizedDays > 0
        ? `${normalizedDays}-day Pulsercuit return streak with ${normalizedPulses} verified claim${normalizedPulses === 1 ? "" : "s"}.`
        : "My Pulsercuit progress has started with verified activity.",
    };
  }, [achievement, mode, normalizedDays, normalizedPulses, normalizedSignal, stage]);

  function resetStatusSoon() {
    window.setTimeout(() => setStatus("idle"), 1800);
  }

  async function share() {
    const url = new URL("/progress", window.location.origin).toString();
    const shareText = `${moment.text} ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Pulsercuit moment", text: moment.text, url });
        setStatus("shared");
        resetStatusSoon();
        return;
      } catch (error) {
        if (isNativeShareAbort(error)) return;
      }
    }

    const copied = await copyTextToClipboard(shareText);
    setStatus(copied ? "copied" : "failed");
    resetStatusSoon();
  }

  const options: { id: ShareMode; label: string; disabled?: boolean }[] = [
    { id: "rhythm", label: "Streak" },
    { id: "signal", label: "Rank" },
    { id: "achievement", label: "Milestone", disabled: !achievement },
  ];

  return (
    <section className="pc-share-studio pc-luxe-share-studio" id="circuit-moments" aria-labelledby="share-studio-title">
      <div className="pc-share-studio-copy">
        <span className="app-eyebrow">Share studio</span>
        <h2 id="share-studio-title">Share a real milestone.</h2>
        <p>Share a rank, streak or milestone without exposing your balance.</p>
        <div className="pc-share-mode-row" role="group" aria-label="Choose a share moment">
          {options.map((option) => (
            <button
              className={mode === option.id ? "active" : ""}
              disabled={option.disabled}
              key={option.id}
              onClick={() => setMode(option.id)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <article className={`pc-share-moment-card pc-luxe-moment-card mode-${mode}`}>
        <div className="pc-share-moment-orbit" aria-hidden="true"><i /><i /><i /></div>
        <div className="pc-share-moment-brand"><span>Pulsercuit</span><small>progress / verified history</small></div>
        <div className="pc-share-moment-body">
          <small>{moment.eyebrow}</small>
          <strong>{moment.headline}</strong>
          <p>{moment.detail}</p>
        </div>
        <div className="pc-share-moment-foot">
          <span>Verified history · balance hidden</span>
          <button type="button" onClick={share} aria-live="polite">
            {status === "copied" ? "Copied" : status === "shared" ? "Shared" : status === "failed" ? "Copy unavailable" : "Share this moment"}
          </button>
        </div>
      </article>
    </section>
  );
}
