import Link from "next/link";
import { ArrowUpRight, Check, Shield, Spark } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { FunnelBeacon } from "@/components/funnel-beacon";
import { getPulseProof } from "@/lib/pulse-proof";
import { formatUsdFromCredits } from "@/lib/reward-state";

export const metadata = {
  title: "Pulsercuit Proof",
  description: "Live, aggregate proof of Pulse claims, credited rewards, Turbo conversions and completed payouts.",
};

export const dynamic = "force-dynamic";

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
      <FunnelBeacon event="proof_view" />
      <SiteHeader />
      <section className="proof-hero shell">
        <span className="section-kicker">Pulsercuit Proof</span>
        <h1>Live numbers. No demo activity.</h1>
        <p>Every number below comes from live production events. If nothing happened, PulseCircuit shows zero instead of manufacturing activity.</p>
        <div className={`proof-status ${proof.available ? "live" : "offline"}`}>
          <Shield />
          <span>{proof.available ? "Production proof online" : "Production proof unavailable"}</span>
          {proof.available && generatedAt ? <small>Updated {generatedAt}</small> : null}
        </div>
        <div className="pc-v10-proof-actions">
          <Link className="button" href="/auth?mode=signup&next=/dashboard">Create free account <ArrowUpRight /></Link>
          <Link className="inline-action" href="/rewards-policy">How rewards become real</Link>
        </div>
      </section>

      <section className="proof-grid shell" aria-label="Pulsercuit proof metrics">
        <article><small>Pulse claims · 24h</small><strong>{proof.available ? proof.claims24h.toLocaleString("en-US") : "—"}</strong><span>funded Pulses</span></article>
        <article><small>People · 24h</small><strong>{proof.available ? proof.uniqueUsers24h.toLocaleString("en-US") : "—"}</strong><span>people with a valid Pulse</span></article>
        <article><small>Rewards credited · 24h</small><strong>{proof.available ? formatUsdFromCredits(proof.credited24hCredits) : "—"}</strong><span>added to account balances</span></article>
        <article><small>Rewards credited · all time</small><strong>{proof.available ? formatUsdFromCredits(proof.creditedAllTimeCredits) : "—"}</strong><span>recorded reward value</span></article>
        <article><small>Verified extras · 24h</small><strong>{proof.available ? proof.confirmedTurbos24h.toLocaleString("en-US") : "—"}</strong><span>confirmed extra-reward events</span></article>
        <article><small>Paid withdrawals</small><strong>{proof.available ? proof.paidWithdrawalsAllTime.toLocaleString("en-US") : "—"}</strong><span>{proof.available ? `${formatUsdFromCredits(proof.paidWithdrawalCreditsAllTime)} completed` : "authoritative payout evidence"}</span></article>
      </section>

      <details className="proof-principles shell" open><summary><strong>How PulseCircuit proof works</strong></summary>
        <article><Spark /><div><h2>Credited is not paid.</h2><p>Pulsercuit distinguishes rewards added to the internal ledger from withdrawals completed by the payout provider.</p></div></article>
        <article><Check /><div><h2>Zero is a valid number.</h2><p>If no Turbo conversion or paid withdrawal exists yet, the page shows zero instead of manufacturing social proof.</p></div></article>
        <article><Shield /><div><h2>Financial state stays server-authoritative.</h2><p>Claims, conversions and withdrawals are counted from trusted database events, never from browser counters.</p></div></article>
      </details>

      <section className="proof-cta shell"><div><span className="section-kicker">The circuit</span><h2>Start with one funded Pulse. Everything else can wait.</h2></div><Link className="button" href="/auth?mode=signup&next=/dashboard">Create free account <ArrowUpRight /></Link></section>
    </main>
  );
}
