import { AppShell } from "@/components/app-shell";
import { Check, Shield, Wallet } from "@/components/icons";
import { TurnstileField } from "@/components/turnstile-field";
import { formatUsdFromCredits, getLedgerItems, getRewardSnapshot } from "@/lib/reward-state";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export const metadata = { title: "Wallet" };

type Props = { searchParams: Promise<{ withdraw?: string }> };

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
  "payout-not-configured": "Payouts are not configured yet.",
  "service-not-configured": "The live payout service is not configured yet.",
  "reserve-failed": "The payout could not be reserved. No funds were sent.",
  failed: "The payout failed and the reserved credits were restored.",
};

function compactDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default async function WalletPage({ searchParams }: Props) {
  const [state, rows, params] = await Promise.all([getRewardSnapshot(), getLedgerItems(), searchParams]);
  const payout = getFaucetPayPackConfig();
  const turnstileReady = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
  const serviceReady = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const canWithdraw = state.signedIn && payout.ready && turnstileReady && serviceReady && Boolean(payout.amountCredits) && state.availableCredits >= Number(payout.amountCredits);

  return (
    <AppShell active="wallet">
      <div className="app-page-head"><div><span className="app-eyebrow">Transparent ledger</span><h1>Wallet</h1></div></div>
      {params.withdraw ? <div className={`claim-message ${params.withdraw === "paid" ? "success" : "neutral"}`}>{withdrawalCopy[params.withdraw] ?? "Withdrawal status updated."}</div> : null}
      {state.preview ? <div className="preview-banner">Preview ledger — live entries appear automatically after Supabase is connected.</div> : null}

      <section className="wallet-balance-card"><div className="wallet-big-icon"><Wallet /></div><div><span>Available balance</span><strong>{formatUsdFromCredits(state.availableCredits)}</strong><small>{state.availableCredits.toLocaleString("en-US")} credits</small></div><div className="payout-pack-label"><small>Next payout pack</small><strong>{payout.display || `${Number(payout.amountCredits ?? 5000).toLocaleString("en-US")} credits`}</strong></div></section>

      <section className="withdrawal-panel">
        <div><span className="app-eyebrow">Simple withdrawal</span><h2>Redeem one fixed payout pack.</h2><p>The MVP uses a fixed pack so no price oracle, hidden FX spread or browser-side amount calculation can change what is sent.</p></div>
        <form action="/api/withdrawals" method="post" className="withdrawal-form">
          <label>FaucetPay destination<input name="destination" type="text" required maxLength={200} autoComplete="off" placeholder="Email, username or linked address" disabled={!state.signedIn} /></label>
          <TurnstileField action="withdrawal" />
          <button className="button button-light button-lg" type="submit" disabled={!canWithdraw}>{canWithdraw ? `Withdraw ${payout.display}` : state.availableCredits < Number(payout.amountCredits ?? 5000) ? `Need ${formatUsdFromCredits(Number(payout.amountCredits ?? 5000) - state.availableCredits)} more` : "Payout setup incomplete"}</button>
          <small>FaucetPay v2 idempotency prevents a safe retry from paying twice.</small>
        </form>
      </section>

      <div className="wallet-grid">
        <section className="transaction-card">
          <div className="app-section-head"><div><span className="app-eyebrow">Recent activity</span><h2>Ledger</h2></div></div>
          {rows.length ? rows.map((row) => {
            const positive = row.credits > 0;
            return <div className="transaction-row" key={row.id}><span className={`transaction-status ${positive ? "positive" : "neutral"}`}><Check /></span><div><strong>{row.label}</strong><small>{compactDate(row.createdAt)} · {row.state}</small></div><b className={positive ? "positive" : "neutral"}>{formatUsdFromCredits(row.credits, true)}</b></div>;
          }) : <div className="empty-ledger">No ledger activity yet. Your first verified reward will appear here.</div>}
        </section>
        <aside className="trust-card"><Shield /><span className="app-eyebrow">Payout protection</span><h3>Reserve first. Send once.</h3><p>Credits are atomically reserved before the external payout. A definitive failure reverses that reserve; a transient failure keeps the same idempotency key for safe retry.</p><div className="state-list"><span className="done">Available</span><span className="done">Reserved</span><span className="active">Provider</span><span>Paid</span></div></aside>
      </div>
    </AppShell>
  );
}
