import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFaucetPayReadOnlyPreflight } from "@/providers/faucetpay-readonly";

export const metadata = { title: "FaucetPay preflight" };
export const dynamic = "force-dynamic";

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function statusTone(state: string) {
  if (state === "READ_ONLY_VERIFIED") return "admin-badge";
  if (state === "UNIT_SCALE_UNRESOLVED") return "admin-badge proof";
  return "admin-badge setup";
}

function integer(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-US");
}

export default async function FaucetPayPreflightPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/faucetpay");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) notFound();

  const probe = await getFaucetPayReadOnlyPreflight();
  const verified = probe.state === "READ_ONLY_VERIFIED";

  return (
    <AppShell active="admin">
      <div className="admin-head">
        <div>
          <span className="app-eyebrow">Private operations · financial preflight</span>
          <h1>FaucetPay read-only proof</h1>
          <p>Validate the live currency rail and payout-unit contract before any send permission or Treasury-backed withdrawal is enabled.</p>
        </div>
        <span className={statusTone(probe.state)}>{probe.state.replaceAll("_", " ")}</span>
      </div>

      <section className="admin-panel">
        <div className="app-section-head">
          <div><span className="app-eyebrow">Safety invariant</span><h2>No payout endpoint is used here.</h2></div>
        </div>
        <p className="admin-panel-note">This page uses only the FaucetPay v2 <code>read</code> scope and only calls <code>/currencies</code> and <code>/balance</code>. The read key is never rendered. A missing or ambiguous unit scale blocks verification instead of falling back to a guessed multiplier.</p>
      </section>

      <section className="admin-kpi-grid">
        <article className={`admin-kpi ${probe.readKeyPresent ? "positive" : "danger"}`}><span>Read-only key</span><strong>{probe.readKeyPresent ? "Configured" : "Missing"}</strong><small>FAUCETPAY_READ_KEY · read scope only</small></article>
        <article className="admin-kpi"><span>Payout asset</span><strong>{probe.asset}</strong><small>{probe.assetSupported === null ? "Not queried" : probe.assetSupported ? "Confirmed live" : "Not confirmed"}</small></article>
        <article className={`admin-kpi ${probe.inferredUnitScale ? "positive" : "danger"}`}><span>Inferred unit scale</span><strong>{integer(probe.inferredUnitScale)}</strong><small>{probe.inferredDecimals === null ? "Unresolved" : `${probe.inferredDecimals} decimal places`}</small></article>
        <article className={`admin-kpi ${verified ? "positive" : "danger"}`}><span>Payout pack</span><strong>{verified ? "Verified" : "Blocked"}</strong><small>{probe.configuredPackLabel || "Display label missing"}</small></article>
      </section>

      <section className="admin-panel">
        <div className="app-section-head"><div><span className="app-eyebrow">Live evidence</span><h2>Unit contract</h2></div></div>
        <div className="admin-secondary-grid">
          <article><span>Live balance · smallest units</span><strong>{integer(probe.balanceSmallestUnits)}</strong></article>
          <article><span>Live balance · decimal</span><strong>{probe.balanceDisplay === null ? "—" : probe.balanceDisplay.toLocaleString("en-US", { maximumFractionDigits: 12 })}</strong></article>
          <article><span>Configured pack units</span><strong>{integer(probe.configuredPackUnits)}</strong></article>
          <article><span>Expected pack units</span><strong>{integer(probe.expectedPackUnits)}</strong></article>
          <article><span>Pack matches scale</span><strong>{probe.packMatchesScale === null ? "UNPROVEN" : probe.packMatchesScale ? "YES" : "NO"}</strong></article>
          <article><span>Send key</span><strong>Not inspected</strong></article>
        </div>
        <p className="admin-panel-note">{probe.detail}</p>
      </section>

      <section className="admin-decision-card">
        <span className="app-eyebrow">Decision</span>
        <h2>{verified ? "Read-only unit proof is closed." : "Financial send remains blocked."}</h2>
        <p>{verified ? "The live rail confirms the asset and the configured fixed pack matches the inferred smallest-unit scale. A separate send-scoped key and controlled real withdrawal are still required before PRODUCT_READY." : "Do not configure or exercise a payout send path until this preflight reaches READ_ONLY_VERIFIED."}</p>
        <Link className="button button-secondary" href="/admin">Back to operations</Link>
      </section>
    </AppShell>
  );
}
