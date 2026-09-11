import { AppShell } from "@/components/app-shell";
import { Check, Users } from "@/components/icons";

export const metadata = { title: "Invite" };

export default function InvitePage() {
  return (
    <AppShell active="invite">
      <div className="app-page-head"><div><span className="app-eyebrow">Quality referrals</span><h1>Grow your crew.</h1><p>You both unlock rewards after a verified first quest—not just a signup.</p></div></div>
      <section className="invite-hero-card"><div className="invite-hero-icon"><Users /></div><h2>Your invite link</h2><div className="referral-box"><code>rewardpulse.com/r/yourname</code><button>Copy</button></div><p>Share with people who will actually use Reward Pulse. Active referrals are more valuable than empty registrations.</p></section>
      <section className="milestones"><div className="app-section-head"><div><span className="app-eyebrow">Milestones</span><h2>Progress that compounds</h2></div></div>{[[1,"First active friend","+50 credits",true],[3,"Small crew","+100 credits",true],[5,"Momentum","+200 credits",false],[10,"Pulse builder","Bonus level",false]].map(([n,title,reward,done]) => <div className={`milestone-row ${done ? "done" : ""}`} key={String(n)}><span className="milestone-number">{done ? <Check /> : n}</span><div><strong>{title}</strong><small>{n} verified active {Number(n) === 1 ? "referral" : "referrals"}</small></div><b>{reward}</b></div>)}</section>
    </AppShell>
  );
}
