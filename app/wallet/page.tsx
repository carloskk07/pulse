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
  paid: "Payout completed through FaucetPay.",
  processing: "Your payout is reserved and being recovered safely with the same payout identity.",
  held: "Your payout is reserved safely while it is reviewed.",
  insufficient: "Your balance has not reached the current withdrawal target yet.",
  "already-processing": "A payout is already in progress for this account.",
  "invalid-destination": "FaucetPay could not verify that destination.",
  "provider-temporary": "FaucetPay is temporarily unavailable. Your balance was not changed.",
  "verification-failed": "Human verification failed. Please try again.",
  "verification-not-configured": "Withdrawal verification is not configured yet.",
  "payout-not-configured": "The current payout pack has not finished its live proof yet.",
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
      <div className="app-page-head pc-v5-wallet-head"><div><span className="app-eyebrow">Your value, clearly separated</span><h1>Wallet</h1><p>See what is available, what is reserved and what has actually been paid — without mixing those states together.</p></div></div>
      {params.withdraw ? <div className={`claim-message ${params.withdraw === "paid" ? "success" : "neutral"}`}>{withdrawalCopy[params.withdraw] ?? "Withdrawal status updated."}</div> : null}
      {state.preview ? <div className="preview-banner">Live balance, ledger history and payout targets appear only when the authoritative reward service is connected.</div> : null}

      <section className="wallet-balance-card pc-v5-wallet-balance"><div className="wallet-big-icon"><Wallet /></div><div><span>Available now</span><strong>{state.preview ? "Not connected" : formatUsdFromCredits(state.availableCredits)}</strong>{!state.preview ? <small>{state.availableCredits.toLocaleString("en-US")} authoritative credits</small> : null}</div><div className="payout-pack-label"><small>{activeWithdrawal ? "Reserved payout" : "Current payout target"}</small><strong>{payoutPackLabel}</strong></div></section>

      <section className="withdrawal-panel pc-v5-withdrawal-panel">
        {activeWithdrawal ? (
          <>
            <div><span className="app-eyebrow">Payout protection</span><h2>{activeWithdrawal.status === "held" ? "Your value is reserved while review finishes." : "Your payout keeps one identity from start to finish."}</h2><p>{activeWithdrawal.status === "held" ? "Those credits remain reserved and no provider retry can run while this payout is held." : "Recovery reuses the original provider identity and amount, protecting you from a second accidental payout attempt."}</p></div>
            {activeWithdrawal.status === "held" ? (
              <div className="claim-message neutral">Held since {compactDate(activeWithdrawal.created_at)} · {maskDestination(activeWithdrawal.destination)}</div>
            ) : (
              <form action="/api/withdrawals" method="post" className="withdrawal-form">
                <label>Reserved destination<input type="text" value={maskDestination(activeWithdrawal.destination)} disabled readOnly /></label>
                <TurnstileField action="withdrawal-retry" />
                <button className="button button-light button-lg" type="submit" disabled={!recoveryAuthorityReady}>{recoveryAuthorityReady ? "Continue protected payout" : "Recovery setup incomplete"}</button>
                <small>{activeWithdrawal.status === "submitted" ? "The provider outcome may already be uncertain, so Pulsercuit preserves the original payout identity." : "The reserved pack must still match the current proven pack before its first send."}</small>
              </form>
            )}
          </>
        ) : (
          <>
            <div><span className="app-eyebrow">From progress to payout</span><h2>Withdraw only when the path is proven.</h2><p>Your balance is never enough by itself. The payout pack, provider units and read-only proof must all agree before a new withdrawal can reserve credits.</p></div>
            <form action="/api/withdrawals" method="post" className="withdrawal-form">
              <label>FaucetPay destination<input name="destination" type="text" required maxLength={200} autoComplete="off" placeholder="Email, username or linked address" disabled={!state.signedIn || !payout.ready || !readProofReady} /></label>
              <TurnstileField action="withdrawal" />
              <button className="button button-light button-lg" type="submit" disabled={!canWithdraw}>{canWithdraw ? `Withdraw ${payout.display}` : !payoutCredits || state.preview ? "Payout target not active yet" : !readProofReady ? "Payout proof still in progress" : missingCredits && missingCredits > 0 ? `${formatUsdFromCredits(missingCredits)} to go` : "Withdrawal unavailable"}</button>
              <small>Your destination is checked with read-only authority. The separate send key is used only for the final idempotent payout call.</small>
            </form>
          </>
        )}
      </section>

      <div className="wallet-grid pc-v5-wallet-grid">
        <section className="transaction-card">
          <div className="app-section-head"><div><span className="app-eyebrow">Your money trail</span><h2>Ledger</h2></div></div>
          {rows.length ? rows.map((row) => {
            const positive = row.credits > 0;
            return <div className="transaction-row" key={row.id}><span className={`transaction-status ${positive ? "positive" : "neutral"}`}><Check /></span><div><strong>{row.label}</strong><small>{compactDate(row.createdAt)} · {row.state}</small></div><b className={positive ? "positive" : "neutral"}>{formatUsdFromCredits(row.credits, true)}</b></div>;
          }) : <div className="empty-ledger">{state.preview ? "Live activity appears once the reward service is connected." : "Your first verified reward will begin the ledger here."}</div>}
        </section>
        <aside className="trust-card pc-v5-wallet-trust"><Shield /><span className="app-eyebrow">Protected payout path</span><h3>Prove. Reserve. Pay. Recover safely.</h3><p>New payouts require current read-only proof. Uncertain provider outcomes stay reserved and retry the same identity instead of risking duplicate payment.</p><div className="state-list"><span className="done">Proof</span><span className="done">Available</span><span className="active">Reserved</span><span>Paid</span></div></aside>
      </div>
    </AppShell>
  );
}
