import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RewardSnapshot = {
  preview: boolean;
  signedIn: boolean;
  userLabel: string;
  trustLevel: number;
  availableCredits: number;
  pendingCredits: number;
  streakDays: number;
  claimReady: boolean;
  claimRewardCredits: number;
};

export type LedgerItem = {
  id: string;
  label: string;
  state: string;
  credits: number;
  createdAt: string;
};

const disconnectedSnapshot: RewardSnapshot = {
  preview: true,
  signedIn: false,
  userLabel: "Preview",
  trustLevel: 0,
  availableCredits: 0,
  pendingCredits: 0,
  streakDays: 0,
  claimReady: false,
  claimRewardCredits: 0,
};

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function streakFromClaims(claimDays: string[]) {
  const set = new Set(claimDays);
  const cursor = new Date(`${utcDay()}T00:00:00.000Z`);
  if (!set.has(utcDay(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);

  let streak = 0;
  while (set.has(utcDay(cursor)) && streak < 366) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function labelForEntry(type: string) {
  const labels: Record<string, string> = {
    daily_reward: "Daily Pulse",
    offer: "Offer completed",
    survey: "Survey completed",
    referral: "Referral reward",
    withdrawal: "Withdrawal",
    chargeback: "Reward reversed",
    adjustment: "Balance adjustment",
  };
  return labels[type] ?? "Reward activity";
}

export async function getRewardSnapshot(): Promise<RewardSnapshot> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return disconnectedSnapshot;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...disconnectedSnapshot, preview: false };

  const admin = createSupabaseAdminClient();
  const [balanceResult, claimsResult, profileResult, pulseConfigResult] = await Promise.all([
    supabase.from("user_balances").select("available_credits,pending_credits").eq("user_id", user.id).maybeSingle(),
    supabase.from("claims").select("claim_day,reward_credits").order("claim_day", { ascending: false }).limit(60),
    supabase.from("profiles").select("handle,trust_level").eq("id", user.id).maybeSingle(),
    admin ? admin.from("app_config").select("value").eq("key", "daily_pulse").maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const claims = claimsResult.data ?? [];
  const claimDays = claims.map((claim) => String(claim.claim_day));
  const todayClaim = claims.find((claim) => String(claim.claim_day) === utcDay());
  const fallbackLabel = user.email?.split("@")[0] || "Member";
  const pulseConfig = pulseConfigResult.data?.value as { credits?: number | string } | null | undefined;
  const configuredReward = Number(pulseConfig?.credits ?? 0);
  const latestClaimReward = Number(todayClaim?.reward_credits ?? claims[0]?.reward_credits ?? 0);
  const claimRewardCredits = Number.isFinite(configuredReward) && configuredReward > 0 ? configuredReward : latestClaimReward;

  return {
    preview: false,
    signedIn: true,
    userLabel: profileResult.data?.handle || fallbackLabel,
    trustLevel: Number(profileResult.data?.trust_level ?? 0),
    availableCredits: Number(balanceResult.data?.available_credits ?? 0),
    pendingCredits: Number(balanceResult.data?.pending_credits ?? 0),
    streakDays: streakFromClaims(claimDays),
    claimReady: !todayClaim,
    claimRewardCredits,
  };
}

export async function getLedgerItems(): Promise<LedgerItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("ledger_entries")
    .select("id,entry_type,state,credits,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);

  return (data ?? []).map((entry) => ({
    id: String(entry.id),
    label: labelForEntry(String(entry.entry_type)),
    state: String(entry.state),
    credits: Number(entry.credits),
    createdAt: String(entry.created_at),
  }));
}

export function creditsToUsd(credits: number) {
  return credits / 1000;
}

export function formatUsdFromCredits(credits: number, signed = false) {
  const value = creditsToUsd(Math.abs(credits));
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
  if (!signed || credits === 0) return formatted;
  return `${credits > 0 ? "+" : "−"}${formatted}`;
}
