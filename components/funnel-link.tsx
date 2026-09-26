"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { getRouteLinkProps } from "@/lib/route-semantics";

type Props = Omit<ComponentProps<typeof Link>, "href" | "onClick"> & {
  href: string;
  eventLabel:
    | "header_signup"
    | "home_hero_signup"
    | "home_hero_proof"
    | "home_hero_faucet"
    | "home_pillar_signup"
    | "home_pillar_proof"
    | "home_chamber_signup"
    | "home_final_signup"
    | "proof_hero_signup"
    | "proof_metrics_signup"
    | "proof_final_signup"
    | "faucet_signup"
    | "faucet_proof";
};

export function FunnelLink({ href, eventLabel, children, ...props }: Props) {
  function recordIntent() {
    const query = new URLSearchParams(window.location.search);

    void fetch("/api/marketing/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        event: "cta_click",
        eventLabel,
        utmSource: query.get("utm_source"),
        utmMedium: query.get("utm_medium"),
        utmCampaign: query.get("utm_campaign"),
      }),
    }).catch(() => {
      // Intent telemetry must never block navigation.
    });
  }

  return <Link {...getRouteLinkProps("public", href)} onClick={recordIntent} {...props}>{children}</Link>;
}
