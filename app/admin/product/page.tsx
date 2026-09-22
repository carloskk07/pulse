import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getProductLaunchReadiness } from "@/lib/product-launch-readiness";
import { getFaucetContinuousLaunchPlan } from "@/lib/faucet-continuous-launch";
import { getAdminAccess } from "@/lib/admin-authorization";
import { getTreasuryDailyFundingState } from "@/lib/treasury";
import { fundLaunchTreasury, verifyPasswordBreachProtection } from "./actions";

export const metadata = { title: "Product Readiness" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ security?: string; funding?: string }> };

export default async function ProductReadinessPage({ searchParams }: Props) {
  const adminAccess = await getAdminAccess();
  if (adminAccess.status === "unauthenticated") redirect("/auth?next=/admin/product");
  if (adminAccess.status !== "authorized") notFound();

  const [readiness, launchTreasury, continuousLaunch, params] = await Promise.all([
    getProductLaunchReadiness(),
    getTreasuryDailyFundingState("launch"),
    getFaucetContinuousLaunchPlan(),
    searchParams,
  ]);
  const product = readiness.product;
  const release = readiness.release;
  const breachProtection = product.checks.find((item) => item.id === "auth-hardening-proof");
  const fundingIntentId = randomUUID();
  const fundingNeeded = Boolean(launchTreasury && launchTreasury.fundingGapCredits > 0);

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


      <section className="admin-decision-card">
        <span className="app-eyebrow">Continuous hourly authority</span>
        <h2>{continuousLaunch.available ? "Stage: " + continuousLaunch.stage.replaceAll("_", " ") : "Continuous launch authority unavailable."}</h2>
        <p>The user is governed by time, not an arbitrary daily claim count. The configured daily user ceiling must cover every possible hourly window, while the global UTC-day budget and backing remain the financial brakes.</p>
        {continuousLaunch.available ? (
          <>
            <div className="admin-secondary-grid">
              <article><span>Hourly cadence</span><strong>{continuousLaunch.intervalMinutes} min</strong><small>{continuousLaunch.windowsPerDay} windows/day</small></article>
              <article><span>Natural user ceiling</span><strong>{continuousLaunch.naturalDailyCeilingCredits} P</strong><small>{continuousLaunch.cadenceUnrestricted ? "NO ARTIFICIAL USER CAP" : "CAP TOO LOW"}</small></article>
              <article><span>Configured user authority</span><strong>{continuousLaunch.configuredUserDailyCredits} P</strong><small>Must cover the natural hourly ceiling</small></article>
              <article><span>Global daily budget</span><strong>{continuousLaunch.dailyBudgetCredits} P</strong><small>Fair-share target ≥ {continuousLaunch.minimumFairShareBudgetCredits} P</small></article>
              <article><span>Reward engine</span><strong>{continuousLaunch.variableRewardsEnabled ? continuousLaunch.minRewardCredits + "–" + continuousLaunch.maxRewardCredits + " P" : continuousLaunch.baseRewardCredits + " P fixed"}</strong><small>Expected {continuousLaunch.expectedRewardCredits.toFixed(2)} P/claim</small></article>
              <article><span>Backing</span><strong>{continuousLaunch.backingReady ? "FRESH" : "REFRESH REQUIRED"}</strong></article>
              <article><span>Day-one gap</span><strong>{continuousLaunch.dayOneFundingGapCredits} P</strong><small>{continuousLaunch.dayOneFundingGapCredits === 0 ? "COVERED" : "FUND BEFORE OPEN"}</small></article>
              <article><span>Payout pack</span><strong>{continuousLaunch.payoutPackCredits} P</strong><small>Current canonical provider pack</small></article>
            </div>
            <p className="admin-panel-note"><strong>{continuousLaunch.cadenceUnrestricted ? "A genuine member can use every hourly window without hitting an artificial account quota." : "Current per-account authority would still interrupt a fully active member."}</strong> Variable monetary rewards remain separately gated until their budget and jurisdictional review are ready.</p>
          </>
        ) : null}
      </section>

      <section className="admin-decision-card treasury-funding-card">
        <span className="app-eyebrow">Backed Treasury funding</span>
        <h2>{fundingNeeded ? "An exact Treasury top-up is required." : "Treasury backing covers the remaining UTC-day budget."}</h2>
        <p>Funding is fail-closed. Pulsercuit tops up only the uncovered portion of today&apos;s remaining budget, then requires the live FaucetPay balance to cover current financial liabilities plus all Treasury capacity that would remain spendable after the top-up. This action never calls the payout endpoint.</p>
        {launchTreasury ? (
          <div className="admin-secondary-grid treasury-funding-metrics">
            <article><span>Available</span><strong>{launchTreasury.availableCredits.toLocaleString("en-US")} P</strong></article>
            <article><span>Remaining today</span><strong>{launchTreasury.remainingDailyBudgetCredits.toLocaleString("en-US")} P</strong></article>
            <article><span>Exact top-up</span><strong>{launchTreasury.fundingGapCredits.toLocaleString("en-US")} P</strong></article>
            <article><span>Daily budget</span><strong>{launchTreasury.dailyBudgetCredits.toLocaleString("en-US")} P</strong></article>
          </div>
        ) : null}
        {params.funding === "funded" ? <div className="auth-alert success">The exact live-backed Treasury gap was added and audit evidence was recorded.</div> : null}
        {params.funding === "already-funded" ? <div className="auth-alert success">This funding intent was already recorded. No duplicate funding was created.</div> : null}
        {params.funding === "already-covered" ? <div className="auth-alert success">Treasury already covers the remaining UTC-day budget. No funding was added.</div> : null}
        {params.funding === "insufficient-backing" ? <div className="auth-alert error">FaucetPay read balance does not currently cover existing liabilities plus all Treasury capacity after the proposed top-up. Nothing was funded.</div> : null}
        {params.funding === "backing-check-unavailable" ? <div className="auth-alert error">The read-only FaucetPay backing check was unavailable. Nothing was funded.</div> : null}
        {params.funding === "liability-unavailable" ? <div className="auth-alert error">Current financial liabilities could not be calculated safely. Nothing was funded.</div> : null}
        {params.funding === "liability-changed" ? <div className="auth-alert error">Financial liabilities changed during the backing check. Nothing was funded; run the action again against the fresh state.</div> : null}
        {params.funding === "funding-gap-changed" ? <div className="auth-alert error">Daily usage or Treasury capacity changed during the backing check. Nothing was funded; reload this page before trying again.</div> : null}
        {params.funding === "payout-pack-unavailable" ? <div className="auth-alert error">The configured payout pack is unavailable, so backing cannot be calculated safely.</div> : null}
        {params.funding === "treasury-unavailable" || params.funding === "database-unavailable" || params.funding === "record-failed" ? <div className="auth-alert error">Treasury funding could not be recorded safely. No funding was added.</div> : null}
        {params.funding === "confirmation-required" || params.funding === "invalid-intent" ? <div className="auth-alert error">Funding requires a fresh explicit operator confirmation.</div> : null}
        {fundingNeeded && launchTreasury ? (
          <form action={fundLaunchTreasury} className="treasury-funding-form">
            <input type="hidden" name="idempotency_key" value={fundingIntentId} />
            <label className="treasury-funding-confirm">
              <input type="checkbox" name="confirm" value="real-funding" required />
              <span>I confirm this exact top-up represents real funds already present in FaucetPay and may back real user rewards.</span>
            </label>
            <button className="button" type="submit">Top up exact gap ({launchTreasury.fundingGapCredits.toLocaleString("en-US")} P)</button>
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
            <p>Pilot isolation, a bounded per-account share of the daily faucet budget, operator identity, qualified legal review and international-transfer review remain explicit before broad public/global expansion. They do not make the controlled technical service unhealthy.</p>
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
