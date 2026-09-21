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

export async function getPublicSocialProof(): Promise<PublicSocialProof> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return EMPTY_PROOF;

  try {
    const { data, error } = await supabase.rpc("public_social_proof_snapshot");

    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      console.error("[social-proof] snapshot RPC failed", {
        code: error?.code,
      });
      return EMPTY_PROOF;
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
  } catch (error) {
    console.error("[social-proof] unexpected query failure", error instanceof Error ? error.message : "unknown");
    return EMPTY_PROOF;
  }
}
