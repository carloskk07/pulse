import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RewardType = "daily_reward" | "pulse_reward" | "offer" | "survey" | "referral";

type RecentRewardRow = {
  entry_type: RewardType;
  credits: number | string;
  created_at: string;
};

type PublicSocialProofSnapshot = {
  member_count?: number | string;
  reward_event_count?: number | string;
  paid_withdrawal_count?: number | string;
  recent?: RecentRewardRow[];
};

export type SocialProofStage = "early" | "growing" | "established";

export type SocialProofActivity = {
  label: string;
  credits: number;
  occurredAt: string;
};

export type PublicSocialProof = {
  stage: SocialProofStage;
  memberCount: number;
  rewardEventCount: number;
  paidWithdrawalCount: number;
  recentActivity: SocialProofActivity[];
  available: boolean;
};

const SOCIAL_PROOF_DATA_CACHE_SECONDS = 30;
const SOCIAL_PROOF_TRANSPORT_RETRY_DELAYS_MS = [200, 500] as const;
const HOME_BUILD_PROOF_RETRY_DELAYS_MS = [250, 750] as const;
const HOME_BUILD_PROOF_URL = "https://pulsercuit.pro/api/public/social-proof";

const EMPTY_PROOF: PublicSocialProof = {
  stage: "early",
  memberCount: 0,
  rewardEventCount: 0,
  paidWithdrawalCount: 0,
  recentActivity: [],
  available: false,
};

function activityLabel(type: RewardType) {
  switch (type) {
    case "daily_reward":
      return "Legacy Daily Pulse verified";
    case "pulse_reward":
      return "Hourly Pulse verified";
    case "offer":
      return "Turbo reward verified";
    case "survey":
      return "Survey reward verified";
    case "referral":
      return "Referral reward verified";
  }
}

function stageFor(memberCount: number, rewardEventCount: number, paidWithdrawalCount: number): SocialProofStage {
  if (memberCount >= 250 || rewardEventCount >= 500 || paidWithdrawalCount >= 50) return "established";
  if (memberCount >= 25 || rewardEventCount >= 50 || paidWithdrawalCount >= 5) return "growing";
  return "early";
}

function socialProofErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code ?? "").trim();
}

function retryableSocialProofTransportFailure(error: unknown) {
  if (socialProofErrorCode(error)) return false;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return [
    "fetch failed",
    "network",
    "timeout",
    "timed out",
    "econnreset",
    "enotfound",
    "socket",
    "connection reset",
    "connection closed",
    "aborted",
  ].some((fragment) => message.includes(fragment));
}

function usablePublicSocialProof(value: unknown): value is PublicSocialProof {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proof = value as Partial<PublicSocialProof>;
  return proof.available === true
    && (proof.stage === "early" || proof.stage === "growing" || proof.stage === "established")
    && Number.isSafeInteger(proof.memberCount) && Number(proof.memberCount) >= 0
    && Number.isSafeInteger(proof.rewardEventCount) && Number(proof.rewardEventCount) >= 0
    && Number.isSafeInteger(proof.paidWithdrawalCount) && Number(proof.paidWithdrawalCount) >= 0
    && Array.isArray(proof.recentActivity);
}

