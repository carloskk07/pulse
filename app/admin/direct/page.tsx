import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DirectCampaignCreateForm } from "@/components/direct-campaign-create-form";
import { getAdminAccess } from "@/lib/admin-authorization";
import { getDirectCampaignSnapshot } from "@/lib/direct-campaigns";
import {
  activateDirectCampaignAction,
  fundDirectCampaignAction,
  pauseDirectCampaignAction,
} from "./actions";

export const metadata = { title: "Pulse Direct" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ direct?: string }> };

function usd(micros: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(micros / 1_000_000);
}

const messages: Record<string, { tone: "success" | "error"; text: string }> = {
  funded: { tone: "success", text: "Campaign funding recorded." },
  activated: { tone: "success", text: "Campaign activated and published as an extra reward." },
  paused: { tone: "success", text: "Campaign paused and hidden from earning surfaces." },
  "funding-invalid": { tone: "error", text: "Funding input is invalid." },
  invalid: { tone: "error", text: "Campaign reference is invalid." },
  insufficient_funding: { tone: "error", text: "Fund the campaign for at least one full verified action before activation." },
  campaign_closed: { tone: "error", text: "This campaign is already closed." },
  completion_cap_reached: { tone: "error", text: "This campaign already reached its completion cap." },
  campaign_ended: { tone: "error", text: "This campaign has ended." },
  "funding-failed": { tone: "error", text: "Campaign funding could not be recorded." },
  "activate-failed": { tone: "error", text: "Campaign activation did not complete." },
  "pause-failed": { tone: "error", text: "Campaign pause did not complete." },
};

export default async function DirectCampaignAdminPage({ searchParams }: Props) {
  const access = await getAdminAccess();
  if (access.status === "unauthenticated") redirect("/auth?next=/admin/direct");
  if (access.status !== "authorized") notFound();

  const [snapshot, params] = await Promise.all([getDirectCampaignSnapshot(), searchParams]);
  const message = params.direct ? messages[params.direct] : null;

  return (
    <AppShell active="direct-admin">
      <div className="admin-head">
        <div>
          <span className="app-eyebrow">Owned reward inventory</span>
          <h1>Pulse Direct</h1>
          <p>Create, fund and activate advertiser-backed extra rewards without depending on an external offerwall provider.</p>
        </div>
        <span className={`admin-badge ${snapshot.activeCount > 0 ? "" : "setup"}`}>{snapshot.activeCount > 0 ? "LIVE INVENTORY" : "NO ACTIVE INVENTORY"}</span>
      </div>

      <section className="admin-secondary-grid">
        <article><span>Campaigns</span><strong>{snapshot.campaignCount}</strong></article>
        <article><span>Active</span><strong>{snapshot.activeCount}</strong></article>
        <article><span>Funded</span><strong>{usd(snapshot.fundedUsdMicros)}</strong></article>
        <article><span>Reserved</span><strong>{usd(snapshot.reservedUsdMicros)}</strong></article>
        <article><span>Spent</span><strong>{usd(snapshot.spentUsdMicros)}</strong></article>
        <article><span>Gross contribution</span><strong>{usd(snapshot.grossContributionUsdMicros)}</strong></article>
      </section>

      {message ? <div className={`auth-alert ${message.tone}`}>{message.text}</div> : null}

      <DirectCampaignCreateForm />

      <section className="admin-decision-card">
        <span className="app-eyebrow">Campaign inventory</span>
        <h2>{snapshot.campaignCount ? "Operate funded campaigns." : "No campaigns yet."}</h2>
        <p>A campaign becomes visible to members only after funding is recorded and activation succeeds. Pausing immediately hides the corresponding opportunity.</p>

        {snapshot.campaigns.length ? (
          <div className="admin-provider-table direct-admin-table">
            <div className="admin-provider-row header"><span>Campaign</span><span>Budget</span><span>Reward</span><span>Action</span></div>
            {snapshot.campaigns.map((campaign) => {
              const available = Math.max(0, campaign.fundedUsdMicros - campaign.reservedUsdMicros - campaign.spentUsdMicros);
              return (
                <div className="admin-provider-row" key={campaign.id}>
                  <span>
                    <strong>{campaign.title}</strong>
                    <small>{campaign.advertiserName} · {campaign.actionType} · {campaign.status}</small>
                  </span>
                  <span>
                    <strong>{usd(available)}</strong>
                    <small>{campaign.completionCount}/{campaign.maxCompletions} completed</small>
                  </span>
                  <span>
                    <strong>{campaign.rewardCredits} credits</strong>
                    <small>{usd(campaign.pricePerActionUsdMicros)} price/action</small>
                  </span>
                  <span className="direct-admin-actions">
                    <form action={fundDirectCampaignAction}>
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <input name="amount_usd" inputMode="decimal" placeholder="USD" aria-label={"Funding amount for " + campaign.title} required />
                      <input name="funding_reference" maxLength={240} placeholder="Funding reference" aria-label={"Funding reference for " + campaign.title} required />
                      <button className="inline-action" type="submit">Fund</button>
                    </form>
                    {campaign.status !== "active" ? (
                      <form action={activateDirectCampaignAction}>
                        <input type="hidden" name="campaign_id" value={campaign.id} />
                        <button className="inline-action" type="submit">Activate</button>
                      </form>
                    ) : (
                      <form action={pauseDirectCampaignAction}>
                        <input type="hidden" name="campaign_id" value={campaign.id} />
                        <button className="inline-action" type="submit">Pause</button>
                      </form>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="admin-panel-note">Create the first campaign above. Its callback secret is shown only once, then only the SHA-256 hash remains stored.</p>
        )}
      </section>

      <section className="admin-decision-card">
        <span className="app-eyebrow">Launch requirement</span>
        <h2>What makes Pulse Direct count as real extra-reward supply?</h2>
        <p>The public launch gate requires at least one active campaign whose destination is HTTPS, whose remaining prefunded budget covers another verified action, whose completion cap is not exhausted and whose opportunity freshness is current.</p>
      </section>
    </AppShell>
  );
}
