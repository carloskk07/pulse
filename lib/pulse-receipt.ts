import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RecentPulseReceipt = {
  createdAt: string;
  rewardCredits: number;
};

const RECENT_CLAIM_WINDOW_MS = 10 * 60_000;

export async function getRecentPulseReceipt(): Promise<RecentPulseReceipt | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("pulse_claims")
    .select("created_at,reward_credits")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.created_at) return null;

  const createdAt = String(data.created_at);
  const createdMs = new Date(createdAt).getTime();
  const ageMs = Date.now() - createdMs;
  if (!Number.isFinite(createdMs) || ageMs < -30_000 || ageMs > RECENT_CLAIM_WINDOW_MS) return null;

  const rewardCredits = Math.max(0, Number(data.reward_credits) || 0);
  return { createdAt, rewardCredits };
}
