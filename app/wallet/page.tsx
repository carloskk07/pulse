import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Check, Shield, Wallet } from "@/components/icons";

export const metadata = { title: "Wallet" };

const rows = [
  ["Survey completed", "Today · 18:22", "+$0.42", "positive"],
  ["Daily Pulse", "Today · 09:10", "+$0.01", "positive"],
  ["App quest", "Yesterday · 21:04", "+$1.20", "positive"],
  ["Withdrawal", "Sep 8 · 14:31", "−$1.00", "neutral"],
];

export default function WalletPage() {
  return (
    <AppShell active="wallet">
      <div className="app-page-head"><div><span className="app-eyebrow">Transparent ledger</span><h1>Wallet</h1></div></div>
      <section className="wallet-balance-card"><div className="wallet-big-icon"><Wallet /></div><div><span>Available balance</span><strong>$4.82</strong><small>4,820 credits</small></div><button className="button button-light">Withdraw <ArrowUpRight /></button></section>
      <div className="wallet-grid"><section className="transaction-card"><div className="app-section-head"><div><span className="app-eyebrow">Recent activity</span><h2>Ledger</h2></div></div>{rows.map(([name,date,amount,tone]) => <div className="transaction-row" key={`${name}-${date}`}><span className={`transaction-status ${tone}`}><Check /></span><div><strong>{name}</strong><small>{date}</small></div><b className={tone}>{amount}</b></div>)}</section><aside className="trust-card"><Shield /><span className="app-eyebrow">Payout protection</span><h3>Rewards move through clear states.</h3><p>Pending → confirmed → available → withdrawn. No hidden balance edits.</p><div className="state-list"><span className="done">Pending</span><span className="done">Confirmed</span><span className="active">Available</span><span>Withdrawn</span></div></aside></div>
    </AppShell>
  );
}
