"use client";

import { useEffect, useState } from "react";
import { Check, Shield, Spark, Trend } from "@/components/icons";
import type { PublicSocialProof } from "@/lib/social-proof";

const EMPTY_PROOF: PublicSocialProof = {
  stage: "early",
  memberCount: 0,
  rewardEventCount: 0,
  paidWithdrawalCount: 0,
  recentActivity: [],
  available: false,
};

function compact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "verified";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(timestamp));
}

function metricsFor(proof: PublicSocialProof) {
  return [
    { value: proof.available ? compact(proof.memberCount) : "—", label: "Members", icon: Spark },
    { value: proof.available ? compact(proof.rewardEventCount) : "—", label: "Reward events", icon: Check },
    { value: proof.available ? compact(proof.paidWithdrawalCount) : "—", label: "Paid withdrawals", icon: Trend },
  ];
}

export function SocialProofPanel() {
  const [proof, setProof] = useState<PublicSocialProof>(EMPTY_PROOF);

  useEffect(() => {
    const controller = new AbortController();

    async function refreshProof() {
      try {
        const response = await fetch("/api/public/social-proof", {
          method: "GET",
          signal: controller.signal,
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;

        const nextProof = (await response.json()) as PublicSocialProof;
        if (!controller.signal.aborted) setProof(nextProof);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("[social-proof] public refresh failed");
      }
    }

    void refreshProof();
    return () => controller.abort();
  }, []);

  const metrics = metricsFor(proof);
  const hasActivity = proof.available && proof.recentActivity.length > 0;

  return (
    <section className="social-proof-section shell" aria-labelledby="social-proof-title">
      <div className="social-proof-head">
        <div>
          <span className="section-kicker">Live proof · no vanity numbers</span>
          <h2 id="social-proof-title">Real activity, shown only when it is real.</h2>
        </div>
        <p>
          We never inflate online users, earnings or payout counts. The proof layer shows only aggregate production evidence that is currently available.
        </p>
      </div>

      <div className="social-proof-grid">
        <div className="proof-metrics">
          {metrics.map(({ value, label, icon: Icon }) => (
            <article className="proof-metric" key={label}>
              <span className="proof-icon"><Icon /></span>
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>

        <article className="proof-feed">
          <div className="proof-feed-head">
            <div><span className="live-dot" /><strong>Recent verified activity</strong></div>
            <small>Anonymous by design</small>
          </div>

          {hasActivity ? (
            <div className="proof-feed-list">
              {proof.recentActivity.map((activity, index) => (
                <div className="proof-feed-row" key={`${activity.occurredAt}-${index}`}>
                  <span className="proof-feed-check"><Check /></span>
                  <div><strong>{activity.label}</strong><small>{activity.credits.toLocaleString("en-US")} credits</small></div>
                  <time dateTime={activity.occurredAt}>{relativeTime(activity.occurredAt)}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="proof-feed-empty">
              {proof.available ? <Spark /> : <Shield />}
              <div>
                <strong>{proof.available ? "No verified reward activity yet." : "Public proof is temporarily unavailable."}</strong>
                <span>{proof.available ? "Verified reward events will appear here automatically." : "No activity is inferred while the authoritative source is unavailable."}</span>
              </div>
            </div>
          )}

          <div className="proof-contract"><Shield /><span>Public proof never exposes user IDs, emails or destinations.</span></div>
        </article>
      </div>
    </section>
  );
}
