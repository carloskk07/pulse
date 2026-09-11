import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Bolt, Check, Spark, Users } from "@/components/icons";
import { OfferCard } from "@/components/offer-card";
import { offers } from "@/lib/mock-data";

export const metadata = { title: "Home" };

export default function DashboardPage() {
  return (
    <AppShell active="home">
      <div className="app-page-head"><div><span className="app-eyebrow">Friday pulse</span><h1>Good evening.</h1></div><div className="balance-chip"><small>Available</small><strong>$4.82</strong></div></div>

      <section className="dashboard-hero">
        <div className="daily-pulse-card">
          <div className="daily-pulse-copy"><span className="status-pill status-lime"><Spark /> Day 6</span><h2>Your Daily Pulse is ready.</h2><p>Keep your streak alive and move one step closer to your next withdrawal.</p><button className="button button-light">Claim +12 credits <ArrowUpRight /></button></div>
          <div className="streak-visual" aria-label="6 day streak"><div className="streak-ring"><span>6</span><small>days</small></div><div className="streak-days">{[1,2,3,4,5,6,7].map((day) => <span key={day} className={day <= 6 ? "done" : ""}>{day <= 6 ? <Check /> : day}</span>)}</div></div>
        </div>
      </section>

      <section className="app-section"><div className="app-section-head"><div><span className="app-eyebrow">Best for you</span><h2>High-value matches</h2></div><Link href="/earn">See all <ArrowUpRight /></Link></div><div className="offers-app-grid">{offers.slice(0,3).map((offer, index) => <OfferCard key={offer.id} offer={offer} featured={index === 0} />)}</div></section>

      <section className="dashboard-lower-grid">
        <article className="progress-card"><div className="app-eyebrow">First withdrawal</div><div className="progress-value"><strong>$4.82</strong><span>/ $5.00</span></div><div className="progress-track large"><span style={{width:"96.4%"}} /></div><p>You&apos;re only <strong>$0.18 away.</strong></p><Link href="/earn" className="inline-action"><Bolt /> Find a quick reward</Link></article>
        <article className="invite-card"><div className="invite-icon"><Users /></div><div><span className="app-eyebrow">Grow together</span><h3>Your next active invite unlocks a bonus.</h3><p>Rewards activate after your friend completes a verified quest.</p></div><Link href="/invite" className="icon-button"><ArrowUpRight /></Link></article>
      </section>
    </AppShell>
  );
}
