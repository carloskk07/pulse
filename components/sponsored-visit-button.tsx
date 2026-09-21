"use client";

import { useState } from "react";
import { ArrowUpRight } from "@/components/icons";

type SponsoredClickPayload = {
  destination?: unknown;
};

export function SponsoredVisitButton({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<"idle" | "opening" | "error">("idle");

  async function openSponsor() {
    if (state === "opening") return;
    setState("opening");

    const form = new FormData();
    form.set("campaign", campaignId);

    try {
      const response = await fetch("/api/ads/click", {
        method: "POST",
        body: form,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json() as SponsoredClickPayload;
      if (!response.ok || typeof payload.destination !== "string") {
        throw new Error("sponsored_click_failed");
      }

      const target = new URL(payload.destination);
      if (target.protocol !== "https:") {
        throw new Error("sponsored_destination_invalid");
      }

      window.location.assign(target.toString());
    } catch {
      setState("error");
    }
  }

  const label = state === "opening"
    ? "Opening sponsor…"
    : state === "error"
      ? "Try sponsor again"
      : "Visit sponsor";

  return (
    <button
      className="button button-secondary"
      type="button"
      onClick={openSponsor}
      disabled={state === "opening"}
      aria-busy={state === "opening"}
    >
      {label} <ArrowUpRight />
    </button>
  );
}
