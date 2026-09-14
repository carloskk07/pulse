"use client";

import { useMemo, useState } from "react";

type ShareMode = "rhythm" | "signal" | "achievement";

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
  const [status, setStatus] = useState<"idle" | "copied" | "shared">("idle");

  const moment = useMemo(() => {
    if (mode === "achievement" && achievement) {
      return {
        eyebrow: "Verified milestone",
        headline: achievement,
        detail: `${normalizedPulses} funded Pulse${normalizedPulses === 1 ? "" : "s"} in my real product history.`,
        text: `I unlocked “${achievement}” on Pulsercuit from real product history. ${normalizedPulses} funded Pulse${normalizedPulses === 1 ? "" : "s"}; no balance or payout data is exposed.`,
      };
    }

    if (mode === "signal") {
      return {
        eyebrow: "Circuit Signal",
        headline: `${normalizedSignal}/100 · ${stage}`,
        detail: "A display-only progress score built from real Pulse rhythm and Trust history.",
        text: `My Pulsercuit Circuit Signal is ${normalizedSignal}/100 (${stage}). It is display-only progress derived from real product history, not money.`,
      };
    }

    return {
      eyebrow: "Return rhythm",
      headline: normalizedDays > 0 ? `${normalizedDays}-day circuit` : "Circuit started",
      detail: `${normalizedPulses} funded Pulse${normalizedPulses === 1 ? "" : "s"} recorded without exposing balances.`,
      text: normalizedDays > 0
        ? `I’m building a ${normalizedDays}-day rhythm on Pulsercuit with ${normalizedPulses} funded Pulse${normalizedPulses === 1 ? "" : "s"}. Progress is factual; Turbo stays optional.`
        : `I’m building my Pulsercuit rhythm. Progress comes from real product history; Turbo stays optional.`,
    };
  }, [achievement, mode, normalizedDays, normalizedPulses, normalizedSignal, stage]);

  async function share() {
    const url = typeof window === "undefined" ? "https://pulsercuit.pro" : window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Pulsercuit moment", text: moment.text, url });
        setStatus("shared");
      } else {
        await navigator.clipboard.writeText(`${moment.text} ${url}`);
        setStatus("copied");
      }
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("idle");
    }
  }

  const options: { id: ShareMode; label: string; disabled?: boolean }[] = [
    { id: "rhythm", label: "Rhythm" },
    { id: "signal", label: "Signal" },
    { id: "achievement", label: "Milestone", disabled: !achievement },
  ];

  return (
    <section className="pc-share-studio" aria-labelledby="share-studio-title">
      <div className="pc-share-studio-copy">
        <span className="app-eyebrow">V4.3 · Circuit moments</span>
        <h2 id="share-studio-title">Share proof of progress, not private money.</h2>
        <p>Choose a factual moment generated from your own history. Pulsercuit never adds a balance, payout claim or invented activity to the card.</p>
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

      <article className={`pc-share-moment-card mode-${mode}`}>
        <div className="pc-share-moment-orbit" aria-hidden="true"><i /><i /><i /></div>
        <div className="pc-share-moment-brand"><span>Pulsercuit</span><small>verified personal moment</small></div>
        <div className="pc-share-moment-body">
          <small>{moment.eyebrow}</small>
          <strong>{moment.headline}</strong>
          <p>{moment.detail}</p>
        </div>
        <div className="pc-share-moment-foot">
          <span>No balance shown · factual history only</span>
          <button type="button" onClick={share} aria-live="polite">
            {status === "copied" ? "Copied" : status === "shared" ? "Shared" : "Share moment"}
          </button>
        </div>
      </article>
    </section>
  );
}
