import Link from "next/link";
import { ArrowUpRight, Check, Shield, Spark } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { FunnelBeacon } from "@/components/funnel-beacon";
import { FunnelLink } from "@/components/funnel-link";
import { getPulseProof } from "@/lib/pulse-proof";
import { formatUsdFromCredits } from "@/lib/reward-state";

export const metadata = {
  title: "Pulsercuit Proof",
  description: "Live aggregate activity across Pulse claims, credited rewards, optional extras and completed payouts.",
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
        <h1>Live activity. Clear outcomes.</h1>
        <p>See recent Pulse activity, credited rewards and completed payouts in one place.</p>
        <div className={`proof-status ${proof.available ? "live" : "offline"}`}>
          <Shield />
          <span>{proof.available ? "Live proof available" : "Live proof unavailable"}</span>
          {proof.available && generatedAt ? <small>Updated {generatedAt}</small> : null}
        </div>
        <div className="pc-v10-proof-actions is-evidence-first">
          <Link className="inline-action" href="/rewards-policy">How rewards work</Link>
        </div>
      </section>

      <section className="proof-grid shell" aria-label="Pulsercuit proof metrics">
        <article><small>Pulse claims · 24h</small><strong>{proof.available ? proof.claims24h.toLocaleString("en-US") : "—"}</strong><span>Pulses claimed</span></article>
        <article><small>Active members · 24h</small><strong>{proof.available ? proof.uniqueUsers24h.toLocaleString("en-US") : "—"}</strong><span>members with a Pulse</span></article>
        <article><small>Rewards credited · 24h</small><strong>{proof.available ? formatUsdFromCredits(proof.credited24hCredits) : "—"}</strong><span>added to Vaults</span></article>
        <article><small>Rewards credited · all time</small><strong>{proof.available ? formatUsdFromCredits(proof.creditedAllTimeCredits) : "—"}</strong><span>credited reward value</span></article>
        <article><small>Extra rewards · 24h</small><strong>{proof.available ? proof.confirmedTurbos24h.toLocaleString("en-US") : "—"}</strong><span>verified completions</span></article>
        <article><small>Paid withdrawals</small><strong>{proof.available ? proof.paidWithdrawalsAllTime.toLocaleString("en-US") : "—"}</strong><span>{proof.available ? `${formatUsdFromCredits(proof.paidWithdrawalCreditsAllTime)} completed` : "payout records unavailable"}</span></article>
      </section>

      <section className="proof-evidence-next shell">
        <div>
          <span className="section-kicker">Evidence first</span>
          <h2>Seen the activity? Enter the circuit.</h2>
          <p>Your account keeps your personal Pulse timing, Vault progress and payout path in one place.</p>
        </div>
        <FunnelLink className="button button-light" href="/auth?mode=signup&next=/dashboard" eventLabel="proof_metrics_signup">
          Create free account <ArrowUpRight />
        </FunnelLink>
      </section>

      <details className="proof-principles shell" open><summary><strong>How these numbers work</strong></summary>
        <article><Spark /><div><h2>Credited and paid are different.</h2><p>Rewards can appear in a Vault before a payout is completed. This page keeps those stages separate.</p></div></article>
        <article><Check /><div><h2>Zero stays zero.</h2><p>If no completed event exists, this page shows zero.</p></div></article>
        <article><Shield /><div><h2>Recorded activity only.</h2><p>Counts come from recorded claim, reward and payout events.</p></div></article>
      </details>

      <section className="proof-cta shell"><div><span className="section-kicker">The circuit</span><h2>Start with one Pulse. Build from there.</h2></div><FunnelLink className="button button-light" href="/auth?mode=signup&next=/dashboard" eventLabel="proof_final_signup">Create free account <ArrowUpRight /></FunnelLink></section>
    </main>
  );
}
