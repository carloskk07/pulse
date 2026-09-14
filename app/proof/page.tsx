import Link from "next/link";
import { ArrowUpRight, Check, Shield, Spark } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { getPulseProof } from "@/lib/pulse-proof";
import { formatUsdFromCredits } from "@/lib/reward-state";

export const metadata = {
  title: "Pulsercuit Proof",
  description: "Live, aggregate proof of Pulse claims, credited rewards, Turbo conversions and completed payouts.",
};

function formatGeneratedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(date)} UTC`;
}

export default async function ProofPage() {
  const proof = await getPulseProof();
  const generatedAt = formatGeneratedAt(proof.generatedAt);

  return (
    <main className="proof-page">
      <SiteHeader />
      <section className="proof-hero shell">
        <span className="section-kicker">Pulsercuit Proof</span>
        <h1>Only what actually happened.</h1>
        <p>These numbers come from the authoritative production database. Pulsercuit does not create sample users, simulated payouts or synthetic activity to make this page look busy.</p>
        <div className={`proof-status ${proof.available ? "live" : "offline"}`}>
          <Shield />
          <span>{proof.available ? "Production proof online" : "Production proof unavailable"}</span>
          {proof.available && generatedAt ? <small>Updated {generatedAt}</small> : null}
        </div>
      </section>

      <section className="proof-grid shell" aria-label="Pulsercuit proof metrics">
        <article><small>Claims · 24h</small><strong>{proof.available ? proof.claims24h.toLocaleString("en-US") : "—"}</strong><span>treasury-backed Pulses</span></article>
        <article><small>Unique people · 24h</small><strong>{proof.available ? proof.uniqueUsers24h.toLocaleString("en-US") : "—"}</strong><span>accounts with a valid claim</span></article>
        <article><small>Credited · 24h</small><strong>{proof.available ? formatUsdFromCredits(proof.credited24hCredits) : "—"}</strong><span>ledger rewards, not cash-out claims</span></article>
        <article><small>Credited · all time</small><strong>{proof.available ? formatUsdFromCredits(proof.creditedAllTimeCredits) : "—"}</strong><span>Pulse rewards recorded</span></article>
        <article><small>Verified Turbos · 24h</small><strong>{proof.available ? proof.confirmedTurbos24h.toLocaleString("en-US") : "—"}</strong><span>confirmed monetization events</span></article>
        <article><small>Paid withdrawals</small><strong>{proof.available ? proof.paidWithdrawalsAllTime.toLocaleString("en-US") : "—"}</strong><span>{proof.available ? `${formatUsdFromCredits(proof.paidWithdrawalCreditsAllTime)} completed` : "authoritative payout evidence"}</span></article>
      </section>

      <section className="proof-principles shell">
        <article><Spark /><div><h2>Credited is not paid.</h2><p>Pulsercuit distinguishes rewards added to the internal ledger from withdrawals completed by the payout provider.</p></div></article>
        <article><Check /><div><h2>Zero is a valid number.</h2><p>If no Turbo conversion or paid withdrawal exists yet, the page shows zero instead of manufacturing social proof.</p></div></article>
        <article><Shield /><div><h2>Financial state stays server-authoritative.</h2><p>Claims, conversions and withdrawals are counted from trusted database events, never from browser counters.</p></div></article>
      </section>

      <section className="proof-cta shell"><div><span className="section-kicker">The circuit</span><h2>Return. Claim the base Pulse. Turbo only when you choose.</h2></div><Link className="button" href="/auth?next=/dashboard">Open your Pulse <ArrowUpRight /></Link></section>
    </main>
  );
}