async function queryPublicSocialProofOnce(): Promise<PublicSocialProof> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    const failure = new Error("social-proof database not configured");
    Object.assign(failure, { code: "CONFIG_MISSING" });
    throw failure;
  }

  const { data, error } = await supabase.rpc("public_social_proof_snapshot");
  if (error) {
    const failure = new Error(
      error.message
        ? `social-proof snapshot RPC failed: ${error.message}`
        : "social-proof snapshot RPC failed",
    );
    Object.assign(failure, { code: error.code ?? "" });
    throw failure;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    const failure = new Error("social-proof snapshot RPC returned an invalid payload");
    Object.assign(failure, { code: "INVALID_SNAPSHOT" });
    throw failure;
  }

  const snapshot = data as PublicSocialProofSnapshot;
  const memberCount = Math.max(0, Number(snapshot.member_count) || 0);
  const rewardEventCount = Math.max(0, Number(snapshot.reward_event_count) || 0);
  const paidWithdrawalCount = Math.max(0, Number(snapshot.paid_withdrawal_count) || 0);
  const recentActivity = (snapshot.recent ?? []).map((row) => ({
    label: activityLabel(row.entry_type),
    credits: Math.max(0, Number(row.credits) || 0),
    occurredAt: row.created_at,
  }));

  return {
    stage: stageFor(memberCount, rewardEventCount, paidWithdrawalCount),
    memberCount,
    rewardEventCount,
    paidWithdrawalCount,
    recentActivity,
    available: true,
  };
}

async function queryPublicSocialProof(): Promise<PublicSocialProof> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= SOCIAL_PROOF_TRANSPORT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await queryPublicSocialProofOnce();
    } catch (error) {
      lastError = error;
      const code = socialProofErrorCode(error);
      const retryDelay = SOCIAL_PROOF_TRANSPORT_RETRY_DELAYS_MS[attempt];

      if (code || !retryableSocialProofTransportFailure(error) || retryDelay === undefined) throw error;

      console.warn("[social-proof] transient snapshot retry", {
        attempt: attempt + 1,
        nextDelayMs: retryDelay,
        message: error instanceof Error ? error.message : "unknown",
      });
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("social-proof snapshot unavailable");
}

const getCachedPublicSocialProof = unstable_cache(
  queryPublicSocialProof,
  ["public-social-proof-v1"],
  {
    revalidate: SOCIAL_PROOF_DATA_CACHE_SECONDS,
    tags: ["public-social-proof"],
  },
);

let socialProofInFlight: Promise<PublicSocialProof> | null = null;

export async function getHomeBootstrapProof(): Promise<PublicSocialProof> {
  const configuredBuildUrl = process.env.PULSECIRCUIT_BUILD_PROOF_URL?.trim();
  if (!configuredBuildUrl) return getPublicSocialProof();
  if (configuredBuildUrl !== HOME_BUILD_PROOF_URL) {
    throw new Error("Home build proof URL is not canonical.");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= HOME_BUILD_PROOF_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const target = new URL(configuredBuildUrl);
      target.searchParams.set("__pc_build_seed", String(attempt + 1));
      const response = await fetch(target, {
        headers: {
          accept: "application/json",
          "cache-control": "no-cache",
        },
        next: { revalidate: SOCIAL_PROOF_DATA_CACHE_SECONDS },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        throw new Error(`Home build proof HTTP ${response.status}`);
      }

      const proof = await response.json();
      if (!usablePublicSocialProof(proof)) {
        throw new Error("Home build proof payload is unavailable or invalid.");
      }
      return proof;
    } catch (error) {
      lastError = error;
      const retryDelay = HOME_BUILD_PROOF_RETRY_DELAYS_MS[attempt];
      if (retryDelay === undefined) break;

      console.warn("[social-proof] build bootstrap retry", {
        attempt: attempt + 1,
        nextDelayMs: retryDelay,
        message: error instanceof Error ? error.message : "unknown",
      });
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  console.error("[social-proof] build bootstrap unavailable", {
    message: lastError instanceof Error ? lastError.message : "unknown",
  });
  return EMPTY_PROOF;
}

export async function getPublicSocialProof(): Promise<PublicSocialProof> {
  if (socialProofInFlight) return socialProofInFlight;

  socialProofInFlight = getCachedPublicSocialProof();
  try {
    return await socialProofInFlight;
  } catch (error) {
    console.error("[social-proof] snapshot unavailable", {
      code: error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : undefined,
      message: error instanceof Error ? error.message : "unknown",
    });
    return EMPTY_PROOF;
  } finally {
    socialProofInFlight = null;
  }
}
