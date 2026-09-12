import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getProductReadiness } from "@/lib/product-readiness";
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

  const readiness = await getProductReadiness();

  return (
    <AppShell active="product">
      <div className="admin-head">
        <div>
          <span className="app-eyebrow">Consumer product gate</span>
          <h1>Product readiness</h1>
          <p>No advertiser outreach or growth push should resume until the real account → earn → ledger → withdrawal → payout loop is proven.</p>
        </div>
        <span className={`admin-badge ${readiness.ready ? "" : "setup"}`}>{readiness.ready ? "PRODUCT READY" : "PRODUCT INCOMPLETE"}</span>
      </div>

      <section className="admin-secondary-grid">
        <article><span>Confirmed monetization events</span><strong>{readiness.confirmedMonetizationEvents}</strong></article>
        <article><span>Paid withdrawals</span><strong>{readiness.paidWithdrawals}</strong></article>
        <article><span>Blocking gates</span><strong>{readiness.blockers.length}</strong></article>
      </section>

      <section className="readiness-panel">
        <div className="readiness-summary">
          <div>
            <span className="app-eyebrow">Required core loop</span>
            <h2>{readiness.ready ? "The consumer loop has real external evidence." : "Finish the product before go-to-market."}</h2>
            <p>Configuration alone is insufficient. Product readiness requires a real earning event and a real controlled payout, in addition to the production security and provider configuration.</p>
          </div>
          <div className="readiness-counts"><span>{readiness.checks.filter((item) => item.pass).length} pass</span><span>{readiness.blockers.length} block</span></div>
        </div>
        <div className="readiness-list">
          {readiness.checks.map((item) => (
            <article className={`readiness-item ${item.pass ? "pass" : "fail"}`} key={item.id}>
              <span className="readiness-dot" />
              <div><strong>{item.label}</strong><small>{item.detail}</small></div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-decision-card">
        <span className="app-eyebrow">Current rule</span>
        <h2>Product first.</h2>
        <p>Business intake, prospecting and future direct-campaign acquisition remain dormant capabilities. The next engineering work must attack the first failing check above.</p>
      </section>
    </AppShell>
  );
}
