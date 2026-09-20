"use client";

import { useEffect } from "react";

type Props = {
  event: "home_view" | "proof_view" | "signup_view";
};

export function FunnelBeacon({ event }: Props) {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const payload = {
      event,
      utmSource: query.get("utm_source"),
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
  }, [event]);

  return null;
}
