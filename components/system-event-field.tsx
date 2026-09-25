"use client";

import { useEffect, useRef } from "react";

export type SystemEventKind =
  | "reward-settled"
  | "balance-increased"
  | "payout-ready"
  | "payout-complete"
  | "rank-up"
  | "referral-confirmed";

export type SystemEventCue = {
  id: string;
  kind: SystemEventKind;
  kicker: string;
  title: string;
  value?: string | null;
  detail?: string | null;
  markers?: string[];
};

const SEEN_KEY = "pc-system-event-seen:v1";
const MAX_SEEN = 24;
const VISIBLE_MS = 4200;

function readSeen() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(values: string[]) {
  try {
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify(values.slice(-MAX_SEEN)));
  } catch {
    // Presentation degrades gracefully when session storage is unavailable.
  }
}

export function SystemEventField({ cue }: { cue?: SystemEventCue | null }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cue?.id || !cue.kind) return;

    const root = rootRef.current;
    if (!root) return;

    const token = `${cue.kind}:${cue.id}`;
    const seen = readSeen();
    if (seen.includes(token)) {
      root.hidden = true;
      return;
    }

    writeSeen([...seen, token]);

    const frame = document.querySelector<HTMLElement>(".app-frame");
    frame?.setAttribute("data-system-event", cue.kind);
    root.hidden = false;
    root.classList.add("is-visible");

    const timer = window.setTimeout(() => {
      root.classList.remove("is-visible");
      root.hidden = true;
      if (frame?.dataset.systemEvent === cue.kind) {
        frame.removeAttribute("data-system-event");
      }
    }, VISIBLE_MS);

    return () => {
      window.clearTimeout(timer);
      root.classList.remove("is-visible");
      if (frame?.dataset.systemEvent === cue.kind) {
        frame.removeAttribute("data-system-event");
      }
    };
  }, [cue]);

  if (!cue) return null;

  return (
    <div
      ref={rootRef}
      className={`pc-system-event-field is-${cue.kind}`}
      data-system-event-cue={cue.kind}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="pc-system-event-wave wave-a" aria-hidden="true" />
      <span className="pc-system-event-wave wave-b" aria-hidden="true" />
      <div className="pc-system-event-card">
        <span className="pc-system-event-kicker">{cue.kicker}</span>
        <div className="pc-system-event-main">
          {cue.value ? <strong>{cue.value}</strong> : null}
          <span>{cue.title}</span>
        </div>
        {cue.detail ? <p>{cue.detail}</p> : null}
        {cue.markers?.length ? (
          <div className="pc-system-event-markers" aria-label="Event details">
            {cue.markers.slice(0, 3).map((marker) => <span key={marker}>{marker}</span>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
