import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Check, Users } from "@/components/icons";
import { CopyReferralLink } from "@/components/copy-referral-link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatUsdFromCredits } from "@/lib/reward-state";

export const metadata = { title: "Invite" };

function configuredSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export default async function InvitePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  let referralCode: string | null = null;
  let pending = 0;
  let rewarded = 0;
  let reversed = 0;
  let referralCredits = 0;
  let inviterBonus: number | null = null;
  let inviteeBonus: number | null = null;

  if (user && supabase) {
    const [profileResult, referralResult, ledgerResult] = await Promise.all([
      supabase.from("profiles").select("referral_code").eq("id", user.id).maybeSingle(),
      supabase.from("referrals").select("status").eq("inviter_id", user.id),
      supabase.from("ledger_entries").select("credits").eq("user_id", user.id).eq("entry_type", "referral"),
    ]);
    referralCode = profileResult.data?.referral_code ?? null;
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
      const inviter = Number(value?.inviter_credits ?? 0);
      const invitee = Number(value?.invitee_credits ?? 0);
      inviterBonus = Number.isFinite(inviter) && inviter >= 0 ? inviter : null;
      inviteeBonus = Number.isFinite(invitee) && invitee >= 0 ? invitee : null;
    }
  }

  const site = configuredSiteUrl();
  const referralLink = user && referralCode && site ? `${site}/r/${referralCode}` : null;
  const milestones = [[1, "First verified friend"], [3, "Small crew"], [5, "Momentum"], [10, "Pulse builder"]] as const;

  return (
    <AppShell active="invite">
      <div className="app-page-head"><div><span className="app-eyebrow">Quality referrals</span><h1>Grow your crew.</h1><p>Referral rewards are created only after a provider-confirmed first earning conversion—not just a signup.</p></div></div>

      <section className="invite-hero-card">
        <div className="invite-hero-icon"><Users /></div>
        <h2>{referralLink ? "Your verified invite link" : user ? "Invite link setup is not complete" : "Sign in to get your invite link"}</h2>
        {referralLink ? (
          <div className="referral-box"><code>{referralLink}</code><CopyReferralLink value={referralLink} /></div>
        ) : user ? (
          <div className="preview-banner">A referral link appears only when your live profile and production site URL are both available.</div>
        ) : (
          <Link className="button button-light" href="/auth?next=/invite">Sign in to continue</Link>
        )}
        {inviterBonus !== null && inviteeBonus !== null ? (
          <p>You receive {formatUsdFromCredits(inviterBonus)} and your friend receives {formatUsdFromCredits(inviteeBonus)} after the first confirmed earning conversion. A qualifying chargeback reverses both bonuses.</p>
        ) : (
          <p>Bonus values appear only after the live referral reward configuration is available.</p>
        )}
      </section>

      <section className="referral-stats"><article><span>Verified friends</span><strong>{user ? rewarded : "—"}</strong><small>{user ? "bonus earned" : "sign in required"}</small></article><article><span>Pending</span><strong>{user ? pending : "—"}</strong><small>{user ? "waiting for first conversion" : "sign in required"}</small></article><article><span>Referral rewards</span><strong>{user ? formatUsdFromCredits(referralCredits) : "—"}</strong><small>{user ? "net of reversals" : "live ledger required"}</small></article><article><span>Reversed</span><strong>{user ? reversed : "—"}</strong><small>{user ? "qualifying conversion reversed" : "sign in required"}</small></article></section>

      <section className="milestones"><div className="app-section-head"><div><span className="app-eyebrow">Crew milestones</span><h2>Visible progress, no fake promises</h2></div></div>{milestones.map(([n,title]) => { const done = Boolean(user) && rewarded >= n; return <div className={`milestone-row ${done ? "done" : ""}`} key={n}><span className="milestone-number">{done ? <Check /> : n}</span><div><strong>{title}</strong><small>{n} verified active {n === 1 ? "referral" : "referrals"}</small></div><b>{!user ? "Sign in" : done ? "Unlocked" : `${Math.max(0, n - rewarded)} to go`}</b></div>; })}</section>
    </AppShell>
  );
}
