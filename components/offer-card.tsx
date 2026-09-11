import { ArrowUpRight, Clock } from "./icons";
import type { Offer } from "@/lib/mock-data";
import { formatUsd } from "@/lib/credits";

export function OfferCard({ offer, featured = false }: { offer: Offer; featured?: boolean }) {
  return (
    <article className={`offer-card ${featured ? "offer-card-featured" : ""}`}>
      <div className="offer-topline">
        <span className="offer-type">{offer.category}</span>
        <span className="offer-match">{offer.match}% match</span>
      </div>
      <div className="offer-copy">
        <h3>{offer.title}</h3>
        <div className="offer-meta"><span><Clock /> ~{offer.minutes} min</span><span>{offer.badge}</span></div>
      </div>
      <div className="offer-footer">
        <div><small>Reward</small><strong>{formatUsd(offer.rewardUsd)}</strong></div>
        <button className="icon-button" aria-label={`Start ${offer.title}`}><ArrowUpRight /></button>
      </div>
    </article>
  );
}
