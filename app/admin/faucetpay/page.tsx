import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getFaucetPayReceiptProofState } from "@/lib/faucetpay-receipt-proof";
import { getFaucetPayTestPlan } from "@/lib/faucetpay-test-plan";
import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFaucetPayReadOnlyPreflight } from "@/providers/faucetpay-readonly";
import { confirmFaucetPayReceipt, confirmFaucetPaySendScope, reconcileFaucetPayPayoutProof, verifyAndRecordFaucetPayReadProof } from "./actions";

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
  "payout-proof-no-paid-withdrawal": "No persisted paid FaucetPay withdrawal is available to reconstruct provider payout proof.",
  "payout-proof-changed": "The paid withdrawal changed after this cockpit view was rendered. No payout proof was changed; refresh before reconciling.",
  "payout-proof-reconcile-failed": "The paid withdrawal is still authoritative, but its payout proof could not be reconstructed. No provider call was made.",
  "payout-proof-reconciled": "Provider payout proof was reconstructed from the exact persisted paid withdrawal. No payout was resent.",
  "receipt-confirmation-required": "No receipt proof was recorded. Explicit confirmation that the funds were observed at the destination is required.",
  "receipt-no-paid-withdrawal": "No payout-bound paid FaucetPay withdrawal is available for destination-receipt proof.",
  "receipt-payout-proof-required": "Provider-side payout proof is missing or stale. Actual-receipt evidence cannot be recorded against an unproven payout.",
  "receipt-payout-changed": "The payout authority changed after this cockpit view was rendered. No receipt proof was recorded; refresh and verify the exact payout again.",
  "receipt-record-failed": "The exact payout-bound withdrawal is eligible, but destination-receipt evidence could not be recorded. PRODUCT_READY remains blocked.",
  "receipt-recorded": "Actual destination receipt was explicitly confirmed and fingerprint-bound to the same exact paid FaucetPay withdrawal as the provider payout proof.",
  "send-scope-confirmation-required": "No send-scope proof was recorded. Explicit confirmation of send-only scope and a provider-side daily payout cap is required.",
  "send-scope-key-separation-failed": "Read and send credentials are missing or identical. Least-privilege send authority remains blocked.",
  "send-scope-pack-not-ready": "The payout pack is incomplete. Send-scope evidence cannot be bound to an incomplete payout authority.",
  "send-scope-read-proof-required": "Current read-only FaucetPay proof is missing or stale. Re-verify the read rail before attesting send authority.",
  "send-scope-record-failed": "The send-scope attestation could not be fingerprint-bound. Payout authority remains unproven.",
  "send-scope-recorded": "Send-only scope and provider-side daily cap were explicitly attested and fingerprint-bound to the current send credential and payout pack.",
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
  const sendScopeEvidenceCurrent = !proofResult.error && releaseEvidenceMatches(proofValue, "faucetpay_send_scope");
  const readKey = process.env.FAUCETPAY_READ_KEY?.trim() ?? "";
  const sendKey = process.env.FAUCETPAY_SCOPED_KEY?.trim() ?? "";
  const sendKeySeparated = Boolean(readKey && sendKey && readKey !== sendKey);
  const receiptState = admin
    ? await getFaucetPayReceiptProofState(admin, proofValue)
    : { withdrawal: null, payoutWithdrawal: null, boundWithdrawal: null, payoutProofCurrent: false, receiptProofCurrent: false };
  const settlementWithdrawal = receiptState.payoutWithdrawal ?? receiptState.withdrawal;

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

      {params.proof ? <div className={`preview-banner ${params.proof === "recorded" || params.proof === "send-scope-recorded" || params.proof === "receipt-recorded" || params.proof === "payout-proof-reconciled" ? "success" : ""}`}>{proofCopy[params.proof] ?? "The read-only proof state was not changed."}</div> : null}

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
          <div><span className="app-eyebrow">Least-privilege send authority</span><h2>Send key scope attestation</h2></div>
          <span className={`admin-badge ${sendScopeEvidenceCurrent ? "" : "proof"}`}>{sendScopeEvidenceCurrent ? "CURRENT" : "EXTERNAL CONFIRMATION REQUIRED"}</span>
        </div>
        <p className="admin-panel-note">FaucetPay v2 scopes are assigned in the provider dashboard and are not exposed by a documented scope-introspection endpoint. This gate therefore requires an explicit operator attestation, while the server independently proves that the configured read and send credentials are distinct. No payout call is made by this proof.</p>
        <div className="admin-secondary-grid">
          <article><span>Read credential</span><strong>{readKey ? "CONFIGURED" : "MISSING"}</strong></article>
          <article><span>Send credential</span><strong>{sendKey ? "CONFIGURED" : "MISSING"}</strong></article>
          <article><span>Credential separation</span><strong>{sendKeySeparated ? "PASS" : "FAIL"}</strong><small>Read and send secrets must not be identical.</small></article>
          <article><span>Read proof dependency</span><strong>{readEvidenceCurrent ? "CURRENT" : "MISSING / STALE"}</strong></article>
          <article><span>Send-scope fingerprint</span><strong>{sendScopeEvidenceCurrent ? "CURRENT" : "MISSING / STALE"}</strong></article>
        </div>
        {sendScopeEvidenceCurrent ? (
          <p className="admin-panel-note"><strong>Current attestation is bound to this exact send credential and payout pack.</strong> Rotating the key or changing asset, credits, units or label automatically makes it stale.</p>
        ) : (
          <form action={confirmFaucetPaySendScope}>
            <label className="admin-panel-note"><input type="checkbox" name="scope_confirmation" value="SEND_ONLY_CONFIRMED" required /> I verified in FaucetPay → Scoped API keys that this exact credential has <strong>send</strong> scope only and does not include read, manage or admin.</label>
            <label className="admin-panel-note"><input type="checkbox" name="daily_cap_confirmation" value="DAILY_CAP_CONFIRMED" required /> I verified that a conservative provider-side daily USD payout cap is configured for this send key.</label>
            <button className="button" type="submit" disabled={!sendKeySeparated || !readEvidenceCurrent}>Record send-scope proof</button>
          </form>
        )}
      </section>

      <section className="admin-panel">
        <div className="app-section-head">
          <div><span className="app-eyebrow">Final settlement truth</span><h2>Exact payout → actual destination receipt</h2></div>
          <span className={`admin-badge ${receiptState.receiptProofCurrent ? "" : settlementWithdrawal && receiptState.payoutProofCurrent ? "proof" : "setup"}`}>{receiptState.receiptProofCurrent ? "RECEIPT PROVEN" : settlementWithdrawal ? "AWAITING RECEIPT" : "NO PAID WITHDRAWAL"}</span>
        </div>
        <p className="admin-panel-note">A FaucetPay success response proves provider-side payout acceptance, not that the destination actually received spendable funds. The provider payout proof and receipt proof must now resolve to the same exact paid withdrawal. PRODUCT_READY remains blocked until that payout is observed at the destination and explicitly confirmed here.</p>
        {settlementWithdrawal ? (
          <div className="admin-secondary-grid">
            <article><span>Paid withdrawal</span><strong>{settlementWithdrawal.id.slice(0, 8)}…</strong></article>
            <article><span>Provider</span><strong>FaucetPay</strong></article>
            <article><span>Asset</span><strong>{settlementWithdrawal.asset}</strong></article>
            <article><span>Credits settled</span><strong>{integer(settlementWithdrawal.amount_credits)}</strong></article>
            <article><span>Provider units</span><strong>{integer(settlementWithdrawal.payout_amount_units)}</strong></article>
            <article><span>Provider payout proof</span><strong>{receiptState.payoutProofCurrent ? "CURRENT · EXACT WITHDRAWAL" : "MISSING / STALE"}</strong></article>
          </div>
        ) : null}
        {settlementWithdrawal && !receiptState.payoutProofCurrent ? (
          <form action={reconcileFaucetPayPayoutProof}>
            <input type="hidden" name="withdrawal_id" value={settlementWithdrawal.id} />
            <p className="admin-panel-note">Rebuild provider payout proof from this exact persisted <code>paid</code> withdrawal. This reconciliation does not call FaucetPay and cannot resend funds.</p>
            <button className="button" type="submit">Reconcile provider payout proof</button>
          </form>
        ) : null}
        {!receiptState.receiptProofCurrent && receiptState.payoutWithdrawal && receiptState.payoutProofCurrent ? (
          <form action={confirmFaucetPayReceipt}>
            <input type="hidden" name="withdrawal_id" value={receiptState.payoutWithdrawal.id} />
            <label className="admin-panel-note"><input type="checkbox" name="receipt_confirmation" value="RECEIVED" required /> I personally verified that this exact controlled payout is visible as received at the configured destination.</label>
            <button className="button" type="submit">Confirm actual receipt</button>
          </form>
        ) : null}
        {receiptState.receiptProofCurrent ? <p className="admin-panel-note"><strong>Current payout → receipt evidence chain is exact and fingerprint-bound.</strong> It becomes stale if the payout configuration or bound paid withdrawal changes.</p> : null}
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
        <h2>{verified && readEvidenceCurrent && sendScopeEvidenceCurrent ? "Read rail and least-privilege send authority are proven." : "Financial send remains blocked."}</h2>
        <p>{verified && readEvidenceCurrent && sendScopeEvidenceCurrent ? "The read rail, payout economics, provider units and send-only operator attestation are fingerprint-bound. A controlled real withdrawal and exact payout→receipt proof chain are still required before PRODUCT_READY." : verified && readEvidenceCurrent ? "Read-only proof is closed, but send-key least privilege still needs explicit provider-dashboard attestation." : verified ? "The live rail passes, but the operator must explicitly record the current read fingerprint before send authority can advance." : "Do not exercise a payout send path until the live preflight reaches READ_ONLY_VERIFIED and its current fingerprint is recorded."}</p>
        <Link className="button button-secondary" href="/admin">Back to operations</Link>
      </section>
    </AppShell>
  );
}
