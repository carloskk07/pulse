import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserContext } from "@/lib/current-user-context";

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
  claimIntervalMinutes: number;
  nextClaimAt: string | null;
  pulseFundingReady: boolean;
  hourlyClaimCount: number;
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
  claimIntervalMinutes: 60,
  nextClaimAt: null,
  pulseFundingReady: false,
  hourlyClaimCount: 0,
};

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function labelForEntry(type: string) {
  const labels: Record<string, string> = {
    daily_reward: "Legacy Daily Pulse",
    pulse_reward: "Hourly Pulse",
    offer: "Turbo completed",
    survey: "Survey completed",
    referral: "Referral reward",
    withdrawal: "Withdrawal",
    chargeback: "Reward reversed",
    adjustment: "Balance adjustment",
  };
  return labels[type] ?? "Reward activity";
}

export function trustLabel(level: number) {
  if (level >= 5) return "Trusted";
  if (level >= 4) return "Established";
  if (level >= 3) return "Verified";
  if (level >= 2) return "Consistent";
  if (level >= 1) return "Active";
  return "Building";
}

export async function getRewardSnapshot(): Promise<RewardSnapshot> {
  const { supabase, user } = await getCurrentUserContext();
  if (!supabase) return disconnectedSnapshot;
  if (!user) return { ...disconnectedSnapshot, preview: false };

  const admin = createSupabaseAdminClient();
  const [userSnapshotResult, runtimeResult] = await Promise.all([
    supabase.rpc("current_user_reward_snapshot"),
    admin
      ? admin.rpc("current_pulse_runtime_state")
      : Promise.resolve({ data: null, error: null }),
  ]);

  const rawUserSnapshot = objectValue(userSnapshotResult.data);
  const userSnapshot = String(rawUserSnapshot.user_id ?? "") === user.id
    ? rawUserSnapshot
    : {};
  const runtime = objectValue(runtimeResult.data);
  const config = objectValue(runtime.hourly_pulse);
  const treasury = objectValue(runtime.treasury);

  const configuredReward = Number(config.credits ?? 0);
  const configuredInterval = Number(config.interval_minutes ?? 60);
  const claimRewardCredits = Number.isFinite(configuredReward) && configuredReward > 0 ? configuredReward : 0;
  const claimIntervalMinutes = Number.isFinite(configuredInterval) && configuredInterval >= 15
    ? Math.min(1440, Math.floor(configuredInterval))
    : 60;

  const rawLastClaimAt = typeof userSnapshot.last_claim_at === "string"
    ? userSnapshot.last_claim_at
    : null;
  const lastClaimAt = rawLastClaimAt ? new Date(rawLastClaimAt) : null;
  const validLastClaimAt = lastClaimAt && Number.isFinite(lastClaimAt.getTime()) ? lastClaimAt : null;
  const nextClaimDate = validLastClaimAt
    ? new Date(validLastClaimAt.getTime() + claimIntervalMinutes * 60_000)
    : null;
  const claimReady = !nextClaimDate || nextClaimDate.getTime() <= Date.now();
  const nextClaimAt = claimReady ? null : nextClaimDate?.toISOString() ?? null;

  const availableTreasury =
    Number(treasury.funded_credits ?? 0)
    - Number(treasury.reserved_credits ?? 0)
    - Number(treasury.spent_credits ?? 0);
  const pulseFundingReady = Boolean(
    treasury.enabled === true
    && treasury.kill_switch === false
    && Number(treasury.daily_budget_credits ?? 0) > 0
    && Number(treasury.max_user_daily_credits ?? 0) > 0
    && claimRewardCredits > 0
    && availableTreasury >= claimRewardCredits
  );

  const fallbackLabel = user.email?.split("@")[0] || "Member";
  const handle = typeof userSnapshot.handle === "string" ? userSnapshot.handle.trim() : "";

  return {
    preview: false,
    signedIn: true,
    userLabel: handle || fallbackLabel,
    trustLevel: Number(userSnapshot.trust_level ?? 0),
    availableCredits: Number(userSnapshot.available_credits ?? 0),
    pendingCredits: Number(userSnapshot.pending_credits ?? 0),
    streakDays: Number(userSnapshot.streak_days ?? 0),
    claimReady,
    claimRewardCredits,
    claimIntervalMinutes,
    nextClaimAt,
    pulseFundingReady,
    hourlyClaimCount: Number(userSnapshot.hourly_claim_count ?? 0),
  };
}

export async function getLedgerItems(): Promise<LedgerItem[]> {
  const { supabase, user } = await getCurrentUserContext();
  if (!supabase || !user) return [];

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
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(value);
  if (!signed || credits === 0) return formatted;
  return `${credits > 0 ? "+" : "−"}${formatted}`;
}
