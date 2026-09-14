import { AppShell } from "@/components/app-shell";
import { Check, Shield, Wallet } from "@/components/icons";
import { TurnstileField } from "@/components/turnstile-field";
import { hasCurrentFaucetPayReadProof } from "@/lib/faucetpay-authority";
import { formatUsdFromCredits, getLedgerItems, getRewardSnapshot } from "@/lib/reward-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export const metadata = { title: "Wallet" };

type Props = { searchParams: Promise<{ withdraw?: string }> };
type ActiveWithdrawal = {
  id: string;
  status: "requested" | "held" | "submitted";
  destination: string;
  asset: string;
  amount_credits: number;
  payout_amount_units: number | null;
  created_at: string;
};

const withdrawalCopy: Record<string, string> = {
  paid: "Withdrawal paid through FaucetPay.",
  processing: "Payout is reserved and processing safely. Retrying uses the same payout identity.",
  held: "Withdrawal is safely reserved for review.",
  insufficient: "You have not reached the withdrawal threshold yet.",
  "already-processing": "A withdrawal is already processing for this account.",
  "invalid-destination": "That destination could not be verified by FaucetPay.",
  "provider-temporary": "FaucetPay is temporarily unavailable. Your balance was not changed.",
  "verification-failed": "Human verification failed. Please try again.",
  "verification-not-configured": "Withdrawal verification is not configured yet.",
  "payout-not-configured": "Payout authority is not fully proven for the current pack yet.",
  "service-not-configured": "The live payout service is not configured yet.",
  "reserve-failed": "The payout could not be recovered safely. No new payout was created.",
  failed: "The payout failed definitively and the reserved credits were restored.",
};

function compactDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function maskDestination(value: string) {
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 2)}•••@${domain}`;
  }
  if (value.length <= 8) return `${value.slice(0, 2)}•••`;
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export default async function WalletPage({ searchParams }: Props) {
  const [state, rows, params, supabase, readProofReady] = await Promise.all([
    getRewardSnapshot(),
    getLedgerItems(),
    searchParams,
    createSupabaseServerClient(),
    hasCurrentFaucetPayReadProof(),
  ]);
  const payout = getFaucetPayPackConfig();
  const payoutCredits = payout.ready && payout.amountCredits ? Number(payout.amountCredits) : null;
  const turnstileReady = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
  const serviceReady = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  let activeWithdrawal: ActiveWithdrawal | null = null;
  if (supabase && state.signedIn) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("withdrawals")
        .select("id,status,destination,asset,amount_credits,payout_amount_units,created_at")
        .eq("user_id", user.id)
        .in("status", ["requested", "held", "submitted"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      activeWithdrawal = data as ActiveWithdrawal | null;
    }
  }

  const activePackMatches = Boolean(
    activeWithdrawal
    && payout.ready
    && payout.amountCredits === activeWithdrawal.amount_credits
    && payout.amountSmallestUnits === activeWithdrawal.payout_amount_units
    && payout.asset === activeWithdrawal.asset,
  );
  const recoveryAuthorityReady = Boolean(
    activeWithdrawal
    && activeWithdrawal.status !== "held"
    && turnstileReady
    && serviceReady
    && process.env.FAUCETPAY_SCOPED_KEY?.trim()
    && (activeWithdrawal.status === "submitted" || (readProofReady && activePackMatches)),
  );
  const canWithdraw = Boolean(
    !activeWithdrawal
    && state.signedIn
    && payout.ready
    && payoutCredits
    && readProofReady
    && turnstileReady
    && serviceReady
    && state.availableCredits >= payoutCredits,
  );
  const missingCredits = payoutCredits ? Math.max(0, payoutCredits - state.availableCredits) : null;
  const payoutPackLabel = activeWithdrawal
    ? `${Number(activeWithdrawal.amount_credits).toLocaleString("en-US")} credits · ${activeWithdrawal.asset}`
    : payout.ready && payoutCredits
      ? payout.display || `${payoutCredits.toLocaleString("en-US")} credits`
      : "Not configured";

  return (
    <AppShell active="wallet">
      <div className="app-page-head"><div><span className="app-eyebrow">Transparent ledger</span><h1>Wallet</h1></div></div>
      {params.withdraw ? <div className={`claim-message ${params.withdraw === "paid" ? "success" : "neutral"}`}>{withdrawalCopy[params.withdraw] ?? "Withdrawal status updated."}</div> : null}
      {state.preview ? <div className="preview-banner">Preview shell only — no balance, ledger history or payout threshold is simulated before the live reward service is connected.</div> : null}

      <section className="wallet-balance-card"><div className="wallet-big-icon"><Wallet /></div><div><span>Available balance</span><strong>{state.preview ? "Not connected" : formatUsdFromCredits(state.availableCredits)}</strong>{!state.preview ? <small>{state.availableCredits.toLocaleString("en-US")} credits</small> : null}</div><div className="payout-pack-label"><small>{activeWithdrawal ? "Reserved payout" : "Next payout pack"}</small><strong>{payoutPackLabel}</strong></div></section>

      <section className="withdrawal-panel">
        {activeWithdrawal ? (
          <>
            <div><span className="app-eyebrow">Payout recovery</span><h2>{activeWithdrawal.status === "held" ? "Reserved safely for review." : "A reserved payout needs confirmation."}</h2><p>{activeWithdrawal.status === "held" ? "The credits remain reserved and no provider retry is allowed while this withdrawal is held." : "The original withdrawal identity is preserved. A retry reuses the same provider idempotency key instead of creating a second withdrawal."}</p></div>
            {activeWithdrawal.status === "held" ? (
              <div className="claim-message neutral">Held since {compactDate(activeWithdrawal.created_at)} · {maskDestination(activeWithdrawal.destination)}</div>
            ) : (
              <form action="/api/withdrawals" method="post" className="withdrawal-form">
                <label>Reserved destination<input type="text" value={maskDestination(activeWithdrawal.destination)} disabled readOnly /></label>
                <TurnstileField action="withdrawal-retry" />
                <button className="button button-light button-lg" type="submit" disabled={!recoveryAuthorityReady}>{recoveryAuthorityReady ? "Retry reserved payout" : "Recovery setup incomplete"}</button>
                <small>{activeWithdrawal.status === "submitted" ? "The provider outcome may already be uncertain, so recovery preserves the original payout identity and amount." : "The reserved pack must still match the current read-proven pack before its first send."}</small>
              </form>
            )}
          </>
        ) : (
          <>
            <div><span className="app-eyebrow">Simple withdrawal</span><h2>Redeem one verified payout pack.</h2><p>The pack must be explicit and fingerprint-bound to current FaucetPay read-only evidence before a new withdrawal can reserve balance or reach the send rail.</p></div>
            <form action="/api/withdrawals" method="post" className="withdrawal-form">
              <label>FaucetPay destination<input name="destination" type="text" required maxLength={200} autoComplete="off" placeholder="Email, username or linked address" disabled={!state.signedIn || !payout.ready || !readProofReady} /></label>
              <TurnstileField action="withdrawal" />
              <button className="button button-light button-lg" type="submit" disabled={!canWithdraw}>{canWithdraw ? `Withdraw ${payout.display}` : !payoutCredits || state.preview ? "Payout setup incomplete" : !readProofReady ? "Payout proof incomplete" : missingCredits && missingCredits > 0 ? `Need ${formatUsdFromCredits(missingCredits)} more` : "Withdrawal unavailable"}</button>
              <small>Destination validation uses read-only authority; the separately scoped send key is reserved for the final idempotent payout call.</small>
            </form>
          </>
        )}
      </section>

      <div className="wallet-grid">
        <section className="transaction-card">
          <div className="app-section-head"><div><span className="app-eyebrow">Recent activity</span><h2>Ledger</h2></div></div>
          {rows.length ? rows.map((row) => {
            const positive = row.credits > 0;
            return <div className="transaction-row" key={row.id}><span className={`transaction-status ${positive ? "positive" : "neutral"}`}><Check /></span><div><strong>{row.label}</strong><small>{compactDate(row.createdAt)} · {row.state}</small></div><b className={positive ? "positive" : "neutral"}>{formatUsdFromCredits(row.credits, true)}</b></div>;
          }) : <div className="empty-ledger">{state.preview ? "Live ledger entries appear only after the reward service is connected." : "No ledger activity yet. Your first verified reward will appear here."}</div>}
        </section>
        <aside className="trust-card"><Shield /><span className="app-eyebrow">Payout protection</span><h3>Prove. Reserve. Recover safely.</h3><p>New payouts require current read-only unit proof before credits are reserved. Unknown provider outcomes keep the reserve and retry the same provider identity; only a definitive first-attempt failure can restore credits automatically.</p><div className="state-list"><span className="done">Read proof</span><span className="done">Available</span><span className="active">Reserved</span><span>Paid</span></div></aside>
      </div>
    </AppShell>
  );
}
