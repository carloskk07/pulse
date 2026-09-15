import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getProductLaunchReadiness } from "@/lib/product-launch-readiness";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Product Readiness" };
export const dynamic = "force-dynamic";

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export default async function ProductReadinessPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/product");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) notFound();

  const readiness = await getProductLaunchReadiness();
  const product = readiness.product;
  const release = readiness.release;

  return (
    <AppShell active="product">
      <div className="admin-head">
        <div>
          <span className="app-eyebrow">Consumer product + launch gate</span>
          <h1>Product readiness</h1>
          <p>No advertiser outreach or growth push should resume until both the real account → Hourly Pulse → ledger → withdrawal → receipt loop and the canonical release gate are proven.</p>
        </div>
        <span className={`admin-badge ${readiness.ready ? "" : "setup"}`}>{readiness.ready ? "PRODUCT READY" : "PRODUCT INCOMPLETE"}</span>
      </div>

      <section className="admin-secondary-grid">
        <article><span>Confirmed optional Turbos</span><strong>{product.confirmedMonetizationEvents}</strong></article>
        <article><span>Paid withdrawals</span><strong>{product.paidWithdrawals}</strong></article>
        <article><span>Base-loop blockers</span><strong>{product.blockers.length}</strong></article>
        <article><span>Release blockers</span><strong>{readiness.releaseBlockers.length}</strong><small>{release.state}</small></article>
      </section>

      <section className="readiness-panel">
        <div className="readiness-summary">
          <div>
            <span className="app-eyebrow">Required core loop</span>
            <h2>{product.ready ? "The base Pulse loop has real causal payout evidence." : "Finish the base product loop."}</h2>
            <p>Configuration alone is insufficient. Base-product readiness requires a real Treasury-backed Hourly Pulse claim, authoritative Wallet ledger continuity, provider-side payout and verified destination receipt on the same account. A specific CPA provider is not a base-product dependency.</p>
          </div>
          <div className="readiness-counts"><span>{product.checks.filter((item) => item.pass).length} pass</span><span>{product.blockers.length} block</span></div>
        </div>
        <div className="readiness-list">
          {product.checks.map((item) => (
            <article className={`readiness-item ${item.pass ? "pass" : "fail"}`} key={item.id}>
              <span className="readiness-dot" />
              <div><strong>{item.label}</strong><small>{item.detail}</small></div>
            </article>
          ))}
        </div>
      </section>

      <section className="readiness-panel">
        <div className="readiness-summary">
          <div>
            <span className="app-eyebrow">Canonical launch authority</span>
            <h2>{release.ready ? "Release gate is READY." : `Release gate remains ${release.state}.`}</h2>
            <p>PRODUCT READY also requires the canonical production origin, security hardening, legal/operator review and the current external evidence chain. A green financial loop cannot override a blocked release gate.</p>
          </div>
          <div className="readiness-counts"><span>{release.passed} pass</span><span>{readiness.releaseBlockers.length} block</span></div>
        </div>
        <div className="readiness-list">
          {release.ready ? (
            <article className="readiness-item pass">
              <span className="readiness-dot" />
              <div><strong>Canonical release gate</strong><small>All blocking release checks are current and proven.</small></div>
            </article>
          ) : readiness.releaseBlockers.map((item) => (
            <article className="readiness-item fail" key={`release-${item.id}`}>
              <span className="readiness-dot" />
              <div><strong>{item.label}</strong><small>{item.detail}</small></div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-decision-card">
        <span className="app-eyebrow">Current rule</span>
        <h2>Product first. Release truth always.</h2>
        <p>Business intake, advertiser prospecting, Sponsored Pulse and network distribution remain dormant capabilities until both the base product loop and every blocking canonical release check are closed with real evidence.</p>
      </section>
    </AppShell>
  );
}
