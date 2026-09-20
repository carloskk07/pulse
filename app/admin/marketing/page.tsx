import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight } from "@/components/icons";
import { getMarketingFunnelSnapshot } from "@/lib/marketing-funnel";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Growth Funnel" };
export const dynamic = "force-dynamic";

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function percent(numerator: number, denominator: number) {
  return `${rate(numerator, denominator).toFixed(1)}%`;
}

export default async function MarketingAdminPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/marketing");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) notFound();

  const funnel = await getMarketingFunnelSnapshot(30);

  return (
    <AppShell active="advanced">
      <div className="admin-head">
        <div>
          <span className="app-eyebrow">Private growth evidence · {funnel.experienceVersion}</span>
          <h1>Acquisition → activation.</h1>
          <p>Measure the new conversion system with first-party, privacy-minimized events and authoritative product outcomes.</p>
        </div>
        <Link href="/admin" className="button">Operations <ArrowUpRight /></Link>
      </div>

      {!funnel.available ? (
        <div className="preview-banner">Growth telemetry is unavailable. No conversion claim should be made until the aggregate snapshot is readable.</div>
      ) : null}

      <section className="admin-kpi-grid" aria-label="Acquisition funnel">
        <article className="admin-kpi primary">
          <span>Home sessions</span>
          <strong>{funnel.homeSessions.toLocaleString("en-US")}</strong>
          <small>unique first-party sessions · last {funnel.days} days</small>
        </article>
        <article className="admin-kpi">
          <span>Proof sessions</span>
          <strong>{funnel.proofSessions.toLocaleString("en-US")}</strong>
          <small>{percent(funnel.proofSessions, funnel.homeSessions)} of Home sessions</small>
        </article>
        <article className="admin-kpi">
          <span>Signup views</span>
          <strong>{funnel.signupSessions.toLocaleString("en-US")}</strong>
          <small>{percent(funnel.signupSessions, funnel.homeSessions)} of Home sessions</small>
        </article>
        <article className="admin-kpi positive">
          <span>Accounts created</span>
          <strong>{funnel.signupCreatedSessions.toLocaleString("en-US")}</strong>
          <small>{percent(funnel.signupCreatedSessions, funnel.signupSessions)} of measured signup views</small>
        </article>
      </section>

      <section className="admin-panel">
        <div className="app-section-head">
          <div><span className="app-eyebrow">CTA intent</span><h2>Where visitors choose to advance.</h2></div>
          <span className="admin-badge">{funnel.ctaClicks} CLICKS</span>
        </div>
        <div className="admin-provider-table">
          <div className="admin-provider-row header"><span>Surface</span><span>Unique clicks</span><span>Home share</span><span>Signal</span></div>
          {funnel.ctaSurfaces.length ? funnel.ctaSurfaces.map((cta) => (
            <div className="admin-provider-row" key={cta.label}>
              <strong>{cta.label.replaceAll("_", " ")}</strong>
              <span>{cta.clicks.toLocaleString("en-US")}</span>
              <span>{percent(cta.clicks, funnel.homeSessions)}</span>
              <span>{cta.label.includes("proof") ? "trust" : "signup"}</span>
            </div>
          )) : <div className="empty-ledger">No measured CTA intent yet. Page views alone are not treated as conversion intent.</div>}
        </div>
      </section>

      <section className="admin-panel">
        <div className="app-section-head">
          <div><span className="app-eyebrow">Attributed activation cohort</span><h2>What accounts born in this experience actually do.</h2></div>
          <span className="admin-badge">AUTHORITATIVE</span>
        </div>
        <div className="admin-secondary-grid">
          <article><span>New users</span><strong>{funnel.newUsers.toLocaleString("en-US")}</strong></article>
          <article><span>First Pulse</span><strong>{funnel.firstPulseUsers.toLocaleString("en-US")} · {percent(funnel.firstPulseUsers, funnel.newUsers)}</strong></article>
          <article><span>2+ Pulses</span><strong>{funnel.repeatPulseUsers.toLocaleString("en-US")} · {percent(funnel.repeatPulseUsers, funnel.firstPulseUsers)}</strong></article>
          <article><span>Paid users</span><strong>{funnel.paidUsers.toLocaleString("en-US")} · {percent(funnel.paidUsers, funnel.newUsers)}</strong></article>
        </div>
        <p className="admin-panel-note">Only accounts whose successful signup is attributed to <strong>{funnel.experienceVersion}</strong> enter this cohort. First Pulse, repeat Pulse and paid-user counts are then read from the existing authoritative product tables; marketing telemetry cannot create or modify those outcomes.</p>
      </section>

      <section className="admin-panel">
        <div className="app-section-head">
          <div><span className="app-eyebrow">First-touch sources</span><h2>Where measured sessions begin.</h2></div>
          <span className="admin-badge">{funnel.days} DAYS</span>
        </div>
        <div className="admin-provider-table">
          <div className="admin-provider-row header"><span>Source</span><span>Sessions</span><span>Signups</span><span>Session → signup</span></div>
          {funnel.sources.length ? funnel.sources.map((source) => (
            <div className="admin-provider-row" key={source.source}>
              <strong>{source.source}</strong>
              <span>{source.sessions.toLocaleString("en-US")}</span>
              <span>{source.signups.toLocaleString("en-US")}</span>
              <span>{percent(source.signups, source.sessions)}</span>
            </div>
          )) : <div className="empty-ledger">No measured acquisition sessions yet. The baseline starts after this telemetry reaches production.</div>}
        </div>
      </section>

      <section className="admin-decision-card">
        <span className="app-eyebrow">Measurement contract</span>
        <h2>No fingerprinting. No duplicated financial truth.</h2>
        <strong>{funnel.trackingStartedAt ? "LIVE" : "BASELINE"}</strong>
        <p>The browser receives a random 30-day first-party cookie. Its SHA-256 hash, sanitized UTM values, CTA label and experience label <strong>{funnel.experienceVersion}</strong> are stored. After a successful signup, the internal user UUID is attached only to that signup event so activation can be attributed correctly. IP address, user-agent, email, balance and payout destination are not written to the marketing event table.</p>
      </section>
    </AppShell>
  );
}
