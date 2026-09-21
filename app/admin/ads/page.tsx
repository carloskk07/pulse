import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Shield } from "@/components/icons";
import { formatUsdMicros, getPulseAdsAdminSnapshot } from "@/lib/pulse-ads";
import { getAdvertiserDemandSnapshot } from "@/lib/advertiser-demand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reviewPulseAd } from "./actions";

export const metadata = { title: "Pulse Ads Operations" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ state?: string }> };

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? ((numerator / denominator) * 100).toFixed(1) + "%" : "—";
}

export default async function AdsAdminPage({ searchParams }: Props) {
  const [supabase, params] = await Promise.all([createSupabaseServerClient(), searchParams]);
  if (!supabase) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/ads");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) notFound();

  const [ads, demand] = await Promise.all([getPulseAdsAdminSnapshot(), getAdvertiserDemandSnapshot()]);

  return (
    <AppShell active="ads-admin">
      <div className="admin-head">
        <div>
          <span className="app-eyebrow">Private operations · owned inventory</span>
          <h1>Review first. Spend only after funding.</h1>
          <p>Pulse Ads monetizes the post-claim audience without changing faucet eligibility, reward value or payout authority.</p>
        </div>
        <Link href="/advertise" className="button">Advertiser view <ArrowUpRight /></Link>
      </div>

      {params.state ? <div className="claim-message neutral">Campaign review state: {params.state.replaceAll("_", " ")}.</div> : null}
      {!ads.available ? <div className="preview-banner">Pulse Ads telemetry is unavailable. No campaign decision should be inferred.</div> : null}

      <section className="admin-kpi-grid" aria-label="Pulse Ads summary">
        <article className="admin-kpi primary"><span>Campaigns</span><strong>{ads.campaignCount}</strong><small>{ads.pendingReview} awaiting review</small></article>
        <article className="admin-kpi positive"><span>Live</span><strong>{ads.activeCount}</strong><small>funded and approved</small></article>
        <article className="admin-kpi"><span>Advertiser funding</span><strong>{formatUsdMicros(ads.fundedUsdMicros)}</strong><small>verified campaign funding</small></article>
        <article className="admin-kpi"><span>Sponsored spend</span><strong>{formatUsdMicros(ads.spentUsdMicros)}</strong><small>{ads.clicks} billable clicks</small></article>
      </section>

      <section className="admin-decision-card">
        <span className="app-eyebrow">Demand engine · ${demand.stage.replaceAll("_"," ")}</span>
        <h2>${demand.nextAction}</h2>
        <div className="admin-secondary-grid">
          <article><span>Inbound interest</span><strong>${demand.inboundTotal}</strong><small>${demand.inboundNew} new</small></article>
          <article><span>Traffic interest</span><strong>${demand.pulseAdsInterest}</strong><small>Pulse Ads</small></article>
          <article><span>Verified-action interest</span><strong>${demand.directInterest}</strong><small>Pulse Direct</small></article>
          <article><span>Ready prospects</span><strong>${demand.prospectsReady}</strong><small>${demand.readyWithPublicEmail} with public email</small></article>
          <article><span>Contacted / replied</span><strong>${demand.prospectsContacted} / ${demand.prospectsReplied}</strong></article>
          <article><span>Pilots</span><strong>${demand.prospectsPilot}</strong></article>
          <article><span>Pending campaigns</span><strong>${demand.campaignsPending}</strong></article>
          <article><span>Approved / live</span><strong>${demand.campaignsApproved} / ${demand.campaignsActive}</strong></article>
        </div>
        <div className="account-links">
          <Link className="button button-secondary" href="/admin/leads">Inbound leads</Link>
          <Link className="button button-secondary" href="/admin/prospects">Outbound prospects</Link>
          <Link className="button" href="/advertise">Advertiser funnel <ArrowUpRight /></Link>
        </div>
        <p className="admin-panel-note">This funnel counts only stored inbound leads, researched company prospects and real campaign states. It never treats a researched company as interested or an approved campaign as revenue.</p>
      </section>

      <section className="admin-panel">
        <div className="app-section-head">
          <div><span className="app-eyebrow">Inventory quality</span><h2>Native traffic, measured conservatively.</h2></div>
          <span className="admin-badge">{percent(ads.clicks, ads.served)} CTR</span>
        </div>
        <div className="admin-secondary-grid">
          <article><span>Served</span><strong>{ads.served.toLocaleString("en-US")}</strong></article>
          <article><span>Clicks</span><strong>{ads.clicks.toLocaleString("en-US")}</strong></article>
          <article><span>Pricing</span><strong>$0.05 CPC</strong></article>
          <article><span>Placement</span><strong>Post-claim</strong></article>
        </div>
      </section>

      <section className="admin-panel">
        <div className="app-section-head">
          <div><span className="app-eyebrow">Campaign review</span><h2>Only real campaigns appear here.</h2></div>
          <span className={"admin-badge " + (ads.pendingReview ? "setup" : "")}>{ads.pendingReview} PENDING</span>
        </div>

        <div className="pc-ads-campaign-list">
          {ads.campaigns.length ? ads.campaigns.map((campaign) => (
            <article className="pc-ads-campaign" key={campaign.id}>
              <div className="pc-ads-campaign-head">
                <div>
                  <span className="app-eyebrow">{campaign.status.replaceAll("_", " ")}</span>
                  <h3>{campaign.title}</h3>
                  <p>{campaign.body}</p>
                  <a href={campaign.destinationUrl} target="_blank" rel="noopener noreferrer">Inspect destination <ArrowUpRight /></a>
                </div>
                <span className={"status-pill pc-ads-status status-" + campaign.status}>{campaign.status.replaceAll("_", " ")}</span>
              </div>

              <div className="pc-ads-metrics">
                <div><small>Budget</small><strong>{formatUsdMicros(campaign.budgetUsdMicros)}</strong></div>
                <div><small>Funded</small><strong>{formatUsdMicros(campaign.fundedUsdMicros)}</strong></div>
                <div><small>Spent</small><strong>{formatUsdMicros(campaign.spentUsdMicros)}</strong></div>
                <div><small>Served</small><strong>{campaign.served}</strong></div>
                <div><small>Clicks</small><strong>{campaign.clicks}</strong></div>
              </div>

              {campaign.status === "pending_review" ? (
                <form action={reviewPulseAd} className="pc-ads-admin-review">
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <label><span>Review note · required when rejecting</span><input name="note" maxLength={500} placeholder="Optional approval note or clear rejection reason" /></label>
                  <div>
                    <button className="button button-secondary" type="submit" name="decision" value="reject"><Shield /> Reject</button>
                    <button className="button" type="submit" name="decision" value="approve">Approve campaign <ArrowUpRight /></button>
                  </div>
                </form>
              ) : null}
            </article>
          )) : <div className="empty-ledger">No Pulse Ads campaign exists yet. Nothing is synthesized for the operator view.</div>}
        </div>
      </section>

      <section className="admin-decision-card">
        <span className="app-eyebrow">Economic boundary</span>
        <h2>Sponsored clicks never create user rewards.</h2>
        <p>Faucet rewards remain Treasury-backed. Pulse Ads is separate owned-media revenue; Pulse Direct remains the path for advertiser-funded verified actions.</p>
      </section>
    </AppShell>
  );
}
