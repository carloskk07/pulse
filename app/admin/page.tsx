import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Economics" };
export const dynamic = "force-dynamic";

type ProviderRow = { provider: string; revenue_micros: number; conversions: number; chargebacks: number };
type Snapshot = {
  status?: string;
  revenue_micros?: number;
  reward_credits?: number;
  contribution_micros?: number;
  active_users?: number;
  conversions?: number;
  chargebacks?: number;
  claims?: number;
  claim_credits?: number;
  paid_withdrawals?: number;
  paid_withdrawal_credits?: number;
  held_withdrawals?: number;
  new_users?: number;
  total_users?: number;
  providers?: ProviderRow[];
};

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function moneyFromMicros(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value / 1_000_000);
}

function moneyFromCredits(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value / 1000);
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

export default async function AdminEconomicsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) notFound();

  const admin = createSupabaseAdminClient();
  if (!admin) notFound();

  const now = new Date();
  const from = new Date(now);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);

  const { data, error } = await admin.rpc("admin_economics_snapshot", { p_from: from.toISOString(), p_to: to.toISOString() });
  const snapshot = (data ?? {}) as Snapshot;
  const revenue = Number(snapshot.revenue_micros ?? 0);
  const rewards = Number(snapshot.reward_credits ?? 0);
  const contribution = Number(snapshot.contribution_micros ?? 0);
  const active = Number(snapshot.active_users ?? 0);
  const conversions = Number(snapshot.conversions ?? 0);
  const chargebacks = Number(snapshot.chargebacks ?? 0);
  const margin = revenue > 0 ? (contribution / revenue) * 100 : 0;
  const arpDau = active > 0 ? revenue / 1_000_000 / active : 0;
  const contributionDau = active > 0 ? contribution / 1_000_000 / active : 0;

  return (
    <AppShell active="admin">
      <div className="admin-head"><div><span className="app-eyebrow">Private economics</span><h1>Contribution cockpit</h1><p>UTC today · decisions should follow verified margin, not pageviews.</p></div><span className="admin-badge">{error || snapshot.status !== "ok" ? "Setup required" : "Live ledger"}</span></div>

      {error || snapshot.status !== "ok" ? <div className="preview-banner">Apply migration 0005 and configure ADMIN_EMAILS to activate the economics snapshot.</div> : null}

      <section className="admin-kpi-grid">
        <article className="admin-kpi primary"><span>Provider revenue</span><strong>{moneyFromMicros(revenue)}</strong><small>Confirmed provider economics</small></article>
        <article className="admin-kpi"><span>User rewards</span><strong>{moneyFromCredits(rewards)}</strong><small>Claims + earning rewards − reversals</small></article>
        <article className={`admin-kpi ${contribution >= 0 ? "positive" : "danger"}`}><span>Gross contribution</span><strong>{moneyFromMicros(contribution)}</strong><small>{margin.toFixed(1)}% contribution margin</small></article>
        <article className="admin-kpi"><span>Verified active users</span><strong>{active.toLocaleString("en-US")}</strong><small>{arpDau.toFixed(4)} USD revenue / active</small></article>
      </section>

      <section className="admin-secondary-grid">
        <article><span>Contribution / active</span><strong>${contributionDau.toFixed(4)}</strong></article>
        <article><span>Conversions</span><strong>{conversions.toLocaleString("en-US")}</strong></article>
        <article><span>Chargeback rate</span><strong>{ratio(chargebacks, Math.max(conversions, 1)).toFixed(2)}%</strong></article>
        <article><span>Daily Pulse claims</span><strong>{Number(snapshot.claims ?? 0).toLocaleString("en-US")}</strong></article>
        <article><span>Daily Pulse cost</span><strong>{moneyFromCredits(Number(snapshot.claim_credits ?? 0))}</strong></article>
        <article><span>Paid withdrawals</span><strong>{Number(snapshot.paid_withdrawals ?? 0).toLocaleString("en-US")}</strong></article>
        <article><span>Held withdrawals</span><strong>{Number(snapshot.held_withdrawals ?? 0).toLocaleString("en-US")}</strong></article>
        <article><span>New / total users</span><strong>{Number(snapshot.new_users ?? 0)} / {Number(snapshot.total_users ?? 0)}</strong></article>
      </section>

      <section className="admin-panel">
        <div className="app-section-head"><div><span className="app-eyebrow">Revenue sources</span><h2>Provider economics</h2></div></div>
        <div className="admin-provider-table"><div className="admin-provider-row header"><span>Provider</span><span>Revenue</span><span>Conversions</span><span>Chargebacks</span></div>{(snapshot.providers ?? []).length ? (snapshot.providers ?? []).map((provider) => <div className="admin-provider-row" key={provider.provider}><strong>{provider.provider}</strong><span>{moneyFromMicros(Number(provider.revenue_micros ?? 0))}</span><span>{Number(provider.conversions ?? 0)}</span><span>{Number(provider.chargebacks ?? 0)}</span></div>) : <div className="empty-ledger">No provider revenue recorded in this UTC day yet.</div>}</div>
      </section>

      <section className="admin-decision-card"><span className="app-eyebrow">North star</span><h2>Contribution per verified active user</h2><strong>${contributionDau.toFixed(4)}</strong><p>Grow traffic only when this stays healthy after rewards and reversals. Infrastructure, taxes and paid acquisition are intentionally not claimed as included yet.</p></section>
    </AppShell>
  );
}
