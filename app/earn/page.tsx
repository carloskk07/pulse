import { AppShell } from "@/components/app-shell";
import { OfferCard } from "@/components/offer-card";
import { offers } from "@/lib/mock-data";

export const metadata = { title: "Earn" };

export default function EarnPage() {
  return (
    <AppShell active="earn">
      <div className="app-page-head"><div><span className="app-eyebrow">Opportunity feed</span><h1>Earn</h1><p>Clear time, clear reward, better matches first.</p></div><div className="balance-chip"><small>Available</small><strong>$4.82</strong></div></div>
      <div className="filter-row"><button className="filter-chip active">For you</button><button className="filter-chip">Quick</button><button className="filter-chip">Surveys</button><button className="filter-chip">Apps</button><button className="filter-chip">Quests</button></div>
      <section className="earn-feature"><div><span className="section-kicker">97% match</span><h2>Four minutes. One useful opinion. +$0.42.</h2><p>The feed leads with expected usefulness—not noisy headline payouts.</p></div><div className="earn-feature-metric"><strong>81%</strong><span>completion rate</span></div></section>
      <section className="offers-app-grid four">{offers.map((offer, index) => <OfferCard key={offer.id} offer={offer} featured={index === 0} />)}</section>
    </AppShell>
  );
}
