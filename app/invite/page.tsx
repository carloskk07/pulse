import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Check, Users } from "@/components/icons";
import { CopyReferralLink } from "@/components/copy-referral-link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatUsdFromCredits } from "@/lib/reward-state";

export const metadata = { title: "Share" };

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
  const milestones = [[1, "First connection"], [3, "Inner circle"], [5, "Momentum crew"], [10, "Circuit builder"]] as const;

  return (
    <AppShell active="invite">
      <div className="app-page-head pc-luxe-share-head"><div><span className="app-eyebrow">Share</span><h1>Make your momentum contagious.</h1><p>One link. Real people. Verified milestones.</p></div></div>

      <section className="invite-hero-card pc-luxe-invite-hero">
        <div className="invite-hero-icon"><Users /></div>
        <span className="app-eyebrow">Your circuit link</span>
        <h2>{referralLink ? "Invite someone into the climb." : user ? "Your share link is almost ready." : "Enter the circuit to start sharing."}</h2>
        {referralLink ? (
          <div className="referral-box pc-luxe-referral-box"><code>{referralLink}</code><CopyReferralLink value={referralLink} /></div>
        ) : user ? (
          <div className="preview-banner">The link appears when your live profile and production site URL are both available.</div>
        ) : (
          <Link className="button button-light" href="/auth?next=/invite">Sign in to continue</Link>
        )}
        {inviterBonus !== null && inviteeBonus !== null ? (
          <p>After the first confirmed Turbo conversion: you receive {formatUsdFromCredits(inviterBonus)} and your friend receives {formatUsdFromCredits(inviteeBonus)}. Reversed qualification reverses both bonuses.</p>
        ) : (
          <p>Bonus values appear only when the live referral configuration is active.</p>
        )}
      </section>

      <section className="pc-luxe-share-stats">
        <article><small>Verified</small><strong>{user ? rewarded : "—"}</strong><span>real active referrals</span></article>
        <article><small>Pending</small><strong>{user ? pending : "—"}</strong><span>awaiting qualification</span></article>
        <article><small>Referral value</small><strong>{user ? formatUsdFromCredits(referralCredits) : "—"}</strong><span>net ledger value</span></article>
      </section>

      <section className="pc-share-preview pc-luxe-referral-preview" aria-label="Pulsercuit share experience">
        <article className="pc-share-card pc-luxe-share-poster"><small>Share preview</small><h3>Bring someone into your <em>rhythm.</em></h3><p>Progress begins after real activity — not after an empty signup.</p></article>
        <article className="pc-share-card pc-luxe-share-score"><small>Quality signal</small><h3>{user ? `${rewarded} verified` : "—"}</h3><p>{user ? "Only qualified referrals move the milestones." : "Sign in to reveal your progress."}</p></article>
      </section>

      <section className="milestones pc-luxe-referral-milestones"><div className="app-section-head"><div><span className="app-eyebrow">Share milestones</span><h2>Build a real circle.</h2></div></div>{milestones.map(([n,title]) => { const done = Boolean(user) && rewarded >= n; return <div className={`milestone-row ${done ? "done" : ""}`} key={n}><span className="milestone-number">{done ? <Check /> : n}</span><div><strong>{title}</strong><small>{n} verified {n === 1 ? "referral" : "referrals"}</small></div><b>{!user ? "Locked" : done ? "Unlocked" : `${Math.max(0, n - rewarded)} to go`}</b></div>; })}</section>

      {user && reversed > 0 ? <div className="pc-luxe-reversal-note">{reversed} referral qualification{reversed === 1 ? " was" : "s were"} reversed and excluded from progress.</div> : null}
    </AppShell>
  );
}
