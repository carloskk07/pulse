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

type V6ProofProps = {
  initialProof: PublicSocialProof;
};

function count(value: number, available: boolean) {
  return available ? value.toLocaleString("en-US") : "—";
}

function refreshPublicProof() {
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

function usePublicProof(initialProof: PublicSocialProof) {
  const [proof, setProof] = useState<PublicSocialProof>(cachedProof ?? initialProof ?? EMPTY_PROOF);

  useEffect(() => {
    let active = true;

    if (!cachedProof && initialProof.available) {
      cachedProof = initialProof;
    }

    void refreshPublicProof().then((nextProof) => {
      if (active) setProof(nextProof);
    });

    return () => {
      active = false;
    };
  }, [initialProof]);

  return proof;
}

export function V6HeroProof({ initialProof }: V6ProofProps) {
  const proof = usePublicProof(initialProof);

  return (
    <div
      className="pc-v6-shell pc-v6-hero-stats"
      aria-live="polite"
      data-proof-source="server-bootstrap"
      data-proof-available={proof.available ? "true" : "false"}
      data-proof-member-count={proof.available ? proof.memberCount : undefined}
      data-proof-reward-event-count={proof.available ? proof.rewardEventCount : undefined}
      data-proof-paid-withdrawal-count={proof.available ? proof.paidWithdrawalCount : undefined}
    >
      <div><strong>{count(proof.memberCount, proof.available)}</strong><span>Members</span></div>
      <div><strong>{count(proof.rewardEventCount, proof.available)}</strong><span>Reward events</span></div>
      <div><strong>{count(proof.paidWithdrawalCount, proof.available)}</strong><span>Paid withdrawals</span></div>
    </div>
  );
}

export function V6FinalProof({ initialProof }: V6ProofProps) {
  const proof = usePublicProof(initialProof);

  return (
    <div className="pc-v6-final-stats" aria-live="polite">
      <div><Users /><strong>{count(proof.memberCount, proof.available)}</strong><span>Members</span></div>
      <div><Spark /><strong>{count(proof.rewardEventCount, proof.available)}</strong><span>Reward events</span></div>
      <div><Check /><strong>{count(proof.paidWithdrawalCount, proof.available)}</strong><span>Paid withdrawals</span></div>
    </div>
  );
}
