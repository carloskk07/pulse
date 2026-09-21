import "server-only";

import { getCurrentUserContext } from "@/lib/current-user-context";
import { objectValue } from "@/lib/reward-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NetworkLevel = {
  level: 1 | 2 | 3;
  members: number;
  active: number;
};

export type EcosystemMission = {
  id: "pulse" | "rhythm" | "earn" | "network";
  title: string;
  detail: string;
  current: number;
  target: number;
  complete: boolean;
  href: string;
};

export type PulseEcosystemSnapshot = {
  available: boolean;
  xp: number;
  rank: "Node" | "Relay" | "Circuit" | "Grid" | "Core";
  rankLevel: number;
  nextRankXp: number | null;
  rankProgress: number;
  totalClaims: number;
  claimsToday: number;
  confirmedConversions: number;
  conversionsToday: number;
  paidWithdrawals: number;
  rewardedReferrals: number;
  network: NetworkLevel[];
  networkMembers: number;
  networkActive: number;
  cashbackOffers: number;
  cashbackPendingCredits: number;
  cashbackConfirmedCredits: number;
  freeWithdrawalAvailable: boolean;
  nextFreeWithdrawalAt: string | null;
  extraWithdrawalFeeCredits: number;
  extraWithdrawalsEnabled: boolean;
  variableRewardsEnabled: boolean;
  variableRewardReviewRequired: boolean;
  networkCommissionEnabled: boolean;
  cashbackEnabled: boolean;
  hourlyUserCapEnabled: boolean;
  missions: EcosystemMission[];
};

const EMPTY: PulseEcosystemSnapshot = {
  available: false,
  xp: 0,
  rank: "Node",
  rankLevel: 1,
  nextRankXp: 100,
  rankProgress: 0,
  totalClaims: 0,
  claimsToday: 0,
  confirmedConversions: 0,
  conversionsToday: 0,
  paidWithdrawals: 0,
  rewardedReferrals: 0,
  network: [
    { level: 1, members: 0, active: 0 },
    { level: 2, members: 0, active: 0 },
    { level: 3, members: 0, active: 0 },
  ],
  networkMembers: 0,
  networkActive: 0,
  cashbackOffers: 0,
  cashbackPendingCredits: 0,
  cashbackConfirmedCredits: 0,
  freeWithdrawalAvailable: true,
  nextFreeWithdrawalAt: null,
  extraWithdrawalFeeCredits: 0,
  extraWithdrawalsEnabled: false,
  variableRewardsEnabled: false,
  variableRewardReviewRequired: true,
  networkCommissionEnabled: false,
  cashbackEnabled: false,
  hourlyUserCapEnabled: false,
  missions: [],
};

function asInt(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function asBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  return fallback;
}

function rankFromXp(xp: number) {
  const tiers = [
    { rank: "Node" as const, floor: 0, next: 100 },
    { rank: "Relay" as const, floor: 100, next: 300 },
    { rank: "Circuit" as const, floor: 300, next: 750 },
    { rank: "Grid" as const, floor: 750, next: 1500 },
    { rank: "Core" as const, floor: 1500, next: null },
  ];

  const index = Math.max(0, tiers.findLastIndex((tier) => xp >= tier.floor));
  const tier = tiers[index] ?? tiers[0];
  const span = tier.next === null ? 1 : Math.max(1, tier.next - tier.floor);
  const progress = tier.next === null ? 100 : Math.max(0, Math.min(100, Math.round(((xp - tier.floor) / span) * 100)));

  return {
    rank: tier.rank,
    rankLevel: index + 1,
    nextRankXp: tier.next,
    rankProgress: progress,
  };
}

