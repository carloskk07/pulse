"use client";

import { useEffect } from "react";

type Props = {
  event: "home_view" | "proof_view" | "signup_view";
  sourceOverride?: string;
};

export function FunnelBeacon({ event, sourceOverride }: Props) {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const payload = {
      event,
      utmSource: sourceOverride ?? query.get("utm_source"),
      utmMedium: query.get("utm_medium"),
      utmCampaign: query.get("utm_campaign"),
    };

    void fetch("/api/marketing/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify(payload),
    }).catch(() => {
      // Acquisition telemetry is intentionally non-blocking.
    });
  }, [event, sourceOverride]);

  return null;
}
