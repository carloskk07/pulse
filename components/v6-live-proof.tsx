"use client";

import { useEffect, useState } from "react";
import { Check, Shield, Spark, Users } from "@/components/icons";
import {
  PUBLIC_PROOF_UPDATE_EVENT,
  type PublicProofUpdateDetail,
  type PublicProofUpdateKind,
} from "@/lib/public-proof-events";
import type { PublicSocialProof } from "@/lib/social-proof";

const EMPTY_PROOF: PublicSocialProof = {
  stage: "early",
  memberCount: 0,
  rewardEventCount: 0,
  paidWithdrawalCount: 0,
  recentActivity: [],
  available: false,
};

const PUBLIC_PROOF_REFRESH_FLOOR_MS = 45_000;
const PUBLIC_PROOF_POLL_MS = 60_000;

let cachedProof: PublicSocialProof | null = null;
let pendingProof: Promise<PublicSocialProof> | null = null;
let lastRefreshAttemptAt = 0;

type V6ProofProps = {
  initialProof: PublicSocialProof;
};

function count(value: number, available: boolean) {
  return available ? value.toLocaleString("en-US") : "—";
}

function countLabel(value: number, available: boolean, singular: string, plural: string) {
  return available && value === 1 ? singular : plural;
}

function usableRuntimeProof(value: unknown): value is PublicSocialProof {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proof = value as Partial<PublicSocialProof>;

  if (
    proof.available !== true
    || (proof.stage !== "early" && proof.stage !== "growing" && proof.stage !== "established")
    || !Number.isSafeInteger(proof.memberCount)
    || Number(proof.memberCount) < 0
    || !Number.isSafeInteger(proof.rewardEventCount)
    || Number(proof.rewardEventCount) < 0
    || !Number.isSafeInteger(proof.paidWithdrawalCount)
    || Number(proof.paidWithdrawalCount) < 0
    || !Array.isArray(proof.recentActivity)
  ) {
    return false;
  }

  return proof.recentActivity.every((item) => (
    item
    && typeof item === "object"
    && typeof item.label === "string"
    && typeof item.credits === "number"
    && Number.isFinite(item.credits)
    && item.credits >= 0
    && typeof item.occurredAt === "string"
  ));
}

function positiveDelta(next: number, previous: number) {
  return Math.max(0, next - previous);
}

function proofUpdateKind(detail: Omit<PublicProofUpdateDetail, "kind">): PublicProofUpdateKind | null {
  if (detail.paidWithdrawalDelta > 0) return "payout";
  if (detail.rewardEventDelta > 0) return "reward";
  if (detail.memberDelta > 0) return "member";
  return null;
}

function announceProofUpdate(previous: PublicSocialProof | null, next: PublicSocialProof) {
  if (
    typeof window === "undefined"
    || !previous?.available
    || !next.available
  ) {
    return;
  }

  const deltas = {
    memberDelta: positiveDelta(next.memberCount, previous.memberCount),
    rewardEventDelta: positiveDelta(next.rewardEventCount, previous.rewardEventCount),
    paidWithdrawalDelta: positiveDelta(next.paidWithdrawalCount, previous.paidWithdrawalCount),
  };
  const kind = proofUpdateKind(deltas);
  if (!kind) return;

  const detail: PublicProofUpdateDetail = { kind, ...deltas };
  window.dispatchEvent(new CustomEvent<PublicProofUpdateDetail>(PUBLIC_PROOF_UPDATE_EVENT, { detail }));
}

function refreshPublicProof() {
  if (pendingProof) return pendingProof;

  if (
    cachedProof
    && lastRefreshAttemptAt > 0
    && Date.now() - lastRefreshAttemptAt < PUBLIC_PROOF_REFRESH_FLOOR_MS
  ) {
    return Promise.resolve(cachedProof);
  }

  lastRefreshAttemptAt = Date.now();

  pendingProof = fetch("/api/public/social-proof", {
    method: "GET",
    headers: { accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) return cachedProof ?? EMPTY_PROOF;

      const payload: unknown = await response.json();
      if (!usableRuntimeProof(payload)) return cachedProof ?? EMPTY_PROOF;

      const previous = cachedProof;
      cachedProof = payload;
      announceProofUpdate(previous, payload);
      return payload;
    })
    .catch(() => {
      console.error("[v6-proof] runtime refresh failed");
      return cachedProof ?? EMPTY_PROOF;
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

    const applyRefresh = () => {
      if (document.visibilityState !== "visible") return;
      void refreshPublicProof().then((nextProof) => {
        if (active) setProof(nextProof);
      });
    };

    applyRefresh();
    const poll = window.setInterval(applyRefresh, PUBLIC_PROOF_POLL_MS);
    document.addEventListener("visibilitychange", applyRefresh);

    return () => {
      active = false;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", applyRefresh);
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
      <div><strong>{count(proof.memberCount, proof.available)}</strong><span>{countLabel(proof.memberCount, proof.available, "Member", "Members")}</span></div>
      <div><strong>{count(proof.rewardEventCount, proof.available)}</strong><span>{countLabel(proof.rewardEventCount, proof.available, "Reward event", "Reward events")}</span></div>
      <div><strong>{count(proof.paidWithdrawalCount, proof.available)}</strong><span>{countLabel(proof.paidWithdrawalCount, proof.available, "Paid withdrawal", "Paid withdrawals")}</span></div>
    </div>
  );
}

export function V6RecentActivity({ initialProof }: V6ProofProps) {
  const proof = usePublicProof(initialProof);
  const recent = proof.recentActivity.slice(0, 3);

  return (
    <div
      className="pc-home-activity-list"
      aria-live="polite"
      data-proof-source="server-bootstrap"
      data-proof-available={proof.available ? "true" : "false"}
      data-proof-member-count={proof.available ? proof.memberCount : undefined}
      data-proof-reward-event-count={proof.available ? proof.rewardEventCount : undefined}
      data-proof-paid-withdrawal-count={proof.available ? proof.paidWithdrawalCount : undefined}
    >
      {recent.length ? recent.map((item, index) => (
        <div key={`${item.occurredAt}-${index}`}>
          <span className="pc-home-activity-pulse" aria-hidden="true" />
          <p>
            <strong>{item.label}</strong>
            <small>{item.credits > 0 ? "Verified reward" : "Verified"}</small>
          </p>
        </div>
      )) : (
        <div className="pc-home-activity-empty">
          <Shield />
          <p>
            <strong>Proof feed ready</strong>
            <small>Verified production activity appears here as it happens.</small>
          </p>
        </div>
      )}
    </div>
  );
}

export function V6FinalProof({ initialProof }: V6ProofProps) {
  const proof = usePublicProof(initialProof);

  return (
    <div className="pc-v6-final-stats" aria-live="polite">
      <div><Users /><strong>{count(proof.memberCount, proof.available)}</strong><span>{countLabel(proof.memberCount, proof.available, "Member", "Members")}</span></div>
      <div><Spark /><strong>{count(proof.rewardEventCount, proof.available)}</strong><span>{countLabel(proof.rewardEventCount, proof.available, "Reward event", "Reward events")}</span></div>
      <div><Check /><strong>{count(proof.paidWithdrawalCount, proof.available)}</strong><span>{countLabel(proof.paidWithdrawalCount, proof.available, "Paid withdrawal", "Paid withdrawals")}</span></div>
    </div>
  );
}
