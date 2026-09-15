"use client";

import { useEffect, useState } from "react";

function remainingMs(target: string | null) {
  if (!target) return 0;
  const value = new Date(target).getTime() - Date.now();
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "READY";
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function PulseCountdown({ target }: { target: string | null }) {
  const [remaining, setRemaining] = useState(() => remainingMs(target));

  useEffect(() => {
    setRemaining(remainingMs(target));
    const timer = window.setInterval(() => setRemaining(remainingMs(target)), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  const label = remaining <= 0 ? "Pulse ready" : `Pulse available in ${formatRemaining(remaining)}`;
  return <span className={remaining <= 0 ? "pulse-countdown ready" : "pulse-countdown"} role="timer" aria-label={label}>{formatRemaining(remaining)}</span>;
}
