import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RewardSnapshot = {
  preview: boolean;
  signedIn: boolean;
  userLabel: string;
  trustLevel: number;
  riskScore: number;
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
  riskScore: 0,
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
  const supabase = await createSupabaseServerClient();
  if (!supabase) return disconnectedSnapshot;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...disconnectedSnapshot, preview: false };

  const admin = createSupabaseAdminClient();
  const [balanceResult, pulseClaimsResult, legacyClaimsResult, profileResult, pulseConfigResult] = await Promise.all([
    supabase.from("user_balances").select("available_credits,pending_credits").eq("user_id", user.id).maybeSingle(),
    supabase.from("pulse_claims").select("created_at,reward_credits").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("claims").select("claim_day,reward_credits").eq("user_id", user.id).order("claim_day", { ascending: false }).limit(60),
    supabase.from("profiles").select("handle,trust_level,risk_score").eq("id", user.id).maybeSingle(),
    admin ? admin.from("app_config").select("value").eq("key", "hourly_pulse").maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const config = pulseConfigResult.data?.value as { credits?: number | string; interval_minutes?: number | string; treasury_code?: string } | null | undefined;
  const configuredReward = Number(config?.credits ?? 0);
  const configuredInterval = Number(config?.interval_minutes ?? 60);
  const claimRewardCredits = Number.isFinite(configuredReward) && configuredReward > 0 ? configuredReward : 0;
  const claimIntervalMinutes = Number.isFinite(configuredInterval) && configuredInterval >= 15 ? Math.min(1440, Math.floor(configuredInterval)) : 60;
  const treasuryCode = config?.treasury_code?.trim() || "launch";

  const treasuryResult = admin
    ? await admin.from("reward_treasuries").select("funded_credits,reserved_credits,spent_credits,enabled,kill_switch,daily_budget_credits,max_user_daily_credits").eq("code", treasuryCode).maybeSingle()
    : { data: null };

  const pulseClaims = pulseClaimsResult.data ?? [];
  const legacyClaims = legacyClaimsResult.data ?? [];
  const lastClaimAt = pulseClaims[0]?.created_at ? new Date(String(pulseClaims[0].created_at)) : null;
  const nextClaimDate = lastClaimAt ? new Date(lastClaimAt.getTime() + claimIntervalMinutes * 60_000) : null;
  const claimReady = !nextClaimDate || nextClaimDate.getTime() <= Date.now();
  const nextClaimAt = claimReady ? null : nextClaimDate?.toISOString() ?? null;

  const claimDays = [
    ...pulseClaims.map((claim) => utcDay(new Date(String(claim.created_at)))),
    ...legacyClaims.map((claim) => String(claim.claim_day)),
  ];

  const treasury = treasuryResult.data;
  const availableTreasury = Number(treasury?.funded_credits ?? 0) - Number(treasury?.reserved_credits ?? 0) - Number(treasury?.spent_credits ?? 0);
  const pulseFundingReady = Boolean(
    treasury?.enabled === true &&
    treasury?.kill_switch === false &&
    Number(treasury?.daily_budget_credits ?? 0) > 0 &&
    Number(treasury?.max_user_daily_credits ?? 0) > 0 &&
    claimRewardCredits > 0 &&
    availableTreasury >= claimRewardCredits
  );

  const fallbackLabel = user.email?.split("@")[0] || "Member";

  return {
    preview: false,
    signedIn: true,
    userLabel: profileResult.data?.handle || fallbackLabel,
    trustLevel: Number(profileResult.data?.trust_level ?? 0),
    riskScore: Number(profileResult.data?.risk_score ?? 0),
    availableCredits: Number(balanceResult.data?.available_credits ?? 0),
    pendingCredits: Number(balanceResult.data?.pending_credits ?? 0),
    streakDays: streakFromClaims(claimDays),
    claimReady,
    claimRewardCredits,
    claimIntervalMinutes,
    nextClaimAt,
    pulseFundingReady,
    hourlyClaimCount: pulseClaims.length,
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
