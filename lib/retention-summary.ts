import { getCurrentUserContext } from "@/lib/current-user-context";

export type WeeklyPulseSummary = {
  available: boolean;
  claims7d: number;
  activeDays7d: number;
  pulseCredits7d: number;
  previousClaims7d: number;
  trend: "starting" | "rising" | "steady" | "cooling";
  latestClaimAt: string | null;
};

const EMPTY: WeeklyPulseSummary = {
  available: false,
  claims7d: 0,
  activeDays7d: 0,
  pulseCredits7d: 0,
  previousClaims7d: 0,
  trend: "starting",
  latestClaimAt: null,
};

function dayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export async function getWeeklyPulseSummary(): Promise<WeeklyPulseSummary> {
  const { supabase, user } = await getCurrentUserContext();
  if (!supabase || !user) return EMPTY;

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("pulse_claims")
    .select("created_at,reward_credits")
    .eq("user_id", user.id)
    .gte("created_at", fourteenDaysAgo)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[retention-summary] pulse_claims query failed", error.code);
    return EMPTY;
  }

  const rows = data ?? [];
  const current = rows.filter((row) => String(row.created_at) >= sevenDaysAgo);
  const previous = rows.filter((row) => String(row.created_at) < sevenDaysAgo);
  const claims7d = current.length;
  const previousClaims7d = previous.length;
  const activeDays7d = new Set(current.map((row) => dayKey(String(row.created_at)))).size;
  const pulseCredits7d = current.reduce((sum, row) => sum + Math.max(0, Number(row.reward_credits ?? 0)), 0);

  const trend: WeeklyPulseSummary["trend"] = claims7d === 0 && previousClaims7d === 0
    ? "starting"
    : claims7d > previousClaims7d
      ? "rising"
      : claims7d < previousClaims7d
        ? "cooling"
        : "steady";

  return {
    available: true,
    claims7d,
    activeDays7d,
    pulseCredits7d,
    previousClaims7d,
    trend,
    latestClaimAt: rows[0]?.created_at ? String(rows[0].created_at) : null,
  };
}
