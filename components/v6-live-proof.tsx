"use client";

import { useEffect, useState } from "react";
import { Check, Spark, Users } from "@/components/icons";
import type { PublicSocialProof } from "@/lib/social-proof";

const EMPTY_PROOF: PublicSocialProof = {
  stage: "early",
  memberCount: 0,
  rewardEventCount: 0,
  paidWithdrawalCount: 0,
  recentActivity: [],
  available: false,
};

function count(value: number, available: boolean) {
  return available ? value.toLocaleString("en-US") : "—";
}

export function V6HeroProof() {
  const [proof, setProof] = useState<PublicSocialProof>(EMPTY_PROOF);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/public/social-proof", {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((nextProof: PublicSocialProof | null) => {
        if (nextProof && !controller.signal.aborted) setProof(nextProof);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("[v6-proof] runtime refresh failed");
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="pc-v6-shell pc-v6-hero-stats" aria-live="polite">
      <div><strong>{count(proof.memberCount, proof.available)}</strong><span>Active members</span></div>
      <div><strong>{count(proof.rewardEventCount, proof.available)}</strong><span>Rewards unlocked</span></div>
      <div><strong>{count(proof.paidWithdrawalCount, proof.available)}</strong><span>Paid withdrawals</span></div>
    </div>
  );
}

export function V6FinalProof() {
  const [proof, setProof] = useState<PublicSocialProof>(EMPTY_PROOF);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/public/social-proof", {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((nextProof: PublicSocialProof | null) => {
        if (nextProof && !controller.signal.aborted) setProof(nextProof);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("[v6-proof] runtime refresh failed");
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="pc-v6-final-stats" aria-live="polite">
      <div><Users /><strong>{count(proof.memberCount, proof.available)}</strong><span>Members</span></div>
      <div><Spark /><strong>{count(proof.rewardEventCount, proof.available)}</strong><span>Rewards</span></div>
      <div><Check /><strong>{count(proof.paidWithdrawalCount, proof.available)}</strong><span>Paid</span></div>
    </div>
  );
}
