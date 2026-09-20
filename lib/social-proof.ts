import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const REWARD_TYPES = ["daily_reward", "pulse_reward", "offer", "survey", "referral"] as const;
const REWARD_STATES = ["available", "withdrawn"] as const;

type RewardType = (typeof REWARD_TYPES)[number];

type RecentRewardRow = {
  entry_type: RewardType;
  credits: number | string;
  created_at: string;
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

function isRewardType(value: unknown): value is RewardType {
  return typeof value === "string" && (REWARD_TYPES as readonly string[]).includes(value);
}

export async function getPublicSocialProof(): Promise<PublicSocialProof> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return EMPTY_PROOF;

  try {
    const { data, error } = await supabase.rpc("public_social_proof_snapshot");

    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      console.error("[social-proof] snapshot query failed", error?.code ?? "invalid_payload");
      return EMPTY_PROOF;
    }

    const row = data as Record<string, unknown>;
    const memberCount = Math.max(0, Number(row.member_count ?? 0) || 0);
    const rewardEventCount = Math.max(0, Number(row.reward_event_count ?? 0) || 0);
    const paidWithdrawalCount = Math.max(0, Number(row.paid_withdrawal_count ?? 0) || 0);
    const recentActivity = Array.isArray(row.recent_activity)
      ? row.recent_activity.flatMap((value) => {
          if (!value || typeof value !== "object" || Array.isArray(value)) return [];
          const activity = value as Record<string, unknown>;
          if (!isRewardType(activity.entry_type) || typeof activity.created_at !== "string") return [];
          return [{
            label: activityLabel(activity.entry_type),
            credits: Math.max(0, Number(activity.credits ?? 0) || 0),
            occurredAt: activity.created_at,
          }];
        })
      : [];

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

