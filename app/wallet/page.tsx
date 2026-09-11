import { AppShell } from "@/components/app-shell";
import { Check, Shield, Wallet } from "@/components/icons";
import { formatUsdFromCredits, getLedgerItems, getRewardSnapshot } from "@/lib/reward-state";

export const metadata = { title: "Wallet" };

function compactDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default async function WalletPage() {
  const [state, rows] = await Promise.all([getRewardSnapshot(), getLedgerItems()]);

  return (
    <AppShell active="wallet">
      <div className="app-page-head"><div><span className="app-eyebrow">Transparent ledger</span><h1>Wallet</h1></div></div>
      {state.preview ? <div className="preview-banner">Preview ledger — live entries appear automatically after Supabase is connected.</div> : null}
      <section className="wallet-balance-card"><div className="wallet-big-icon"><Wallet /></div><div><span>Available balance</span><strong>{formatUsdFromCredits(state.availableCredits)}</strong><small>{state.availableCredits.toLocaleString("en-US")} credits</small></div><button className="button button-light" disabled>Withdraw soon</button></section>
      <div className="wallet-grid">
        <section className="transaction-card">
          <div className="app-section-head"><div><span className="app-eyebrow">Recent activity</span><h2>Ledger</h2></div></div>
          {rows.length ? rows.map((row) => {
            const positive = row.credits > 0;
            return <div className="transaction-row" key={row.id}><span className={`transaction-status ${positive ? "positive" : "neutral"}`}><Check /></span><div><strong>{row.label}</strong><small>{compactDate(row.createdAt)} · {row.state}</small></div><b className={positive ? "positive" : "neutral"}>{formatUsdFromCredits(row.credits, true)}</b></div>;
          }) : <div className="empty-ledger">No ledger activity yet. Your first verified reward will appear here.</div>}
        </section>
        <aside className="trust-card"><Shield /><span className="app-eyebrow">Payout protection</span><h3>Rewards move through clear states.</h3><p>Pending → confirmed → available → withdrawn. No hidden balance edits.</p><div className="state-list"><span className="done">Pending</span><span className="done">Confirmed</span><span className="active">Available</span><span>Withdrawn</span></div></aside>
      </div>
    </AppShell>
  );
}
