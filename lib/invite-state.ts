import { getCurrentUserContext } from "@/lib/current-user-context";
import { objectValue } from "@/lib/reward-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type InviteState = {
  signedIn: boolean;
  referralCode: string | null;
  pending: number;
  rewarded: number;
  reversed: number;
  referralCredits: number;
  inviterBonus: number | null;
  inviteeBonus: number | null;
};

const EMPTY: InviteState = {
  signedIn: false,
  referralCode: null,
  pending: 0,
  rewarded: 0,
  reversed: 0,
  referralCredits: 0,
  inviterBonus: null,
  inviteeBonus: null,
};

function nonNegativeInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function nonNegativeBonus(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function getInviteState(): Promise<InviteState> {
  const { supabase, user } = await getCurrentUserContext();
  if (!supabase || !user) return EMPTY;

  const admin = createSupabaseAdminClient();
  const [userResult, runtimeResult] = await Promise.all([
    supabase.rpc("current_user_invite_state"),
    admin
      ? admin.rpc("current_invite_runtime_state")
      : Promise.resolve({ data: null, error: null }),
  ]);

  const rawUser = objectValue(userResult.data);
  const scopedUser = String(rawUser.user_id ?? "") === user.id ? rawUser : {};
  const runtime = objectValue(runtimeResult.data);
  const reward = objectValue(runtime.referral_reward);
  const rawCode = typeof scopedUser.referral_code === "string"
    ? scopedUser.referral_code.trim()
    : "";

  return {
    signedIn: true,
    referralCode: rawCode || null,
    pending: nonNegativeInteger(scopedUser.pending),
    rewarded: nonNegativeInteger(scopedUser.rewarded),
    reversed: nonNegativeInteger(scopedUser.reversed),
    referralCredits: Number(scopedUser.referral_credits ?? 0) || 0,
    inviterBonus: nonNegativeBonus(reward.inviter_credits),
    inviteeBonus: nonNegativeBonus(reward.invitee_credits),
  };
}
