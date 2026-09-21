"use client";

import { useState } from "react";
import { ArrowUpRight } from "@/components/icons";

type DirectStartPayload = {
  status?: unknown;
  destination?: unknown;
};

function failureUrl(status: string, sourcePulseClaimId?: string | null) {
  const params = new URLSearchParams({ direct: status || "unavailable" });
  if (sourcePulseClaimId) params.set("claim", sourcePulseClaimId);
  return "/earn?" + params.toString();
}

export function DirectStartButton({
  campaignId,
  sourcePulseClaimId,
  compact = false,
  label = "Start extra reward",
  ariaLabel,
}: {
  campaignId: string;
  sourcePulseClaimId?: string | null;
  compact?: boolean;
  label?: string;
  ariaLabel?: string;
}) {
  const [state, setState] = useState<"idle" | "opening">("idle");

  async function start() {
    if (state === "opening") return;
    setState("opening");

    const form = new FormData();
    form.set("campaign", campaignId);
    if (sourcePulseClaimId) form.set("source_pulse_claim_id", sourcePulseClaimId);

    try {
      const response = await fetch("/api/direct/start", {
        method: "POST",
        body: form,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json() as DirectStartPayload;
      const status = typeof payload.status === "string" ? payload.status : "unavailable";

      if (response.status === 401) {
        window.location.assign("/auth?next=/earn");
        return;
      }

      if (!response.ok || typeof payload.destination !== "string") {
        window.location.assign(failureUrl(status, sourcePulseClaimId));
        return;
      }

      const target = new URL(payload.destination);
      if (target.protocol !== "https:") {
        window.location.assign(failureUrl("destination-error", sourcePulseClaimId));
        return;
      }

      window.location.assign(target.toString());
    } catch {
      window.location.assign(failureUrl("unavailable", sourcePulseClaimId));
    }
  }

  return (
    <button
      className={compact ? "direct-row-action" : "button button-light direct-primary-action"}
      type="button"
      onClick={start}
      disabled={state === "opening"}
      aria-busy={state === "opening"}
      aria-label={ariaLabel}
    >
      {state === "opening" ? "Opening…" : label} <ArrowUpRight />
    </button>
  );
}
