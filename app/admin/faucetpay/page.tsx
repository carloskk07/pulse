import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFaucetPayReadOnlyPreflight } from "@/providers/faucetpay-readonly";
import { verifyAndRecordFaucetPayReadProof } from "./actions";

export const metadata = { title: "FaucetPay preflight" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ proof?: string }> };

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

const proofCopy: Record<string, string> = {
  recorded: "Live read-only evidence was verified again and recorded against the current FaucetPay configuration fingerprint.",
  "record-failed": "The live preflight passed, but the fingerprint could not be recorded. Payout authority remains blocked.",
  "auth-unavailable": "Server authentication authority is unavailable. No proof was recorded.",
  "read_key_required": "A read-scoped FaucetPay key is still required. No proof was recorded.",
  "read_api_failed": "The read-only FaucetPay API check failed. No proof was recorded.",
  "asset_not_supported": "The configured payout asset was not confirmed by the live currencies response. No proof was recorded.",
  "settlement_asset_unsupported": "The configured asset cannot be valued from USD-denominated credits without an authorized price oracle. No proof was recorded.",
  "unit_scale_unresolved": "The live response did not contain enough evidence to prove the smallest-unit scale. No assumption was recorded.",
  "pack_economics_mismatch": "The configured internal credits do not match the nominal USD value in the payout label. No proof was recorded.",
  "pack_mismatch": "The configured provider units do not match the live unit evidence. No proof was recorded.",
};

export default async function FaucetPayPreflightPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/faucetpay");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) notFound();

  const probe = await getFaucetPayReadOnlyPreflight();
  const verified = probe.state === "READ_ONLY_VERIFIED";
  const admin = createSupabaseAdminClient();
  const proofResult = admin
    ? await admin.from("app_config").select("value").eq("key", "release_external_proof").maybeSingle()
    : { data: null, error: null };
  const readEvidenceCurrent = !proofResult.error && releaseEvidenceMatches(proofResult.data?.value, "faucetpay_read");

  return (
    <AppShell active="faucetpay-admin">
      <div className="admin-head">
        <div>
          <span className="app-eyebrow">Private operations · financial preflight</span>
          <h1>FaucetPay read-only proof</h1>
          <p>Prove the live asset, internal-credit economics and provider smallest-unit contract before any send authority or Treasury-backed withdrawal is enabled.</p>
        </div>
        <span className={statusTone(probe.state)}>{probe.state.replaceAll("_", " ")}</span>
      </div>

      {params.proof ? <div className={`preview-banner ${params.proof === "recorded" ? "success" : ""}`}>{proofCopy[params.proof] ?? "The read-only proof state was not changed."}</div> : null}

      <section className="admin-panel">
        <div className="app-section-head">
          <div><span className="app-eyebrow">Safety invariant</span><h2>No payout endpoint is used here.</h2></div>
        </div>
        <p className="admin-panel-note">This cockpit uses only the FaucetPay v2 <code>read</code> scope and calls <code>/currencies</code> and <code>/balance</code>. It accepts only nominal USD settlement assets (USDT/USDC) while no price oracle is authorized. Missing economic parity or ambiguous provider units remain blocking instead of being guessed.</p>
      </section>

      <section className="admin-kpi-grid">
        <article className={`admin-kpi ${probe.readKeyPresent ? "positive" : "danger"}`}><span>Read-only key</span><strong>{probe.readKeyPresent ? "Configured" : "Missing"}</strong><small>FAUCETPAY_READ_KEY · read scope only</small></article>
        <article className="admin-kpi"><span>Payout asset</span><strong>{probe.asset}</strong><small>{probe.assetSupported === null ? "Not queried" : probe.assetSupported ? "Confirmed live" : "Not confirmed"}</small></article>
        <article className={`admin-kpi ${probe.inferredUnitScale ? "positive" : "danger"}`}><span>Inferred unit scale</span><strong>{integer(probe.inferredUnitScale)}</strong><small>{probe.inferredDecimals === null ? "Unresolved" : `${probe.inferredDecimals} decimal places`}</small></article>
        <article className={`admin-kpi ${readEvidenceCurrent ? "positive" : "danger"}`}><span>Fingerprint proof</span><strong>{readEvidenceCurrent ? "CURRENT" : "MISSING / STALE"}</strong><small>Verifier schema + read key + exact payout pack</small></article>
      </section>

      <section className="admin-panel">
        <div className="app-section-head"><div><span className="app-eyebrow">Live evidence</span><h2>Economic + unit contract</h2></div></div>
        <div className="admin-secondary-grid">
          <article><span>Configured internal credits</span><strong>{integer(probe.configuredPackCredits)}</strong></article>
          <article><span>Expected internal credits</span><strong>{integer(probe.expectedPackCredits)}</strong></article>
          <article><span>Credits match label</span><strong>{probe.packMatchesCredits === null ? "UNPROVEN" : probe.packMatchesCredits ? "YES" : "NO"}</strong></article>
          <article><span>Configured pack units</span><strong>{integer(probe.configuredPackUnits)}</strong></article>
          <article><span>Expected pack units</span><strong>{integer(probe.expectedPackUnits)}</strong></article>
          <article><span>Units match live scale</span><strong>{probe.packMatchesScale === null ? "UNPROVEN" : probe.packMatchesScale ? "YES" : "NO"}</strong></article>
          <article><span>Live balance · smallest units</span><strong>{integer(probe.balanceSmallestUnits)}</strong></article>
          <article><span>Live balance · decimal</span><strong>{probe.balanceDisplay === null ? "—" : probe.balanceDisplay.toLocaleString("en-US", { maximumFractionDigits: 12 })}</strong></article>
          <article><span>Send key</span><strong>Not inspected</strong></article>
        </div>
        <p className="admin-panel-note">{probe.detail}</p>
        {verified ? (
          <form action={verifyAndRecordFaucetPayReadProof}>
            <button className="button" type="submit">{readEvidenceCurrent ? "Re-verify & refresh proof" : "Verify live rail & record proof"}</button>
          </form>
        ) : <p className="admin-panel-note"><strong>Proof recording is disabled.</strong> The server must first prove the asset, credit economics and provider-unit scale from current configuration and live FaucetPay data.</p>}
      </section>

      <section className="admin-decision-card">
        <span className="app-eyebrow">Decision</span>
        <h2>{verified && readEvidenceCurrent ? "Read-only payout proof is closed and current." : "Financial send remains blocked."}</h2>
        <p>{verified && readEvidenceCurrent ? "The nominal USD value, internal credits and provider units are consistent and fingerprint-bound. A separate send-scoped key, controlled Treasury-backed claim, controlled real withdrawal and actual receipt are still required before PRODUCT_READY." : verified ? "The live rail passes, but the operator must explicitly record the current fingerprint before this gate is closed." : "Do not configure or exercise a payout send path until the live preflight reaches READ_ONLY_VERIFIED and its current fingerprint is recorded."}</p>
        <Link className="button button-secondary" href="/admin">Back to operations</Link>
      </section>
    </AppShell>
  );
}
