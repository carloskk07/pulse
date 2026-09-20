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

let cachedProof: PublicSocialProof | null = null;
let pendingProof: Promise<PublicSocialProof> | null = null;

function count(value: number, available: boolean) {
  return available ? value.toLocaleString("en-US") : "—";
}

function loadPublicProof() {
  if (cachedProof) return Promise.resolve(cachedProof);
  if (pendingProof) return pendingProof;

  pendingProof = fetch("/api/public/social-proof", {
    method: "GET",
    headers: { accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) return EMPTY_PROOF;
      const proof = (await response.json()) as PublicSocialProof;
      cachedProof = proof;
      return proof;
    })
    .catch(() => {
      console.error("[v6-proof] runtime refresh failed");
      return EMPTY_PROOF;
    })
    .finally(() => {
      pendingProof = null;
    });

  return pendingProof;
}

function usePublicProof() {
  const [proof, setProof] = useState<PublicSocialProof>(cachedProof ?? EMPTY_PROOF);

  useEffect(() => {
    let active = true;

    void loadPublicProof().then((nextProof) => {
      if (active) setProof(nextProof);
    });

    return () => {
      active = false;
    };
  }, []);

  return proof;
}

export function V6HeroProof() {
  const proof = usePublicProof();

  return (
    <div className="pc-v6-shell pc-v6-hero-stats" aria-live="polite">
      <div className="pc-v10-live-proof-label"><strong>Live verified launch</strong><span>Production counts · no demo activity</span></div>
      <div><strong>{count(proof.memberCount, proof.available)}</strong><span>Members</span></div>
      <div><strong>{count(proof.rewardEventCount, proof.available)}</strong><span>Reward events</span></div>
      <div><strong>{count(proof.paidWithdrawalCount, proof.available)}</strong><span>Paid withdrawals</span></div>
    </div>
  );
}

export function V6FinalProof() {
  const proof = usePublicProof();

  return (
    <div className="pc-v6-final-stats" aria-live="polite">
      <div><Users /><strong>{count(proof.memberCount, proof.available)}</strong><span>Members</span></div>
      <div><Spark /><strong>{count(proof.rewardEventCount, proof.available)}</strong><span>Reward events</span></div>
      <div><Check /><strong>{count(proof.paidWithdrawalCount, proof.available)}</strong><span>Paid withdrawals</span></div>
    </div>
  );
}
