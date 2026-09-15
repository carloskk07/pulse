"use client";

import { useMemo, useState } from "react";

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

async function copyShareText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Some browsers expose Clipboard API but reject it outside a permitted context.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
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
        detail: `${normalizedPulses} funded Pulse${normalizedPulses === 1 ? "" : "s"} behind this mark.`,
        text: `Unlocked: ${achievement} on Pulsercuit. ${normalizedPulses} funded Pulse${normalizedPulses === 1 ? "" : "s"}. Built from real history.`,
      };
    }

    if (mode === "signal") {
      return {
        eyebrow: "Circuit rank",
        headline: stage,
        detail: `Signal ${normalizedSignal}/100 · real Pulse and Trust history.`,
        text: `My Pulsercuit rank is ${stage} — Signal ${normalizedSignal}/100. Built from real Pulse history.`,
      };
    }

    return {
      eyebrow: "Return rhythm",
      headline: normalizedDays > 0 ? `${normalizedDays}-day rhythm` : "Circuit started",
      detail: `${normalizedPulses} funded Pulse${normalizedPulses === 1 ? "" : "s"}. Still climbing.`,
      text: normalizedDays > 0
        ? `${normalizedDays}-day Pulsercuit rhythm. ${normalizedPulses} funded Pulse${normalizedPulses === 1 ? "" : "s"}. Still climbing.`
        : "My Pulsercuit circuit is live. Building momentum from real activity.",
    };
  }, [achievement, mode, normalizedDays, normalizedPulses, normalizedSignal, stage]);

  function resetStatusSoon() {
    window.setTimeout(() => setStatus("idle"), 1800);
  }

  async function share() {
    const url = typeof window === "undefined" ? "https://pulsercuit.pro/progress" : new URL("/progress", window.location.origin).toString();
    const shareText = `${moment.text} ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Pulsercuit moment", text: moment.text, url });
        setStatus("shared");
        resetStatusSoon();
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    const copied = await copyShareText(shareText);
    setStatus(copied ? "copied" : "failed");
    resetStatusSoon();
  }

  const options: { id: ShareMode; label: string; disabled?: boolean }[] = [
    { id: "rhythm", label: "Rhythm" },
    { id: "signal", label: "Rank" },
    { id: "achievement", label: "Seal", disabled: !achievement },
  ];

  return (
    <section className="pc-share-studio pc-luxe-share-studio" id="circuit-moments" aria-labelledby="share-studio-title">
      <div className="pc-share-studio-copy">
        <span className="app-eyebrow">Share studio</span>
        <h2 id="share-studio-title">Turn progress into a statement.</h2>
        <p>Pick one real moment. No balance. No fake flex.</p>
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
        <div className="pc-share-moment-brand"><span>Pulsercuit</span><small>moment / verified history</small></div>
        <div className="pc-share-moment-body">
          <small>{moment.eyebrow}</small>
          <strong>{moment.headline}</strong>
          <p>{moment.detail}</p>
        </div>
        <div className="pc-share-moment-foot">
          <span>Real history · private balance hidden</span>
          <button type="button" onClick={share} aria-live="polite">
            {status === "copied" ? "Copied" : status === "shared" ? "Shared" : status === "failed" ? "Copy unavailable" : "Share this moment"}
          </button>
        </div>
      </article>
    </section>
  );
}
