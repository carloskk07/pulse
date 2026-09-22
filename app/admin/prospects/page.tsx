import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { buildProspectOutreachHref, getOutboundProspects } from "@/lib/outbound-prospects";
import { getAdminAccess } from "@/lib/admin-authorization";
import { updateProspectStatus, upsertProspect } from "./actions";

export const metadata = { title: "Advertiser Prospects" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ state?: string }> };

const stateCopy: Record<string, string> = {
  invalid: "The prospect data was rejected because a URL, email, stage or date was invalid.",
  unavailable: "Prospect storage is temporarily unavailable. No change was recorded.",
  saved: "Prospect saved with validated public-source data.",
  updated: "Prospect stage updated.",
};

function segmentLabel(value: string) {
  return ({ mobile_game: "Mobile game", consumer_app: "Consumer app", saas: "SaaS", research: "Research", other: "Other" } as Record<string, string>)[value] ?? value;
}

function scoreClass(score: number) {
  if (score >= 80) return "strong";
  if (score >= 60) return "good";
  return "learning";
}

function datetimeLocalUtc(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 16) : "";
}

export default async function AdvertiserProspectsPage({ searchParams }: Props) {
  const params = await searchParams;
  const adminAccess = await getAdminAccess();
  if (adminAccess.status === "unauthenticated") redirect("/auth?next=/admin/prospects");
  if (adminAccess.status !== "authorized") notFound();

  const prospects = await getOutboundProspects();
  const ready = prospects.filter((item) => item.status === "ready").length;
  const contacted = prospects.filter((item) => item.status === "contacted" || item.status === "replied").length;
  const pilots = prospects.filter((item) => item.status === "pilot").length;
  const highFit = prospects.filter((item) => item.fitScore >= 80 && !["rejected", "closed"].includes(item.status)).length;

  return (
    <AppShell active="advanced">
      <div className="admin-head"><div><span className="app-eyebrow">Outbound acquisition</span><h1>Advertiser prospects</h1><p>Company-level research only. Score fit first, then contact a small number of strong candidates with a specific pilot hypothesis.</p></div><span className={`admin-badge ${highFit > 0 ? "proof" : "setup"}`}>{highFit} HIGH FIT</span></div>
      {params.state ? <div className={`claim-message ${params.state === "saved" || params.state === "updated" ? "success" : "neutral"}`}>{stateCopy[params.state] ?? "Prospect state updated."}</div> : null}

      <section className="admin-secondary-grid">
        <article><span>Total prospects</span><strong>{prospects.length}</strong></article>
        <article><span>High fit ≥80</span><strong>{highFit}</strong></article>
        <article><span>Ready</span><strong>{ready}</strong></article>
        <article><span>Contacted / replied</span><strong>{contacted}</strong></article>
        <article><span>Pilots</span><strong>{pilots}</strong></article>
      </section>

      <section className="admin-panel prospect-principles">
        <div className="app-section-head"><div><span className="app-eyebrow">First ICP</span><h2>Small and mid-size mobile game studios</h2></div></div>
        <p className="admin-panel-note">Prioritize teams with a live or near-launch product, measurable in-game milestones, an obvious growth window and a public business contact. A high score means “worth researching/contacting,” not “interested.”</p>
        <div className="prospect-score-strip"><span>Mobile game <b>+30</b></span><span>Live product <b>+15</b></span><span>Measurable event <b>+20</b></span><span>Public contact <b>+10</b></span><span>Paid-UA signal <b>+15</b></span><span>Growth window <b>+10</b></span></div>
      </section>

      <section className="admin-panel">
        <div className="app-section-head"><div><span className="app-eyebrow">Shortlist</span><h2>Prioritized companies</h2></div></div>
        <div className="prospect-table">
          <div className="prospect-row header"><span>Company</span><span>Fit</span><span>Pilot hypothesis</span><span>Stage</span></div>
          {prospects.length ? prospects.map((item) => (
            <article className="prospect-row" key={item.id}>
              <div className="prospect-company"><strong>{item.companyName}</strong><small>{segmentLabel(item.segment)}{item.country ? ` · ${item.country}` : ""}</small><a href={item.website} target="_blank" rel="noopener noreferrer">{item.domain}</a>{item.publicContactEmail ? <small>{item.publicContactEmail}</small> : null}</div>
              <div className={`prospect-score ${scoreClass(item.fitScore)}`}><strong>{item.fitScore}</strong><span>/100</span></div>
              <div className="prospect-pilot">
                <p>{item.suggestedPilot ?? "Define a verified-action pilot before outreach."}</p>
                <div className="prospect-actions">
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>
                  {buildProspectOutreachHref(item) ? <a href={buildProspectOutreachHref(item) ?? undefined}>Open outreach draft</a> : <span>No public email</span>}
                </div>
              </div>
              <form className="prospect-stage-form" action={updateProspectStatus}>
                <input type="hidden" name="id" value={item.id} />
                <select name="status" defaultValue={item.status} aria-label={`Stage for ${item.companyName}`}>
                  <option value="new">New</option><option value="researching">Researching</option><option value="ready">Ready</option><option value="contacted">Contacted</option><option value="replied">Replied</option><option value="pilot">Pilot</option><option value="rejected">Rejected</option><option value="closed">Closed</option>
                </select>
                <input name="nextActionAt" type="datetime-local" defaultValue={datetimeLocalUtc(item.nextActionAt)} aria-label="Next action in UTC" title="UTC" />
                <button className="button button-sm" type="submit">Save</button>
              </form>
            </article>
          )) : <div className="empty-ledger">No outbound prospect exists yet. Add only researched companies with a public source.</div>}
        </div>
      </section>

      <section className="admin-panel">
        <div className="app-section-head"><div><span className="app-eyebrow">Operator entry</span><h2>Add or refresh a company prospect</h2></div></div>
        <form className="prospect-form" action={upsertProspect}>
          <label><span>Company</span><input name="companyName" required maxLength={160} /></label>
          <label><span>Website</span><input name="website" required type="url" placeholder="https://company.com" /></label>
          <label><span>Public source</span><input name="sourceUrl" required type="url" placeholder="Official company/product page" /></label>
          <label><span>Segment</span><select name="segment" defaultValue="mobile_game"><option value="mobile_game">Mobile game</option><option value="consumer_app">Consumer app</option><option value="saas">SaaS</option><option value="research">Research</option><option value="other">Other</option></select></label>
          <label><span>Country</span><input name="country" maxLength={100} /></label>
          <label><span>Public business email</span><input name="publicContactEmail" type="email" maxLength={254} /></label>
          <label className="prospect-form-wide"><span>Suggested pilot</span><input name="suggestedPilot" maxLength={500} placeholder="Example: reward users after reaching level 5; pilot 50 verified completions." /></label>
          <label className="prospect-form-wide"><span>Notes</span><textarea name="notes" maxLength={2000} rows={3} /></label>
          <fieldset className="prospect-signal-fieldset"><legend>Public fit signals</legend><label><input type="checkbox" name="liveProduct" /> Live / near-launch product</label><label><input type="checkbox" name="measurableEvent" /> Clear measurable event</label><label><input type="checkbox" name="publicContact" /> Public business contact</label><label><input type="checkbox" name="paidUaSignal" /> Paid-UA/growth signal</label><label><input type="checkbox" name="growthWindow" /> Launch/growth window</label></fieldset>
          <button className="button" type="submit">Save researched prospect</button>
        </form>
      </section>
    </AppShell>
  );
}
