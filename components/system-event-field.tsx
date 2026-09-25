"use client";

import { useEffect, useState } from "react";

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
    // The cue remains correct even when session storage is unavailable.
  }
}

export function SystemEventField({ cue }: { cue?: SystemEventCue | null }) {
  const [activeCue, setActiveCue] = useState<SystemEventCue | null>(null);

  useEffect(() => {
    if (!cue?.id || !cue.kind) return;

    const token = `${cue.kind}:${cue.id}`;
    const seen = readSeen();
    if (seen.includes(token)) return;

    writeSeen([...seen, token]);

    const frame = document.querySelector<HTMLElement>(".app-frame");
    frame?.setAttribute("data-system-event", cue.kind);
    setActiveCue(cue);

    const timer = window.setTimeout(() => {
      setActiveCue(null);
      if (frame?.dataset.systemEvent === cue.kind) {
        frame.removeAttribute("data-system-event");
      }
    }, VISIBLE_MS);

    return () => {
      window.clearTimeout(timer);
      if (frame?.dataset.systemEvent === cue.kind) {
        frame.removeAttribute("data-system-event");
      }
    };
  }, [cue]);

  if (!activeCue) return null;

  return (
    <div
      className={`pc-system-event-field is-${activeCue.kind}`}
      data-system-event-cue={activeCue.kind}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="pc-system-event-wave wave-a" aria-hidden="true" />
      <span className="pc-system-event-wave wave-b" aria-hidden="true" />
      <div className="pc-system-event-card">
        <span className="pc-system-event-kicker">{activeCue.kicker}</span>
        <div className="pc-system-event-main">
          {activeCue.value ? <strong>{activeCue.value}</strong> : null}
          <span>{activeCue.title}</span>
        </div>
        {activeCue.detail ? <p>{activeCue.detail}</p> : null}
        {activeCue.markers?.length ? (
          <div className="pc-system-event-markers" aria-label="Event details">
            {activeCue.markers.slice(0, 3).map((marker) => <span key={marker}>{marker}</span>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
