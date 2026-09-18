import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getFaucetPayReceiptProofState } from "@/lib/faucetpay-receipt-proof";
import { getFaucetPayTestPlan } from "@/lib/faucetpay-test-plan";
import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFaucetPaySendAuthorityConfig } from "@/providers/faucetpay";
import { getFaucetPayReadOnlyPreflight } from "@/providers/faucetpay-readonly";
import { completeFaucetPayConnection, confirmFaucetPayReceipt, reconcileFaucetPayPayoutProof } from "./actions";

export const metadata = { title: "FaucetPay connection" };
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
  "send-scope-daily-limit-required": "The expected FaucetPay send-key daily USD cap could not be derived from the payout pack or an explicit override. No attestation was recorded.",
  "send-scope-daily-limit-changed": "The expected daily cap changed after this cockpit view was rendered. Refresh and verify the exact current value before attesting.",
  "send-scope-pack-not-ready": "The payout pack is incomplete. Send-scope evidence cannot be bound to an incomplete payout authority.",
  "send-scope-read-proof-required": "Current read-only FaucetPay proof is missing or stale. Re-verify the read rail before attesting send authority.",
  "send-scope-record-failed": "The send-scope attestation could not be fingerprint-bound. Payout authority remains unproven.",
  "send-scope-recorded": "Send-only scope and provider-side daily cap were explicitly attested and fingerprint-bound to the current send credential and payout pack.",
  "connection-confirmation-required": "Nothing changed. Confirm the single FaucetPay setup statement before completing the connection.",
  "connection-complete": "FaucetPay connection is complete. Read verification and least-privilege send proof are current; no payout was sent.",
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
  const sendAuthority = getFaucetPaySendAuthorityConfig();
  const readKeyPresent = Boolean(process.env.FAUCETPAY_READ_KEY?.trim());
  const sendKeyPresent = Boolean(process.env.FAUCETPAY_SCOPED_KEY?.trim());
  const receiptState = admin
    ? await getFaucetPayReceiptProofState(admin, proofValue)
    : { withdrawal: null, payoutWithdrawal: null, boundWithdrawal: null, payoutProofCurrent: false, receiptProofCurrent: false };
  const settlementWithdrawal = receiptState.payoutWithdrawal ?? receiptState.withdrawal;
  const connectionReady = readEvidenceCurrent && sendScopeEvidenceCurrent;
  const stage = !connectionReady
    ? "connection"
    : !settlementWithdrawal
      ? "controlled-test"
      : !receiptState.payoutProofCurrent
        ? "reconcile"
        : !receiptState.receiptProofCurrent
          ? "receipt"
          : "complete";

  return (
    <AppShell active="faucetpay-admin">
      <div className="admin-head">
        <div>
          <span className="app-eyebrow">Payments</span>
          <h1>FaucetPay setup, one stage at a time.</h1>
          <p>Only the action needed now stays open. Technical evidence remains available below without competing with the workflow.</p>
        </div>
        <span className={`admin-badge ${stage === "complete" ? "" : stage === "connection" ? "setup" : "proof"}`}>
          {stage === "complete" ? "PATH VERIFIED" : stage === "connection" ? "CONNECT" : "NEXT STEP"}
        </span>
      </div>

      {params.proof ? (
        <div className={`preview-banner ${["recorded", "send-scope-recorded", "connection-complete", "receipt-recorded", "payout-proof-reconciled"].includes(params.proof) ? "success" : ""}`}>
          {proofCopy[params.proof] ?? "The FaucetPay state was not changed."}
        </div>
      ) : null}

      <section className="admin-secondary-grid" aria-label="FaucetPay verification stages">
        <article>
          <span>1 · Connection</span>
          <strong>{connectionReady ? "COMPLETE" : "CURRENT"}</strong>
          <small>Protected read + send authority</small>
        </article>
        <article>
          <span>2 · Controlled payout</span>
          <strong>{settlementWithdrawal ? "COMPLETE" : connectionReady ? "NEXT" : "LOCKED"}</strong>
          <small>One real bounded payment</small>
        </article>
        <article>
          <span>3 · Receipt</span>
          <strong>{receiptState.receiptProofCurrent ? "COMPLETE" : settlementWithdrawal && receiptState.payoutProofCurrent ? "NEXT" : "LOCKED"}</strong>
          <small>Same payment observed at destination</small>
        </article>
      </section>

      {stage === "connection" ? (
        <section className="admin-panel">
          <div className="app-section-head">
            <div><span className="app-eyebrow">Current action</span><h2>Complete the FaucetPay connection.</h2></div>
            <span className="admin-badge proof">ONE CONFIRMATION</span>
          </div>
          <p className="admin-panel-note">PulseCircuit automatically checks the live read rail, payout pack, credential separation and daily protection. You only confirm the provider-side setting that FaucetPay does not expose through its API.</p>
          <div className="admin-secondary-grid">
            <article><span>Automatic verification</span><strong>{verified ? "READY" : "NEEDS ATTENTION"}</strong><small>No payout call.</small></article>
            <article><span>Credential isolation</span><strong>{sendAuthority.credentialsSeparated ? "PROTECTED" : "NEEDS ATTENTION"}</strong><small>Read and payment credentials remain separate.</small></article>
            <article><span>Daily protection</span><strong>{sendAuthority.dailyLimitUsd ? usd(sendAuthority.dailyLimitUsd) : "UNAVAILABLE"}</strong><small>{sendAuthority.dailyLimitSource === "configured_override" ? "Explicit override" : sendAuthority.dailyLimitSource === "one_pack_default" ? "Automatic: one payout pack/day" : "Waiting for payout pack"}</small></article>
          </div>
          <form action={completeFaucetPayConnection}>
            <input type="hidden" name="expected_daily_limit_usd" value={sendAuthority.dailyLimitUsd ?? ""} />
            <label className="admin-panel-note"><input type="checkbox" name="setup_confirmation" value="FAUCETPAY_SEND_SETUP_CONFIRMED" required /> I checked in FaucetPay that the PulseCircuit payment key has <strong>Send only</strong> permission and the exact daily cap shown above.</label>
            <button className="button" type="submit" disabled={!verified || !sendAuthority.ready}>Complete FaucetPay connection</button>
            <p className="admin-panel-note">It never calls the FaucetPay payout endpoint.</p>
          </form>
        </section>
      ) : null}

      {stage === "controlled-test" ? (
        <section className="admin-panel">
          <div className="app-section-head">
            <div><span className="app-eyebrow">Current action</span><h2>Prepare one controlled payout test.</h2></div>
            <span className="admin-badge proof">NO MONEY MOVED HERE</span>
          </div>
          <p className="admin-panel-note">The connection is proven. The next financial step is deliberately separate: review the smallest approved test and only fund it after explicit operator authorization.</p>
          <div className="admin-secondary-grid">
            <article><span>Configured payout</span><strong>{integer(plan.payoutCredits)} credits</strong><small>{usd(plan.payoutUsd)}</small></article>
            <article><span>Current Treasury available</span><strong>{integer(plan.currentTreasuryAvailableCredits)} credits</strong></article>
            <article><span>Funding needed from zero</span><strong>{integer(plan.treasuryDeficitCredits)} credits</strong><small>This is planning, not approval.</small></article>
          </div>
          <p className="admin-panel-note"><strong>Next financial action requires explicit approval.</strong> This page does not fund Treasury, reserve credits or send a payout.</p>
          <Link className="button button-secondary" href="/admin">Back to Ops</Link>
        </section>
      ) : null}

      {stage === "reconcile" && settlementWithdrawal ? (
        <section className="admin-panel">
          <div className="app-section-head">
            <div><span className="app-eyebrow">Current action</span><h2>Bind proof to the payment that already happened.</h2></div>
            <span className="admin-badge proof">SAFE RECONCILIATION</span>
          </div>
          <div className="admin-secondary-grid">
            <article><span>Paid withdrawal</span><strong>{settlementWithdrawal.id.slice(0, 8)}…</strong></article>
            <article><span>Asset</span><strong>{settlementWithdrawal.asset}</strong></article>
            <article><span>Provider payout proof</span><strong>MISSING / STALE</strong><small>Must resolve to the EXACT WITHDRAWAL.</small></article>
          </div>
          <form action={reconcileFaucetPayPayoutProof}>
            <input type="hidden" name="withdrawal_id" value={settlementWithdrawal.id} />
            <p className="admin-panel-note">This rebuilds proof from the persisted paid withdrawal. It does not call FaucetPay and cannot resend funds.</p>
            <button className="button" type="submit">Reconcile payment proof</button>
          </form>
        </section>
      ) : null}

      {stage === "receipt" && receiptState.payoutWithdrawal ? (
        <section className="admin-panel">
          <div className="app-section-head">
            <div><span className="app-eyebrow">Current action</span><h2>Confirm the destination actually received the payment.</h2></div>
            <span className="admin-badge proof">FINAL PAYMENT PROOF</span>
          </div>
          <div className="admin-secondary-grid">
            <article><span>Paid withdrawal</span><strong>{receiptState.payoutWithdrawal.id.slice(0, 8)}…</strong></article>
            <article><span>Asset</span><strong>{receiptState.payoutWithdrawal.asset}</strong></article>
            <article><span>Provider proof</span><strong>CURRENT · EXACT WITHDRAWAL</strong></article>
          </div>
          <form action={confirmFaucetPayReceipt}>
            <input type="hidden" name="withdrawal_id" value={receiptState.payoutWithdrawal.id} />
            <label className="admin-panel-note"><input type="checkbox" name="receipt_confirmation" value="RECEIVED" required /> I personally verified that this exact controlled payout is visible as received at the configured destination.</label>
            <button className="button" type="submit">Confirm actual receipt</button>
          </form>
        </section>
      ) : null}

      {stage === "complete" ? (
        <section className="admin-decision-card">
          <span className="app-eyebrow">Payment path</span>
          <h2>Connection, payout and receipt are proven.</h2>
          <p>The protected FaucetPay path is bound to real evidence. Any relevant configuration change makes the corresponding proof stale automatically.</p>
          <Link className="button button-secondary" href="/admin">Back to Ops</Link>
        </section>
      ) : null}

      <details className="admin-panel">
        <summary><strong>Advanced diagnostics</strong> · economic, unit and planning evidence</summary>
        <div className="app-section-head">
          <div><span className="app-eyebrow">Live evidence</span><h2>Technical details</h2></div>
          <span className={statusTone(probe.state)}>{probe.state.replaceAll("_", " ")}</span>
        </div>
        <div className="admin-secondary-grid">
          <article><span>Read credential</span><strong>{readKeyPresent ? "CONFIGURED" : "MISSING"}</strong></article>
          <article><span>Send credential</span><strong>{sendKeyPresent ? "CONFIGURED" : "MISSING"}</strong></article>
          <article><span>Read proof</span><strong>{readEvidenceCurrent ? "CURRENT" : "MISSING / STALE"}</strong></article>
          <article><span>Send proof</span><strong>{sendScopeEvidenceCurrent ? "CURRENT" : "MISSING / STALE"}</strong></article>
          <article><span>Payout asset</span><strong>{probe.asset}</strong></article>
          <article><span>Unit scale</span><strong>{integer(probe.inferredUnitScale)}</strong></article>
          <article><span>Configured credits</span><strong>{integer(probe.configuredPackCredits)}</strong></article>
          <article><span>Expected credits</span><strong>{integer(probe.expectedPackCredits)}</strong></article>
          <article><span>Configured provider units</span><strong>{integer(probe.configuredPackUnits)}</strong></article>
          <article><span>Expected provider units</span><strong>{integer(probe.expectedPackUnits)}</strong></article>
          <article><span>Live balance · units</span><strong>{integer(probe.balanceSmallestUnits)}</strong></article>
          <article><span>Test feasibility</span><strong>{feasibilityLabel(plan.feasibility)}</strong></article>
          <article><span>Claims from zero</span><strong>{integer(plan.claimsFromZero)}</strong></article>
          <article><span>Theoretical minimum</span><strong>{duration(plan.minimumElapsedMinutes)}</strong></article>
          <article><span>Treasury required</span><strong>{integer(plan.treasuryCreditsRequired)} credits</strong></article>
          <article><span>Treasury deficit</span><strong>{integer(plan.treasuryDeficitCredits)} credits</strong></article>
        </div>
        <p className="admin-panel-note">{probe.detail}</p>
        <p className="admin-panel-note">{plan.detail}</p>
        <p className="admin-panel-note"><strong>Diagnostics are read-only.</strong> They do not fund Treasury, change budgets, mint credits, open a kill switch or send a payout.</p>
      </details>
    </AppShell>
  );
}
