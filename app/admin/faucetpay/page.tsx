import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getFaucetPayReceiptProofState } from "@/lib/faucetpay-receipt-proof";
import { getFaucetPayTestPlan } from "@/lib/faucetpay-test-plan";
import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFaucetPayReadOnlyPreflight } from "@/providers/faucetpay-readonly";
import { confirmFaucetPayReceipt, verifyAndRecordFaucetPayReadProof } from "./actions";

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

function usd(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value);
}

function duration(minutes: number | null) {
  if (minutes === null) return "—";
  if (minutes === 0) return "Immediate after first eligible claim";
  const totalHours = Math.floor(minutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const remainingMinutes = minutes % 60;
  const parts = [days ? `${days}d` : "", hours ? `${hours}h` : "", remainingMinutes ? `${remainingMinutes}m` : ""].filter(Boolean);
  return parts.join(" ") || "<1m";
}

function feasibilityLabel(value: string) {
  if (value === "SAME_DAY") return "SAME-DAY CANDIDATE";
  if (value === "MULTI_DAY") return "MULTI-DAY TEST";
  if (value === "LONG_TEST") return "TOO SLOW FOR CONTROLLED TEST";
  if (value === "AWAITING_PACK") return "AWAITING EXPLICIT PACK";
  return "AWAITING PULSE CONTRACT";
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
  "receipt-confirmation-required": "No receipt proof was recorded. Explicit confirmation that the funds were observed at the destination is required.",
  "receipt-no-paid-withdrawal": "No paid FaucetPay withdrawal is available to bind to a destination-receipt proof.",
  "receipt-payout-proof-required": "Provider-side payout proof is missing or stale. Actual-receipt evidence cannot be recorded against an unproven payout.",
  "receipt-record-failed": "The paid withdrawal is eligible, but destination-receipt evidence could not be recorded. PRODUCT_READY remains blocked.",
  "receipt-recorded": "Actual destination receipt was explicitly confirmed and fingerprint-bound to the current paid FaucetPay withdrawal and payout configuration.",
};

export default async function FaucetPayPreflightPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/faucetpay");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) notFound();

  const [probe, plan] = await Promise.all([
    getFaucetPayReadOnlyPreflight(),
    getFaucetPayTestPlan(),
  ]);
  const verified = probe.state === "READ_ONLY_VERIFIED";
  const admin = createSupabaseAdminClient();
  const proofResult = admin
    ? await admin.from("app_config").select("value").eq("key", "release_external_proof").maybeSingle()
    : { data: null, error: null };
  const proofValue = proofResult.data?.value;
  const readEvidenceCurrent = !proofResult.error && releaseEvidenceMatches(proofValue, "faucetpay_read");
  const receiptState = admin
    ? await getFaucetPayReceiptProofState(admin, proofValue)
    : { withdrawal: null, payoutProofCurrent: false, receiptProofCurrent: false };

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

      {params.proof ? <div className={`preview-banner ${params.proof === "recorded" || params.proof === "receipt-recorded" ? "success" : ""}`}>{proofCopy[params.proof] ?? "The read-only proof state was not changed."}</div> : null}

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

      <section className="admin-panel">
        <div className="app-section-head">
          <div><span className="app-eyebrow">Final settlement truth</span><h2>Actual destination receipt</h2></div>
          <span className={`admin-badge ${receiptState.receiptProofCurrent ? "" : receiptState.withdrawal && receiptState.payoutProofCurrent ? "proof" : "setup"}`}>{receiptState.receiptProofCurrent ? "RECEIPT PROVEN" : receiptState.withdrawal ? "AWAITING RECEIPT" : "NO PAID WITHDRAWAL"}</span>
        </div>
        <p className="admin-panel-note">A FaucetPay success response proves provider-side payout acceptance, not that the destination actually received spendable funds. PRODUCT_READY remains blocked until the controlled test withdrawal is observed at the destination and explicitly confirmed here.</p>
        {receiptState.withdrawal ? (
          <div className="admin-secondary-grid">
            <article><span>Paid withdrawal</span><strong>{receiptState.withdrawal.id.slice(0, 8)}…</strong></article>
            <article><span>Provider</span><strong>FaucetPay</strong></article>
            <article><span>Asset</span><strong>{receiptState.withdrawal.asset}</strong></article>
            <article><span>Credits settled</span><strong>{integer(receiptState.withdrawal.amount_credits)}</strong></article>
            <article><span>Provider units</span><strong>{integer(receiptState.withdrawal.payout_amount_units)}</strong></article>
            <article><span>Provider payout proof</span><strong>{receiptState.payoutProofCurrent ? "CURRENT" : "MISSING / STALE"}</strong></article>
          </div>
        ) : null}
        {!receiptState.receiptProofCurrent && receiptState.withdrawal && receiptState.payoutProofCurrent ? (
          <form action={confirmFaucetPayReceipt}>
            <label className="admin-panel-note"><input type="checkbox" name="receipt_confirmation" value="RECEIVED" required /> I personally verified that this exact controlled payout is visible as received at the configured destination.</label>
            <button className="button" type="submit">Confirm actual receipt</button>
          </form>
        ) : null}
        {receiptState.receiptProofCurrent ? <p className="admin-panel-note"><strong>Current receipt evidence is fingerprint-bound.</strong> It becomes stale if the payout configuration or bound paid withdrawal changes.</p> : null}
      </section>

      <section className="admin-panel">
        <div className="app-section-head">
          <div><span className="app-eyebrow">Read-only planning</span><h2>Controlled payout test feasibility</h2></div>
          <span className={`admin-badge ${plan.feasibility === "SAME_DAY" ? "" : plan.feasibility === "MULTI_DAY" ? "proof" : "setup"}`}>{feasibilityLabel(plan.feasibility)}</span>
        </div>
        <div className="admin-secondary-grid">
          <article><span>Candidate payout pack</span><strong>{integer(plan.payoutCredits)} credits</strong><small>{usd(plan.payoutUsd)}</small></article>
          <article><span>Hourly Pulse reward</span><strong>{integer(plan.pulseRewardCredits)} credits</strong><small>{plan.pulseIntervalMinutes === null ? "Interval unavailable" : `Every ${plan.pulseIntervalMinutes} rolling minutes · Treasury ${plan.treasuryCode ?? "—"}`}</small></article>
          <article><span>Claims from zero</span><strong>{integer(plan.claimsFromZero)}</strong></article>
          <article><span>Theoretical minimum elapsed</span><strong>{duration(plan.minimumElapsedMinutes)}</strong><small>First claim immediately eligible; all later claims at the earliest valid rolling interval.</small></article>
          <article><span>Total Treasury credits needed</span><strong>{integer(plan.treasuryCreditsRequired)}</strong><small>{plan.treasuryOvershootCredits && plan.treasuryOvershootCredits > 0 ? `${plan.treasuryOvershootCredits} credit(s) above the exact pack because claims are indivisible` : "No claim-size overshoot"}</small></article>
          <article><span>Fastest UTC-day claims</span><strong>{integer(plan.fastestDayClaimCount)}</strong><small>Arithmetic maximum for this isolated test path under the configured interval.</small></article>
          <article><span>Minimum daily budget</span><strong>{integer(plan.minimumDailyBudgetCredits)}</strong><small>Current: {integer(plan.currentDailyBudgetCredits)} · deficit {integer(plan.dailyBudgetDeficitCredits)}</small></article>
          <article><span>Minimum user/day cap</span><strong>{integer(plan.minimumUserDailyCapCredits)}</strong><small>Current: {integer(plan.currentUserDailyCapCredits)} · deficit {integer(plan.userDailyCapDeficitCredits)}</small></article>
          <article><span>Current Treasury available</span><strong>{integer(plan.currentTreasuryAvailableCredits)}</strong><small>{plan.treasuryEnabled === null ? "State unavailable" : `${plan.treasuryEnabled ? "enabled" : "disabled"} · kill switch ${plan.treasuryKillSwitch ? "ON" : "OFF"}`}</small></article>
          <article><span>Total funding deficit</span><strong>{integer(plan.treasuryDeficitCredits)}</strong></article>
        </div>
        <p className="admin-panel-note">{plan.detail}</p>
        <p className="admin-panel-note"><strong>Advisory only.</strong> This planner does not modify the payout pack, fund Treasury, change budgets or caps, mint credits, open the kill switch or call FaucetPay. A provider minimum is not inferred from this arithmetic.</p>
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
