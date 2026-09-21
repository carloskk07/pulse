import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getBusinessLeadSnapshot } from "@/lib/business-leads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateBusinessLead } from "./actions";

export const metadata = { title: "Business Leads" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ state?: string }> };

const stateCopy: Record<string, string> = {
  updated: "Lead follow-up state updated.",
  invalid: "The lead status, date or note was invalid.",
  unavailable: "Lead storage is temporarily unavailable. No change was recorded.",
};

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function objectiveLabel(value: string) {
  return ({
    website_traffic: "Website traffic",
    app_install: "App install",
    registration: "Registration",
    trial: "Trial",
    purchase: "Purchase",
    survey: "Survey",
    custom: "Custom",
  } as Record<string, string>)[value] ?? value;
}

function budgetLabel(value: string) {
  return ({
    traffic_5_25: "$5–$25",
    traffic_25_100: "$25–$100",
    pilot_100_500: "$100–$500",
    growth_500_2500: "$500–$2,500",
    scale_2500_10000: "$2,500–$10,000",
    enterprise_10000_plus: "$10,000+",
    not_sure: "Not sure",
  } as Record<string, string>)[value] ?? value;
}

function productLabel(value: string) {
  if (value === "pulse_ads") return "Pulse Ads";
  if (value === "pulse_direct") return "Pulse Direct";
  return "Needs routing";
}

function datetimeLocalUtc(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0,16) : "";
}

export default async function BusinessLeadsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/leads");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) notFound();

  const leads = await getBusinessLeadSnapshot();

  return (
    <AppShell active="advanced">
      <div className="admin-head"><div><span className="app-eyebrow">Pulse for Business</span><h1>Advertiser pipeline</h1><p>Real inbound interest only. A lead is not a campaign, funding commitment or revenue until it passes operator review.</p></div><span className={`admin-badge ${leads.newCount > 0 ? "proof" : "setup"}`}>{leads.newCount} NEW</span></div>
      {params.state ? <div className={`claim-message ${params.state === "updated" ? "success" : "neutral"}`}>{stateCopy[params.state] ?? "Lead state updated."}</div> : null}

      <section className="admin-secondary-grid">
        <article><span>Total inquiries</span><strong>{leads.total}</strong></article>
        <article><span>New</span><strong>{leads.newCount}</strong></article>
        <article><span>Qualified / contacted / pilot</span><strong>{leads.qualifiedCount}</strong></article>
      </section>

      <section className="admin-panel">
        <div className="app-section-head"><div><span className="app-eyebrow">Recent intake</span><h2>Potential Pulse Direct pilots</h2></div></div>
        <div className="business-lead-table">
          <div className="business-lead-row header"><span>Company</span><span>Product</span><span>Budget</span><span>Target</span><span>Follow-up</span></div>
          {leads.recent.length ? leads.recent.map((lead) => (
            <article className="business-lead-row" key={lead.id}>
              <div className="business-lead-company">
                <strong>{lead.company}</strong>
                <small>{lead.contactName} · {lead.workEmail}</small>
                {lead.website ? <a href={lead.website} target="_blank" rel="noopener noreferrer">{lead.website}</a> : null}
                <small>{objectiveLabel(lead.objective)} · {lead.source.replaceAll("_"," ")}</small>
                {lead.message ? <p>{lead.message}</p> : null}
              </div>
              <span>{productLabel(lead.productInterest)}</span>
              <span>{budgetLabel(lead.budgetRange)}</span>
              <span>{lead.targetCountries || "Not specified"}{lead.estimatedActions ? ` · ${lead.estimatedActions.toLocaleString("en-US")} actions` : ""}</span>
              <form className="prospect-stage-form" action={updateBusinessLead}>
                <input type="hidden" name="id" value={lead.id} />
                <select name="status" defaultValue={lead.status} aria-label={`Status for ${lead.company}`}>
                  <option value="new">New</option>
                  <option value="qualified">Qualified</option>
                  <option value="contacted">Contacted</option>
                  <option value="pilot">Pilot</option>
                  <option value="rejected">Rejected</option>
                  <option value="closed">Closed</option>
                </select>
                <input name="next_action_at" type="datetime-local" defaultValue={datetimeLocalUtc(lead.nextActionAt)} aria-label="Next action in UTC" title="UTC" />
                <textarea name="operator_note" defaultValue={lead.operatorNote ?? ""} rows={2} maxLength={2000} placeholder="Next step / qualification note" />
                <button className="button button-sm" type="submit">Save</button>
              </form>
            </article>
          )) : <div className="empty-ledger">No advertiser inquiry has been received yet. The pipeline remains empty rather than using demo leads.</div>}
        </div>
        <p className="admin-panel-note">The first review should confirm the advertiser, action definition, verification method, target geography, economics and policy fit before any Pulse Direct campaign or funding request is created.</p>
      </section>
    </AppShell>
  );
}