export async function getPulseEcosystemSnapshot(): Promise<PulseEcosystemSnapshot> {
  const { user } = await getCurrentUserContext();
  if (!user) return EMPTY;

  const admin = createSupabaseAdminClient();
  if (!admin) return EMPTY;

  const { data, error } = await admin.rpc("current_ecosystem_snapshot", {
    p_user_id: user.id,
  });
  if (error || !data) return EMPTY;

  const raw = objectValue(data);
  const config = objectValue(raw.config);
  const claims = objectValue(raw.claims);
  const monetization = objectValue(raw.monetization);
  const withdrawals = objectValue(raw.withdrawals);
  const referrals = objectValue(raw.referrals);
  const cashback = objectValue(raw.cashback);
  const networkRaw = Array.isArray(raw.network) ? raw.network : [];

  const totalClaims = asInt(claims.total);
  const claimsToday = asInt(claims.today);
  const confirmedConversions = asInt(monetization.confirmed);
  const conversionsToday = asInt(monetization.today);
  const paidWithdrawals = asInt(withdrawals.paid);
  const rewardedReferrals = asInt(referrals.rewarded);

  // XP is non-monetary and deterministic from verified activity.
  const xp =
    totalClaims * 5
    + confirmedConversions * 30
    + paidWithdrawals * 50
    + rewardedReferrals * 40;

  const rank = rankFromXp(xp);
  const network = ([1, 2, 3] as const).map((level) => {
    const row = networkRaw.map(objectValue).find((item) => asInt(item.level) === level) ?? {};
    return {
      level,
      members: asInt(row.members),
      active: asInt(row.active),
    };
  });
  const networkMembers = network.reduce((sum, level) => sum + level.members, 0);
  const networkActive = network.reduce((sum, level) => sum + level.active, 0);

  const missions: EcosystemMission[] = [
    {
      id: "pulse",
      title: "Catch today's Pulse",
      detail: "Every verified hourly claim grows your XP and keeps the circuit moving.",
      current: Math.min(claimsToday, 1),
      target: 1,
      complete: claimsToday >= 1,
      href: "/dashboard",
    },
    {
      id: "rhythm",
      title: "Build a three-Pulse rhythm",
      detail: "Return across the day instead of exhausting a fixed daily allowance.",
      current: Math.min(claimsToday, 3),
      target: 3,
      complete: claimsToday >= 3,
      href: "/dashboard",
    },
    {
      id: "earn",
      title: "Complete a verified earning action",
      detail: "Sponsored and partner actions only count when the provider confirms them.",
      current: Math.min(conversionsToday, 1),
      target: 1,
      complete: conversionsToday >= 1,
      href: "/earn",
    },
    {
      id: "network",
      title: "Activate your network",
      detail: "Network progress follows real eligible activity, never recruitment alone.",
      current: Math.min(networkActive, 1),
      target: 1,
      complete: networkActive >= 1,
      href: "/invite",
    },
  ];

  return {
    available: true,
    xp,
    ...rank,
    totalClaims,
    claimsToday,
    confirmedConversions,
    conversionsToday,
    paidWithdrawals,
    rewardedReferrals,
    network,
    networkMembers,
    networkActive,
    cashbackOffers: asInt(cashback.active_offers),
    cashbackPendingCredits: asInt(cashback.pending_credits),
    cashbackConfirmedCredits: asInt(cashback.confirmed_credits),
    freeWithdrawalAvailable: asBool(withdrawals.free_pass_available, true),
    nextFreeWithdrawalAt: typeof withdrawals.next_free_at === "string" && withdrawals.next_free_at ? withdrawals.next_free_at : null,
    extraWithdrawalFeeCredits: asInt(config.extra_withdrawal_fee_credits),
    extraWithdrawalsEnabled: asBool(config.extra_withdrawals_enabled),
    variableRewardsEnabled: asBool(config.variable_reward_enabled),
    variableRewardReviewRequired: asBool(config.variable_reward_review_required, true),
    networkCommissionEnabled: asBool(config.network_commission_enabled),
    cashbackEnabled: asBool(config.cashback_enabled),
    hourlyUserCapEnabled: asBool(config.user_daily_cap_enabled),
    missions,
  };
}
