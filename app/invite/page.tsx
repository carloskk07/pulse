import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Check, Users } from "@/components/icons";
import { CopyReferralLink } from "@/components/copy-referral-link";
import { NetworkDepthPanel } from "@/components/network-depth-panel";
import { ReferralNetworkArtwork } from "@/components/pulse-visuals";
import { getInviteState } from "@/lib/invite-state";
import { formatUsdFromCredits } from "@/lib/reward-state";

export const metadata = { title: "Referrals" };

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
  const milestones = [[1, "First referral"], [3, "Growing circle"], [5, "Active network"], [10, "Referral milestone"]] as const;

  return (
    <AppShell active="invite">
      <div className="app-page-head pc-luxe-share-head"><div><span className="app-eyebrow">Referrals</span><h1>Invite friends. See the reward before you share.</h1><p>Referral rewards are tied to verified eligible activity. When a bonus is active, its money value appears here before you send your link.</p></div></div>

      <section className="invite-hero-card pc-luxe-invite-hero">
        <div className="pc-invite-copy">
          <div className="invite-hero-icon"><Users /></div>
          <span className="app-eyebrow">Your invite link</span>
          <h2>{referralLink ? "Share your referral link." : signedIn ? "Your referral link is almost ready." : "Sign in to start referring."}</h2>
          {referralLink ? (
            <div className="referral-box pc-luxe-referral-box"><code>{referralLink}</code><CopyReferralLink value={referralLink} /></div>
          ) : signedIn ? (
            <div className="preview-banner">Your link appears when your profile is ready.</div>
          ) : (
            <Link className="button button-light" href="/auth?next=/invite">Sign in to continue</Link>
          )}
          {inviterBonus !== null && inviteeBonus !== null ? (
            <p>After your friend completes their first eligible activity: you receive {formatUsdFromCredits(inviterBonus)} and your friend receives {formatUsdFromCredits(inviteeBonus)}. If that activity is reversed, the linked bonuses are reversed too.</p>
          ) : (
            <p>Bonus values appear when a referral reward is active.</p>
          )}
        </div>
        <div className="pc-invite-visual-stage" aria-hidden="true">
          <ReferralNetworkArtwork active={signedIn ? rewarded : "—"} waiting={signedIn ? pending : "—"} />
        </div>
      </section>

      {signedIn && (inviterBonus === null || inviteeBonus === null) ? (
        <div className="pc-v10-referral-status">
          <strong>Sharing is available. Referral rewards are off right now.</strong>
          <span>You can still share your link; bonuses return only when a live referral rule is active.</span>
        </div>
      ) : null}

      <NetworkDepthPanel />

      <section className="pc-luxe-share-stats">
        <article><small>Active</small><strong>{signedIn ? rewarded : "—"}</strong><span>confirmed referrals</span></article>
        <article><small>Waiting</small><strong>{signedIn ? pending : "—"}</strong><span>first activity pending</span></article>
        <article><small>Rewards</small><strong>{signedIn ? formatUsdFromCredits(referralCredits) : "—"}</strong><span>net referral value</span></article>
      </section>

      <details className="pc-share-preview pc-luxe-referral-preview"><summary><strong>Invite details</strong></summary>
        <article className="pc-share-card pc-luxe-share-poster"><small>Share preview</small><h3>Invite someone to <em>earn with you.</em></h3><p>Referral progress starts only after eligible activity is verified.</p></article>
        <article className="pc-share-card pc-luxe-share-score"><small>Referral progress</small><h3>{signedIn ? `${rewarded} active` : "—"}</h3><p>{signedIn ? "Active referrals move the milestones." : "Sign in to reveal your progress."}</p></article>
      </details>

      <details className="milestones pc-luxe-referral-milestones"><summary><strong>Invite milestones</strong></summary><div className="app-section-head"><div><span className="app-eyebrow">Referral milestones</span><h2>Grow through verified activity.</h2></div></div>{milestones.map(([n,title]) => { const done = signedIn && rewarded >= n; return <div className={`milestone-row ${done ? "done" : ""}`} key={n}><span className="milestone-number">{done ? <Check /> : n}</span><div><strong>{title}</strong><small>{n} verified {n === 1 ? "referral" : "referrals"}</small></div><b>{!signedIn ? "Locked" : done ? "Unlocked" : `${Math.max(0, n - rewarded)} to go`}</b></div>; })}</details>

      {signedIn && reversed > 0 ? <div className="pc-luxe-reversal-note">{reversed} referral qualification{reversed === 1 ? " was" : "s were"} reversed and excluded from progress.</div> : null}
    </AppShell>
  );
}
