"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function remainingMs(target: string | null, now: number) {
  if (!target) return 0;
  const value = new Date(target).getTime() - now;
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
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const refreshedTarget = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = remainingMs(target, now);

  useEffect(() => {
    if (!target || remaining > 0 || refreshedTarget.current === target) return;

    refreshedTarget.current = target;
    const timer = window.setTimeout(() => router.refresh(), 1250);
    return () => window.clearTimeout(timer);
  }, [remaining, router, target]);

  const label = remaining <= 0 ? "Pulse ready" : `Pulse available in ${formatRemaining(remaining)}`;
  return <span className={remaining <= 0 ? "pulse-countdown ready" : "pulse-countdown"} role="timer" aria-label={label}>{formatRemaining(remaining)}</span>;
}
