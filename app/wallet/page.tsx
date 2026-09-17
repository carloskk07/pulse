import { AppShell } from "@/components/app-shell";
import { FeedbackMessage } from "@/components/feedback-message";
import { Check, Shield, Wallet } from "@/components/icons";
import { TurnstileField } from "@/components/turnstile-field";
import { hasCurrentFaucetPayReadProof } from "@/lib/faucetpay-authority";
import { formatUsdFromCredits, getLedgerItems, getRewardSnapshot } from "@/lib/reward-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export const metadata = { title: "Vault" };

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
  paid: "Payout complete.",
  processing: "Payout reserved. Recovery keeps the same payout identity.",
  held: "Payout reserved safely for review.",
  insufficient: "The current payout target has not been reached yet.",
  "already-processing": "A payout is already in progress.",
  "invalid-destination": "FaucetPay could not verify that destination.",
  "provider-temporary": "FaucetPay is temporarily unavailable. Your balance did not change.",
  "verification-failed": "Verification failed. Try again.",
  "verification-not-configured": "Withdrawal verification is not ready yet.",
  "payout-not-configured": "The current payout pack has not finished live proof yet.",
  "service-not-configured": "The live payout service is not ready yet.",
  "reserve-failed": "The payout could not be recovered safely. No new payout was created.",
  failed: "The payout failed definitively and reserved credits were restored.",
};

const withdrawalErrorStates = new Set([
  "invalid-destination",
  "provider-temporary",
  "verification-failed",
  "verification-not-configured",
  "payout-not-configured",
  "service-not-configured",
  "reserve-failed",
  "failed",
]);

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
      : "Not active";

  return (
    <AppShell active="wallet">
      <div className="app-page-head pc-luxe-vault-head"><div><span className="app-eyebrow">Vault</span><h1>Protected value. Clear path.</h1><p>Available. Reserved. Paid. Never blurred together.</p></div></div>
      {params.withdraw ? <FeedbackMessage tone={params.withdraw === "paid" ? "success" : withdrawalErrorStates.has(params.withdraw) ? "error" : "neutral"}>{withdrawalCopy[params.withdraw] ?? "Payout state updated."}</FeedbackMessage> : null}
      {state.preview ? <div className="preview-banner">Live value appears only when the authoritative reward service is connected.</div> : null}

      <section className="wallet-balance-card pc-luxe-vault-balance"><div className="wallet-big-icon"><Wallet /></div><div><span>Available</span><strong>{state.preview ? "—" : formatUsdFromCredits(state.availableCredits)}</strong>{!state.preview ? <small>{state.availableCredits.toLocaleString("en-US")} credits</small> : null}</div><div className="payout-pack-label"><small>{activeWithdrawal ? "Reserved payout" : "Payout target"}</small><strong>{payoutPackLabel}</strong></div></section>

      <section className="withdrawal-panel pc-luxe-vault-action">
        {activeWithdrawal ? (
          <>
            <div><span className="app-eyebrow">Protected settlement</span><h2>{activeWithdrawal.status === "held" ? "Reserved while review finishes." : "One payout. One identity."}</h2><p>{activeWithdrawal.status === "held" ? "Credits stay reserved and retries stay blocked." : "Recovery reuses the original provider identity instead of creating a second payout."}</p></div>
            {activeWithdrawal.status === "held" ? (
              <div className="claim-message neutral">Held since {compactDate(activeWithdrawal.created_at)} · {maskDestination(activeWithdrawal.destination)}</div>
            ) : (
              <form action="/api/withdrawals" method="post" className="withdrawal-form">
                <label>Reserved destination<input type="text" value={maskDestination(activeWithdrawal.destination)} disabled readOnly /></label>
                <TurnstileField action="withdrawal-retry" />
                <button className="button button-light button-lg" type="submit" disabled={!recoveryAuthorityReady}>{recoveryAuthorityReady ? "Continue payout" : "Recovery not ready"}</button>
                <small>{activeWithdrawal.status === "submitted" ? "Provider outcome may be uncertain, so the original payout identity is preserved." : "The reserved pack must still match current read proof before first send."}</small>
              </form>
            )}
          </>
        ) : (
          <>
            <div><span className="app-eyebrow">Release value</span><h2>Withdraw when every proof agrees.</h2><p>Balance, pack and provider proof must all line up before credits can be reserved.</p></div>
            <form action="/api/withdrawals" method="post" className="withdrawal-form">
              <label>FaucetPay destination<input name="destination" type="text" required maxLength={200} autoComplete="off" placeholder="Email, username or linked address" disabled={!state.signedIn || !payout.ready || !readProofReady} /></label>
              <TurnstileField action="withdrawal" />
              <button className="button button-light button-lg" type="submit" disabled={!canWithdraw}>{canWithdraw ? `Withdraw ${payout.display}` : !payoutCredits || state.preview ? "Payout target not active" : !readProofReady ? "Payout proof in progress" : missingCredits && missingCredits > 0 ? `${formatUsdFromCredits(missingCredits)} to go` : "Withdrawal unavailable"}</button>
              <small>Destination validation is read-only. Send authority is isolated to the final payout call.</small>
            </form>
          </>
        )}
      </section>

      <div className="wallet-grid pc-luxe-vault-grid">
        <section className="transaction-card">
          <div className="app-section-head"><div><span className="app-eyebrow">Ledger</span><h2>Value history</h2></div></div>
          {rows.length ? rows.map((row) => {
            const positive = row.credits > 0;
            return <div className="transaction-row" key={row.id}><span className={`transaction-status ${positive ? "positive" : "neutral"}`}><Check /></span><div><strong>{row.label}</strong><small>{compactDate(row.createdAt)} · {row.state}</small></div><b className={positive ? "positive" : "neutral"}>{formatUsdFromCredits(row.credits, true)}</b></div>;
          }) : <div className="empty-ledger">{state.preview ? "Live activity appears after connection." : "Your first verified reward starts the ledger here."}</div>}
        </section>
        <aside className="trust-card pc-luxe-vault-trust"><Shield /><span className="app-eyebrow">Settlement path</span><h3>Proof → reserve → payout.</h3><p>Unknown provider outcomes stay reserved and reuse the same identity.</p><div className="state-list"><span className="done">Proof</span><span className="done">Available</span><span className="active">Reserved</span><span>Paid</span></div></aside>
      </div>
    </AppShell>
  );
}
