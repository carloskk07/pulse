import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Check, Users } from "@/components/icons";
import { CopyReferralLink } from "@/components/copy-referral-link";
import { getInviteState } from "@/lib/invite-state";
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
  const {
    signedIn,
    referralCode,
    pending,
    rewarded,
    reversed,
    referralCredits,
    inviterBonus,
    inviteeBonus,
  } = await getInviteState();

  const site = configuredSiteUrl();
  const referralLink = signedIn && referralCode && site ? `${site}/r/${referralCode}` : null;
  const milestones = [[1, "First connection"], [3, "Inner circle"], [5, "Momentum crew"], [10, "Circuit builder"]] as const;

  return (
    <AppShell active="invite">
      <div className="app-page-head pc-luxe-share-head"><div><span className="app-eyebrow">Invite</span><h1>Share the circuit. Count only real activity.</h1><p>Your link can be shared anytime. Referral value appears only when the current verified-reward rule is active.</p></div></div>

      <section className="invite-hero-card pc-luxe-invite-hero">
        <div className="pc-invite-copy">
          <div className="invite-hero-icon"><Users /></div>
          <span className="app-eyebrow">Your invite link</span>
          <h2>{referralLink ? "Invite someone into the climb." : signedIn ? "Your share link is almost ready." : "Enter the circuit to start sharing."}</h2>
          {referralLink ? (
            <div className="referral-box pc-luxe-referral-box"><code>{referralLink}</code><CopyReferralLink value={referralLink} /></div>
          ) : signedIn ? (
            <div className="preview-banner">The link appears when your live profile and production site URL are both available.</div>
          ) : (
            <Link className="button button-light" href="/auth?next=/invite">Sign in to continue</Link>
          )}
          {inviterBonus !== null && inviteeBonus !== null ? (
            <p>After the first qualifying verified activity: you receive {formatUsdFromCredits(inviterBonus)} and your friend receives {formatUsdFromCredits(inviteeBonus)}. Reversed qualification reverses both bonuses.</p>
          ) : (
            <p>Bonus values appear only when the current referral rule is active.</p>
          )}
        </div>
        <div className="pc-invite-scene" aria-hidden="true"><span>Verified activity only</span></div>
      </section>

      {signedIn && (inviterBonus === null || inviteeBonus === null) ? (
        <div className="pc-v10-referral-status">
          <strong>Sharing is active. Referral rewards are not active right now.</strong>
          <span>Your link and verified progress can still be shared; no bonus is implied until a live rule publishes one.</span>
        </div>
      ) : null}

      <section className="pc-luxe-share-stats">
        <article><small>Verified</small><strong>{signedIn ? rewarded : "—"}</strong><span>real active referrals</span></article>
        <article><small>Pending</small><strong>{signedIn ? pending : "—"}</strong><span>awaiting qualification</span></article>
        <article><small>Referral value</small><strong>{signedIn ? formatUsdFromCredits(referralCredits) : "—"}</strong><span>net ledger value</span></article>
      </section>

      <details className="pc-share-preview pc-luxe-referral-preview"><summary><strong>Invite quality details</strong></summary>
        <article className="pc-share-card pc-luxe-share-poster"><small>Share preview</small><h3>Bring someone into your <em>rhythm.</em></h3><p>Progress begins after real activity — not after an empty signup.</p></article>
        <article className="pc-share-card pc-luxe-share-score"><small>Quality signal</small><h3>{signedIn ? `${rewarded} verified` : "—"}</h3><p>{signedIn ? "Only qualified referrals move the milestones." : "Sign in to reveal your progress."}</p></article>
      </details>

      <details className="milestones pc-luxe-referral-milestones"><summary><strong>Invite milestones</strong></summary><div className="app-section-head"><div><span className="app-eyebrow">Share milestones</span><h2>Build a real circle.</h2></div></div>{milestones.map(([n,title]) => { const done = signedIn && rewarded >= n; return <div className={`milestone-row ${done ? "done" : ""}`} key={n}><span className="milestone-number">{done ? <Check /> : n}</span><div><strong>{title}</strong><small>{n} verified {n === 1 ? "referral" : "referrals"}</small></div><b>{!signedIn ? "Locked" : done ? "Unlocked" : `${Math.max(0, n - rewarded)} to go`}</b></div>; })}</details>

      {signedIn && reversed > 0 ? <div className="pc-luxe-reversal-note">{reversed} referral qualification{reversed === 1 ? " was" : "s were"} reversed and excluded from progress.</div> : null}
    </AppShell>
  );
}
