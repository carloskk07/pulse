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

export async function getPublicSocialProof(): Promise<PublicSocialProof> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return EMPTY_PROOF;

  try {
    const [members, rewards, paidWithdrawals, recent] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("ledger_entries")
        .select("id", { count: "exact", head: true })
        .gt("credits", 0)
        .in("state", [...REWARD_STATES])
        .in("entry_type", [...REWARD_TYPES]),
      supabase.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "paid"),
      supabase
        .from("ledger_entries")
        .select("entry_type,credits,created_at")
        .gt("credits", 0)
        .in("state", [...REWARD_STATES])
        .in("entry_type", [...REWARD_TYPES])
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (members.error || rewards.error || paidWithdrawals.error || recent.error) {
      console.error("[social-proof] aggregate query failed", {
        members: members.error?.code,
        rewards: rewards.error?.code,
        paidWithdrawals: paidWithdrawals.error?.code,
        recent: recent.error?.code,
      });
      return EMPTY_PROOF;
    }

    const memberCount = members.count ?? 0;
    const rewardEventCount = rewards.count ?? 0;
    const paidWithdrawalCount = paidWithdrawals.count ?? 0;
    const recentActivity = ((recent.data ?? []) as RecentRewardRow[]).map((row) => ({
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
