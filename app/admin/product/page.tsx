import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getProductLaunchReadiness } from "@/lib/product-launch-readiness";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyPasswordBreachProtection } from "./actions";

export const metadata = { title: "Product Readiness" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ security?: string }> };

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export default async function ProductReadinessPage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/product");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) notFound();

  const [readiness, params] = await Promise.all([
    getProductLaunchReadiness(),
    searchParams,
  ]);
  const product = readiness.product;
  const release = readiness.release;
  const breachProtection = product.checks.find((item) => item.id === "auth-hardening-proof");

  return (
    <AppShell active="advanced">
      <div className="admin-head">
        <div>
          <span className="app-eyebrow">Controlled technical readiness</span>
          <h1>Product readiness</h1>
          <p>The technical faucet gate is separate from broader public/global governance. Real security, funding, ledger continuity, payout and receipt remain mandatory.</p>
        </div>
        <span className={`admin-badge ${readiness.technicalReady ? "" : "setup"}`}>{readiness.technicalReady ? "TECHNICALLY READY" : "TECHNICAL GATES OPEN"}</span>
      </div>

      <section className="admin-secondary-grid">
        <article><span>Confirmed optional Turbos</span><strong>{product.confirmedMonetizationEvents}</strong></article>
        <article><span>Paid withdrawals</span><strong>{product.paidWithdrawals}</strong></article>
        <article><span>Base-loop blockers</span><strong>{product.blockers.length}</strong></article>
        <article><span>Technical release blockers</span><strong>{readiness.releaseBlockers.length}</strong><small>{release.state}</small></article>
        <article><span>Public expansion blockers</span><strong>{readiness.publicExpansionBlockers.length}</strong><small>{readiness.publicLaunchReady ? "PUBLIC READY" : "SEPARATE REVIEW"}</small></article>
      </section>

      <section className="admin-decision-card">
        <span className="app-eyebrow">Password security without Pro</span>
        <h2>{breachProtection?.pass ? "Free leaked-password screening is proven." : "Verify the free leaked-password control."}</h2>
        <p>New passwords are checked with the free Have I Been Pwned Pwned Passwords range API using SHA-1 k-anonymity, response padding and no API key. The full password and full hash never leave Pulsercuit.</p>
        {params.security === "breach-protection-proven" ? <div className="auth-alert success">Live breach-protection evidence recorded.</div> : null}
        {params.security === "breach-probe-unavailable" ? <div className="auth-alert error">The external breach-password probe was unavailable. No proof was recorded.</div> : null}
        {params.security === "breach-proof-record-failed" ? <div className="auth-alert error">The live probe passed, but evidence persistence failed.</div> : null}
        {!breachProtection?.pass ? (
          <form action={verifyPasswordBreachProtection}>
            <button className="button" type="submit">Verify free breach protection</button>
          </form>
        ) : null}
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
            <span className="app-eyebrow">Technical release authority</span>
            <h2>{release.ready ? "Technical release gate is READY." : `Technical release gate remains ${release.state}.`}</h2>
            <p>This gate covers canonical production, runtime contracts, security hardening and current external technical evidence. Legal/operator and international-transfer review are tracked separately as public/global governance advisories.</p>
          </div>
          <div className="readiness-counts"><span>{release.passed} pass</span><span>{readiness.releaseBlockers.length} block</span></div>
        </div>
        <div className="readiness-list">
          {release.ready ? (
            <article className="readiness-item pass">
              <span className="readiness-dot" />
              <div><strong>Technical release gate</strong><small>All blocking technical release checks are current and proven.</small></div>
            </article>
          ) : readiness.releaseBlockers.map((item) => (
            <article className="readiness-item fail" key={`release-${item.id}`}>
              <span className="readiness-dot" />
              <div><strong>{item.label}</strong><small>{item.detail}</small></div>
            </article>
          ))}
        </div>
      </section>

      <section className="readiness-panel">
        <div className="readiness-summary">
          <div>
            <span className="app-eyebrow">Public/global governance</span>
            <h2>{readiness.publicLaunchReady ? "Public expansion gates are complete." : "Public expansion stays separate from the controlled faucet."}</h2>
            <p>Pilot isolation, operator identity, qualified legal review and international-transfer review remain explicit before broad public/global expansion, but they do not make the controlled technical service unhealthy.</p>
          </div>
          <div className="readiness-counts"><span>{readiness.publicExpansionBlockers.length} open</span></div>
        </div>
        <div className="readiness-list">
          {readiness.publicExpansionBlockers.length ? readiness.publicExpansionBlockers.map((item) => (
            <article className="readiness-item pending" key={`public-${item.id}`}>
              <span className="readiness-dot" />
              <div><strong>{item.label}</strong><small>{item.detail}</small></div>
            </article>
          )) : (
            <article className="readiness-item pass">
              <span className="readiness-dot" />
              <div><strong>Public governance</strong><small>No tracked governance advisory remains.</small></div>
            </article>
          )}
        </div>
      </section>

      <section className="admin-decision-card">
        <span className="app-eyebrow">Current rule</span>
        <h2>Technical truth first. Scale deliberately.</h2>
        <p>The controlled faucet can become technically ready without paid Supabase features or a formal corporate identity. Broad public/global expansion remains a separate governance decision, while funding and all real-money gates stay fail-closed.</p>
      </section>
    </AppShell>
  );
}
