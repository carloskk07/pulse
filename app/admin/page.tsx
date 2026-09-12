import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getDirectCampaignSnapshot } from "@/lib/direct-campaigns";
import { getReleaseReadiness } from "@/lib/release-readiness";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTreasurySnapshot } from "@/lib/treasury";

export const metadata = { title: "Operations" };
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

function badgeClass(state: string) {
  if (state === "SETUP_REQUIRED") return "admin-badge setup";
  if (state === "READY_FOR_EXTERNAL_PROOF") return "admin-badge proof";
  return "admin-badge";
}

export default async function AdminEconomicsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) notFound();

  const [readiness, treasuries, direct] = await Promise.all([
    getReleaseReadiness(),
    getTreasurySnapshot(),
    getDirectCampaignSnapshot(),
  ]);
  const admin = createSupabaseAdminClient();

  let snapshot: Snapshot = {};
  let economicsError = true;
  if (admin) {
    const now = new Date();
    const from = new Date(now);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
    const result = await admin.rpc("admin_economics_snapshot", { p_from: from.toISOString(), p_to: to.toISOString() });
    snapshot = (result.data ?? {}) as Snapshot;
    economicsError = Boolean(result.error) || snapshot.status !== "ok";
  }

  const revenue = Number(snapshot.revenue_micros ?? 0);
  const rewards = Number(snapshot.reward_credits ?? 0);
  const contribution = Number(snapshot.contribution_micros ?? 0);
  const active = Number(snapshot.active_users ?? 0);
  const conversions = Number(snapshot.conversions ?? 0);
  const chargebacks = Number(snapshot.chargebacks ?? 0);
  const margin = revenue > 0 ? (contribution / revenue) * 100 : 0;
  const arpDau = active > 0 ? revenue / 1_000_000 / active : 0;
  const contributionDau = active > 0 ? contribution / 1_000_000 / active : 0;
  const launchTreasury = treasuries.find((item) => item.code === "launch") ?? treasuries[0] ?? null;

  return (
    <AppShell active="admin">
      <div className="admin-head"><div><span className="app-eyebrow">Private operations</span><h1>Release + economics cockpit</h1><p>Production authority requires working contracts, bounded treasury risk and external evidence, not only a green build.</p></div><span className={badgeClass(readiness.state)}>{readiness.state.replaceAll("_", " ")}</span></div>

      <section className="readiness-panel">
        <div className="readiness-summary"><div><span className="app-eyebrow">Release authority</span><h2>{readiness.ready ? "Production gate closed cleanly." : readiness.state === "READY_FOR_EXTERNAL_PROOF" ? "Automated gates pass. External proof remains." : "Production promotion is blocked."}</h2><p>The checklist verifies public URL, authentication authority, financial integrations, Reward Exchange contracts, database schema and controlled external evidence.</p></div><div className="readiness-counts"><span>{readiness.passed} pass</span><span>{readiness.failed} fail</span><span>{readiness.pending} pending</span></div></div>
        <div className="readiness-list">{readiness.checks.map((item) => <article className={`readiness-item ${item.status}`} key={item.id}><span className="readiness-dot" /><div><strong>{item.label}</strong><small>{item.detail}</small></div></article>)}</div>
      </section>

      {economicsError ? <div className="preview-banner">Economics snapshot is not authoritative yet. Apply migrations through 0013 and complete the setup blockers shown above.</div> : null}

      <section className="admin-kpi-grid">
        <article className="admin-kpi primary"><span>Total monetization revenue</span><strong>{moneyFromMicros(revenue)}</strong><small>Provider + Pulse Direct confirmed economics</small></article>
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
        <div className="app-section-head"><div><span className="app-eyebrow">Reward liquidity</span><h2>Launch Treasury</h2></div><span className={`admin-badge ${launchTreasury?.enabled && !launchTreasury.killSwitch ? "" : "setup"}`}>{launchTreasury?.enabled && !launchTreasury.killSwitch ? "OPEN" : "CLOSED"}</span></div>
        {launchTreasury ? <div className="admin-secondary-grid"><article><span>Funded</span><strong>{moneyFromCredits(launchTreasury.fundedCredits)}</strong></article><article><span>Available</span><strong>{moneyFromCredits(launchTreasury.availableCredits)}</strong></article><article><span>Reserved</span><strong>{moneyFromCredits(launchTreasury.reservedCredits)}</strong></article><article><span>Spent</span><strong>{moneyFromCredits(launchTreasury.spentCredits)}</strong></article><article><span>Daily budget</span><strong>{moneyFromCredits(launchTreasury.dailyBudgetCredits)}</strong></article><article><span>User/day cap</span><strong>{moneyFromCredits(launchTreasury.maxUserDailyCredits)}</strong></article><article><span>Enabled</span><strong>{launchTreasury.enabled ? "Yes" : "No"}</strong></article><article><span>Kill switch</span><strong>{launchTreasury.killSwitch ? "ON" : "OFF"}</strong></article></div> : <div className="empty-ledger">Treasury contract is not available until migration 0011 is applied.</div>}
        <p className="admin-panel-note">A boost must reserve real treasury budget before it can be advertised. The launch treasury starts closed with zero funding by design.</p>
      </section>

      <section className="admin-panel">
        <div className="app-section-head"><div><span className="app-eyebrow">Owned inventory</span><h2>Pulse Direct</h2></div><span className={`admin-badge ${direct.activeCount > 0 ? "" : "setup"}`}>{direct.activeCount} ACTIVE</span></div>
        <div className="admin-secondary-grid">
          <article><span>Advertiser funding</span><strong>{moneyFromMicros(direct.fundedUsdMicros)}</strong></article>
          <article><span>Reserved sessions</span><strong>{moneyFromMicros(direct.reservedUsdMicros)}</strong></article>
          <article><span>Settled spend</span><strong>{moneyFromMicros(direct.spentUsdMicros)}</strong></article>
          <article><span>Gross contribution</span><strong>{moneyFromMicros(direct.grossContributionUsdMicros)}</strong></article>
          <article><span>Campaigns</span><strong>{direct.campaignCount}</strong></article>
          <article><span>Active</span><strong>{direct.activeCount}</strong></article>
        </div>
        <div className="admin-provider-table direct-campaign-table">
          <div className="admin-provider-row header"><span>Campaign</span><span>Funded</span><span>User reward</span><span>Completions</span><span>Status</span></div>
          {direct.campaigns.length ? direct.campaigns.map((campaign) => (
            <div className="admin-provider-row" key={campaign.id}>
              <strong className="direct-campaign-title">{campaign.title}<small>{campaign.advertiserName} · {campaign.actionType}</small></strong>
              <span>{moneyFromMicros(campaign.fundedUsdMicros)}</span>
              <span>{moneyFromCredits(campaign.rewardCredits)}</span>
              <span>{campaign.completionCount} / {campaign.maxCompletions}</span>
              <span className={`direct-status ${campaign.status}`}>{campaign.status}</span>
            </div>
          )) : <div className="empty-ledger">No direct advertiser campaign exists yet. Pulse will not synthesize one for appearance.</div>}
        </div>
        <p className="admin-panel-note">A direct campaign starts as a draft, receives operator-verified prefunding, and only then can be activated. Starting a protected Drop reserves one full advertiser action budget before redirecting the user.</p>
      </section>

      <section className="admin-panel">
        <div className="app-section-head"><div><span className="app-eyebrow">Revenue sources</span><h2>Monetization economics</h2></div></div>
        <div className="admin-provider-table"><div className="admin-provider-row header"><span>Source</span><span>Revenue</span><span>Conversions</span><span>Chargebacks</span></div>{(snapshot.providers ?? []).length ? (snapshot.providers ?? []).map((provider) => <div className="admin-provider-row" key={provider.provider}><strong>{provider.provider}</strong><span>{moneyFromMicros(Number(provider.revenue_micros ?? 0))}</span><span>{Number(provider.conversions ?? 0)}</span><span>{Number(provider.chargebacks ?? 0)}</span></div>) : <div className="empty-ledger">No monetization revenue recorded in this UTC day yet.</div>}</div>
      </section>

      <section className="admin-decision-card"><span className="app-eyebrow">North star</span><h2>Contribution per verified active user</h2><strong>${contributionDau.toFixed(4)}</strong><p>Grow traffic only when this stays healthy after rewards, reversals and treasury subsidy. Infrastructure, taxes and paid acquisition are intentionally not claimed as included yet.</p></section>
    </AppShell>
  );
}
