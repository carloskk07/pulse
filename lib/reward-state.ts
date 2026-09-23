import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserContext, type CurrentUserIdentity } from "@/lib/current-user-context";

const PULSE_RUNTIME_CACHE_TTL_MS = 1_000;

type PulseRuntimeCache = {
  value: unknown;
  expiresAt: number;
};

let cachedPulseRuntime: PulseRuntimeCache | null = null;
let pulseRuntimeInFlight: Promise<unknown> | null = null;

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
  claimRewardVariable: boolean;
  claimRewardMinCredits: number;
  claimRewardMaxCredits: number;
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

export const disconnectedSnapshot: RewardSnapshot = {
  preview: true,
  signedIn: false,
  userLabel: "Preview",
  trustLevel: 0,
  availableCredits: 0,
  pendingCredits: 0,
  streakDays: 0,
  claimReady: false,
  claimRewardCredits: 0,
  claimRewardVariable: false,
  claimRewardMinCredits: 0,
  claimRewardMaxCredits: 0,
  claimIntervalMinutes: 60,
  nextClaimAt: null,
  pulseFundingReady: false,
  hourlyClaimCount: 0,
};

export function objectValue(value: unknown) {
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
    withdrawal_fee: "Extra withdrawal fee",
    chargeback: "Reward reversed",
    adjustment: "Balance adjustment",
    cashback: "Cashback confirmed",
    network_commission: "Network contribution",
  };
  return labels[type] ?? "Reward activity";
}

export function ledgerItemsFromRows(value: unknown): LedgerItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const row = objectValue(entry);
    return {
      id: String(row.id ?? ""),
      label: labelForEntry(String(row.entry_type ?? "")),
      state: String(row.state ?? ""),
      credits: Number(row.credits ?? 0),
      createdAt: String(row.created_at ?? ""),
    };
  }).filter((entry) => Boolean(entry.id));
}

export function trustLabel(level: number) {
  if (level >= 5) return "Trusted";
  if (level >= 4) return "Established";
  if (level >= 3) return "Verified";
  if (level >= 2) return "Consistent";
  if (level >= 1) return "Active";
  return "Building";
}

async function getPulseRuntimeState(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
) {
  const now = Date.now();
  if (cachedPulseRuntime && cachedPulseRuntime.expiresAt > now) {
    return cachedPulseRuntime.value;
  }

  if (pulseRuntimeInFlight) return pulseRuntimeInFlight;

  pulseRuntimeInFlight = (async () => {
    const { data, error } = await admin.rpc("current_pulse_runtime_state");
    if (error || !data) return null;
    return data;
  })();

  try {
    const value = await pulseRuntimeInFlight;
    if (value !== null) {
      cachedPulseRuntime = {
        value,
        expiresAt: Date.now() + PULSE_RUNTIME_CACHE_TTL_MS,
      };
    }
    return value;
  } finally {
    pulseRuntimeInFlight = null;
  }
}

export function buildRewardSnapshotFromPayload(
  user: CurrentUserIdentity,
  rawUserSnapshot: unknown,
  rawRuntime: unknown,
): RewardSnapshot {
  const candidate = objectValue(rawUserSnapshot);
  const userSnapshot = String(candidate.user_id ?? "") === user.id ? candidate : {};
  const runtime = objectValue(rawRuntime);
  const config = objectValue(runtime.hourly_pulse);
  const treasury = objectValue(runtime.treasury);
  const economy = objectValue(runtime.economy);

  const configuredReward = Number(config.credits ?? 0);
  const configuredInterval = Number(config.interval_minutes ?? 60);
  const claimRewardCredits = Number.isFinite(configuredReward) && configuredReward > 0 ? configuredReward : 0;
  const rewardBands = Array.isArray(economy.reward_bands)
    ? economy.reward_bands.map(objectValue)
    : [];
  const variableConfigured = String(economy.variable_reward_enabled ?? "false").toLowerCase() === "true";
  const variableReviewRequired = String(economy.variable_reward_review_required ?? "true").toLowerCase() !== "false";
  const validBandCredits = rewardBands
    .map((band) => Number(band.credits ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const claimRewardVariable = variableConfigured && !variableReviewRequired && validBandCredits.length > 0;
  const claimRewardMinCredits = claimRewardVariable ? Math.min(...validBandCredits) : claimRewardCredits;
  const claimRewardMaxCredits = claimRewardVariable ? Math.max(...validBandCredits) : claimRewardCredits;
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
  const dailyBudgetCredits = Number(treasury.daily_budget_credits ?? 0);
  const maxUserDailyCredits = Number(treasury.max_user_daily_credits ?? 0);
  const pilotMode = String(config.pilot_mode ?? "false").toLowerCase() === "true";
  const publicFairShareReady = pilotMode || (
    dailyBudgetCredits > 0
    && maxUserDailyCredits > 0
    && maxUserDailyCredits * 2 <= dailyBudgetCredits
  );
  const pulseFundingReady = Boolean(
    treasury.enabled === true
    && treasury.kill_switch === false
    && dailyBudgetCredits > 0
    && maxUserDailyCredits > 0
    && publicFairShareReady
    && claimRewardMaxCredits > 0
    && availableTreasury >= claimRewardMaxCredits
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
    claimRewardVariable,
    claimRewardMinCredits,
    claimRewardMaxCredits,
    claimIntervalMinutes,
    nextClaimAt,
    pulseFundingReady,
    hourlyClaimCount: Number(userSnapshot.hourly_claim_count ?? 0),
  };
}

export async function getRewardSnapshot(): Promise<RewardSnapshot> {
  const { supabase, user } = await getCurrentUserContext();
  if (!supabase) return disconnectedSnapshot;
  if (!user) return { ...disconnectedSnapshot, preview: false };

  const admin = createSupabaseAdminClient();
  const [userSnapshotResult, runtimeData] = await Promise.all([
    supabase.rpc("current_user_reward_snapshot"),
    admin ? getPulseRuntimeState(admin) : Promise.resolve(null),
  ]);

  return buildRewardSnapshotFromPayload(
    user,
    userSnapshotResult.data,
    runtimeData,
  );
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

  return ledgerItemsFromRows(data);
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
