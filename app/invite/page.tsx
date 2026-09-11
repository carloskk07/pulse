import { AppShell } from "@/components/app-shell";
import { Check, Users } from "@/components/icons";
import { CopyReferralLink } from "@/components/copy-referral-link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatUsdFromCredits } from "@/lib/reward-state";

export const metadata = { title: "Invite" };

const previewCode = "a1b2c3d4e5f60708";

export default async function InvitePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  let referralCode = previewCode;
  let pending = 0;
  let rewarded = 0;
  let reversed = 0;
  let referralCredits = 0;
  let inviterBonus = 100;
  let inviteeBonus = 50;

  if (user && supabase) {
    const [profileResult, referralResult, ledgerResult] = await Promise.all([
      supabase.from("profiles").select("referral_code").eq("id", user.id).maybeSingle(),
      supabase.from("referrals").select("status").eq("inviter_id", user.id),
      supabase.from("ledger_entries").select("credits").eq("user_id", user.id).eq("entry_type", "referral"),
    ]);
    referralCode = profileResult.data?.referral_code || referralCode;
    for (const row of referralResult.data ?? []) {
      if (row.status === "pending") pending += 1;
      if (row.status === "rewarded") rewarded += 1;
      if (row.status === "reversed") reversed += 1;
    }
    referralCredits = (ledgerResult.data ?? []).reduce((sum, row) => sum + Number(row.credits ?? 0), 0);

    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data: config } = await admin.from("app_config").select("value").eq("key", "referral_reward").maybeSingle();
      const value = config?.value as { inviter_credits?: number; invitee_credits?: number } | null;
      inviterBonus = Number(value?.inviter_credits ?? inviterBonus);
      inviteeBonus = Number(value?.invitee_credits ?? inviteeBonus);
    }
  }

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://rewardpulse.example").replace(/\/$/, "");
  const referralLink = `${site}/r/${referralCode}`;
  const milestones = [[1, "First verified friend"], [3, "Small crew"], [5, "Momentum"], [10, "Pulse builder"]] as const;

  return (
    <AppShell active="invite">
      <div className="app-page-head"><div><span className="app-eyebrow">Quality referrals</span><h1>Grow your crew.</h1><p>You both unlock rewards after a provider-confirmed first earning conversion—not just a signup.</p></div></div>
      <section className="invite-hero-card"><div className="invite-hero-icon"><Users /></div><h2>Your verified invite link</h2><div className="referral-box"><code>{referralLink}</code><CopyReferralLink value={referralLink} /></div><p>You receive {formatUsdFromCredits(inviterBonus)} and your friend receives {formatUsdFromCredits(inviteeBonus)} after the first confirmed earning conversion. A qualifying chargeback reverses both bonuses.</p></section>

      <section className="referral-stats"><article><span>Verified friends</span><strong>{rewarded}</strong><small>bonus earned</small></article><article><span>Pending</span><strong>{pending}</strong><small>waiting for first conversion</small></article><article><span>Referral rewards</span><strong>{formatUsdFromCredits(referralCredits)}</strong><small>net of reversals</small></article><article><span>Reversed</span><strong>{reversed}</strong><small>qualifying conversion reversed</small></article></section>

      <section className="milestones"><div className="app-section-head"><div><span className="app-eyebrow">Crew milestones</span><h2>Visible progress, no fake promises</h2></div></div>{milestones.map(([n,title]) => { const done = rewarded >= n; return <div className={`milestone-row ${done ? "done" : ""}`} key={n}><span className="milestone-number">{done ? <Check /> : n}</span><div><strong>{title}</strong><small>{n} verified active {n === 1 ? "referral" : "referrals"}</small></div><b>{done ? "Unlocked" : `${Math.max(0, n - rewarded)} to go`}</b></div>; })}</section>
    </AppShell>
  );
}
