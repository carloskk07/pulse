import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getDirectCampaignSnapshot } from "@/lib/direct-campaigns";
import { getOperatorNextAction } from "@/lib/experience-presentation";
import { getProductLaunchReadiness } from "@/lib/product-launch-readiness";
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

  const [launchReadiness, treasuries, direct] = await Promise.all([
    getProductLaunchReadiness(),
    getTreasurySnapshot(),
    getDirectCampaignSnapshot(),
  ]);
  const readiness = launchReadiness.release;
  const product = launchReadiness.product;
  const admin = createSupabaseAdminClient();

  let snapshot: Snapshot = {};
  let economicsError = true;
  if (admin) {
    const now = new Date();
    const from = new Date(now);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
    const result = await admin.rpc("admin_economics_snapshot", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
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
  const contributionDau = active > 0 ? contribution / 1_000_000 / active : 0;
  const launchTreasury = treasuries.find((item) => item.code === "launch") ?? treasuries[0] ?? null;
  const faucetReadReady = product.checks.find((item) => item.id === "faucetpay-read-proof")?.pass === true;
  const faucetSendReady = product.checks.find((item) => item.id === "faucetpay-send-scope-proof")?.pass === true;
  const receiptProven = product.checks.find((item) => item.id === "payout-receipt-proof")?.pass === true;
  const paidWithdrawalCount = Math.max(Number(snapshot.paid_withdrawals ?? 0), Number(product.paidWithdrawals ?? 0));
  const nextAction = getOperatorNextAction({
    faucetPayConnected: faucetReadReady && faucetSendReady,
    paidWithdrawalCount,
    receiptProven,
    productReady: product.ready,
    releaseReady: readiness.ready,
  });

  return (
    <AppShell active="admin">
      <div className="admin-head">
        <div>
          <span className="app-eyebrow">Private operations</span>
          <h1>One blocker at a time.</h1>
          <p>PulseCircuit keeps the highest-value operator action open and moves deep diagnostics out of the primary workflow.</p>
        </div>
        <span className={badgeClass(readiness.state)}>{readiness.state.replaceAll("_", " ")}</span>
      </div>

      <section className="admin-decision-card">
        <span className="app-eyebrow">{nextAction.eyebrow}</span>
        <h2>{nextAction.title}</h2>
        <p>{nextAction.detail}</p>
        <Link className="button" href={nextAction.href}>{nextAction.actionLabel}</Link>
      </section>

      <section className="admin-kpi-grid" aria-label="Operator summary">
        <article className={"admin-kpi " + (readiness.ready ? "positive" : "danger")}>
          <span>Canonical release</span>
          <strong>{readiness.ready ? "READY" : readiness.state.replaceAll("_", " ")}</strong>
          <small>{readiness.failed} fail · {readiness.pending} pending</small>
        </article>
        <article className={"admin-kpi " + (product.ready ? "positive" : "danger")}>
          <span>Base product loop</span>
          <strong>{product.ready ? "PROVEN" : "INCOMPLETE"}</strong>
          <small>{product.blockers.length} blocker{product.blockers.length === 1 ? "" : "s"}</small>
        </article>
        <article className="admin-kpi">
          <span>Treasury available</span>
          <strong>{launchTreasury ? moneyFromCredits(launchTreasury.availableCredits) : "—"}</strong>
          <small>{launchTreasury?.enabled && !launchTreasury.killSwitch ? "Open" : "Closed / limited"}</small>
        </article>
        <article className="admin-kpi">
          <span>Paid withdrawals</span>
          <strong>{paidWithdrawalCount.toLocaleString("en-US")}</strong>
          <small>{receiptProven ? "Receipt chain proven" : "Receipt chain still open"}</small>
        </article>
      </section>

      {economicsError ? (
        <div className="preview-banner">Economics telemetry is unavailable. No financial authority is inferred from missing telemetry.</div>
      ) : null}

      <details className="readiness-panel">
        <summary><strong>Launch diagnostics</strong> · {readiness.passed} pass · {readiness.failed} fail · {readiness.pending} pending</summary>
        <div className="readiness-summary">
          <div>
            <span className="app-eyebrow">Release authority</span>
            <h2>{readiness.ready ? "Canonical launch gate is proven." : "Only failed or pending gates should drive work."}</h2>
            <p>Deep release checks stay available here without competing with the current operator action.</p>
          </div>
        </div>
        <div className="readiness-list">
          {readiness.checks.map((item) => (
            <article className={"readiness-item " + item.status} key={item.id}>
              <span className="readiness-dot" />
              <div><strong>{item.label}</strong><small>{item.detail}</small></div>
            </article>
          ))}
        </div>
        <Link className="button button-secondary" href="/admin/product">Open full product readiness</Link>
      </details>

      <details className="admin-panel">
        <summary><strong>Treasury & economics</strong> · operational telemetry</summary>
        <div className="admin-kpi-grid">
          <article className="admin-kpi primary"><span>Monetization revenue</span><strong>{moneyFromMicros(revenue)}</strong><small>Confirmed provider + direct economics</small></article>
          <article className="admin-kpi"><span>User rewards</span><strong>{moneyFromCredits(rewards)}</strong><small>Rewards less reversals</small></article>
          <article className={"admin-kpi " + (contribution >= 0 ? "positive" : "danger")}><span>Gross contribution</span><strong>{moneyFromMicros(contribution)}</strong><small>{margin.toFixed(1)}% contribution margin</small></article>
          <article className="admin-kpi"><span>Verified active users</span><strong>{active.toLocaleString("en-US")}</strong><small>Real activity only</small></article>
        </div>

        {launchTreasury ? (
          <div className="admin-secondary-grid">
            <article><span>Funded</span><strong>{moneyFromCredits(launchTreasury.fundedCredits)}</strong></article>
            <article><span>Available</span><strong>{moneyFromCredits(launchTreasury.availableCredits)}</strong></article>
            <article><span>Reserved</span><strong>{moneyFromCredits(launchTreasury.reservedCredits)}</strong></article>
            <article><span>Spent</span><strong>{moneyFromCredits(launchTreasury.spentCredits)}</strong></article>
            <article><span>Daily budget</span><strong>{moneyFromCredits(launchTreasury.dailyBudgetCredits)}</strong></article>
            <article><span>User/day cap</span><strong>{moneyFromCredits(launchTreasury.maxUserDailyCredits)}</strong></article>
            <article><span>Kill switch</span><strong>{launchTreasury.killSwitch ? "ON" : "OFF"}</strong></article>
            <article><span>Contribution / active</span><strong>{"$" + contributionDau.toFixed(4)}</strong></article>
          </div>
        ) : <div className="empty-ledger">Treasury authority is unavailable.</div>}

        <div className="admin-secondary-grid">
          <article><span>Conversions</span><strong>{conversions.toLocaleString("en-US")}</strong></article>
          <article><span>Chargeback rate</span><strong>{ratio(chargebacks, Math.max(conversions, 1)).toFixed(2)}%</strong></article>
          <article><span>Daily Pulse claims</span><strong>{Number(snapshot.claims ?? 0).toLocaleString("en-US")}</strong></article>
          <article><span>Daily Pulse cost</span><strong>{moneyFromCredits(Number(snapshot.claim_credits ?? 0))}</strong></article>
          <article><span>Held withdrawals</span><strong>{Number(snapshot.held_withdrawals ?? 0).toLocaleString("en-US")}</strong></article>
          <article><span>New / total users</span><strong>{Number(snapshot.new_users ?? 0)} / {Number(snapshot.total_users ?? 0)}</strong></article>
        </div>
      </details>

      <details className="admin-panel">
        <summary><strong>Growth systems</strong> · intentionally secondary until launch gates close</summary>
        <div className="app-section-head">
          <div><span className="app-eyebrow">Pulse Direct</span><h2>Real campaigns only.</h2></div>
          <span className={"admin-badge " + (direct.activeCount > 0 ? "" : "setup")}>{direct.activeCount} ACTIVE</span>
        </div>
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
              <span className={"direct-status " + campaign.status}>{campaign.status}</span>
            </div>
          )) : <div className="empty-ledger">No direct advertiser campaign exists. No demo campaign is synthesized.</div>}
        </div>

        <div className="admin-provider-table">
          <div className="admin-provider-row header"><span>Source</span><span>Revenue</span><span>Conversions</span><span>Chargebacks</span></div>
          {(snapshot.providers ?? []).length ? (snapshot.providers ?? []).map((provider) => (
            <div className="admin-provider-row" key={provider.provider}>
              <strong>{provider.provider}</strong>
              <span>{moneyFromMicros(Number(provider.revenue_micros ?? 0))}</span>
              <span>{Number(provider.conversions ?? 0)}</span>
              <span>{Number(provider.chargebacks ?? 0)}</span>
            </div>
          )) : <div className="empty-ledger">No monetization revenue recorded in this UTC day yet.</div>}
        </div>
      </details>
    </AppShell>
  );
}
