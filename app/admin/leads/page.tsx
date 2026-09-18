import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getBusinessLeadSnapshot } from "@/lib/business-leads";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Business Leads" };
export const dynamic = "force-dynamic";

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function objectiveLabel(value: string) {
  return ({
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
    pilot_100_500: "$100–$500",
    growth_500_2500: "$500–$2,500",
    scale_2500_10000: "$2,500–$10,000",
    enterprise_10000_plus: "$10,000+",
    not_sure: "Not sure",
  } as Record<string, string>)[value] ?? value;
}

export default async function BusinessLeadsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/leads");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) notFound();

  const leads = await getBusinessLeadSnapshot();

  return (
    <AppShell active="advanced">
      <div className="admin-head"><div><span className="app-eyebrow">Pulse for Business</span><h1>Advertiser pipeline</h1><p>Real inbound interest only. A lead is not a campaign, funding commitment or revenue until it passes operator review.</p></div><span className={`admin-badge ${leads.newCount > 0 ? "proof" : "setup"}`}>{leads.newCount} NEW</span></div>

      <section className="admin-secondary-grid">
        <article><span>Total inquiries</span><strong>{leads.total}</strong></article>
        <article><span>New</span><strong>{leads.newCount}</strong></article>
        <article><span>Qualified / contacted / pilot</span><strong>{leads.qualifiedCount}</strong></article>
      </section>

      <section className="admin-panel">
        <div className="app-section-head"><div><span className="app-eyebrow">Recent intake</span><h2>Potential Pulse Direct pilots</h2></div></div>
        <div className="business-lead-table">
          <div className="business-lead-row header"><span>Company</span><span>Objective</span><span>Budget</span><span>Target</span><span>Status</span></div>
          {leads.recent.length ? leads.recent.map((lead) => (
            <article className="business-lead-row" key={lead.id}>
              <div className="business-lead-company"><strong>{lead.company}</strong><small>{lead.contactName} · {lead.workEmail}</small>{lead.website ? <a href={lead.website} target="_blank" rel="noopener noreferrer">{lead.website}</a> : null}</div>
              <span>{objectiveLabel(lead.objective)}</span>
              <span>{budgetLabel(lead.budgetRange)}</span>
              <span>{lead.targetCountries || "Not specified"}{lead.estimatedActions ? ` · ${lead.estimatedActions.toLocaleString("en-US")} actions` : ""}</span>
              <span className={`direct-status ${lead.status}`}>{lead.status}</span>
            </article>
          )) : <div className="empty-ledger">No advertiser inquiry has been received yet. The pipeline remains empty rather than using demo leads.</div>}
        </div>
        <p className="admin-panel-note">The first review should confirm the advertiser, action definition, verification method, target geography, economics and policy fit before any Pulse Direct campaign or funding request is created.</p>
      </section>
    </AppShell>
  );
}
