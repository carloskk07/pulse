import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Check, Shield, Spark, Trend } from "@/components/icons";
import { TurnstileField } from "@/components/turnstile-field";
import { getCurrentUserContext } from "@/lib/current-user-context";
import { formatUsdMicros, getUserPulseAds } from "@/lib/pulse-ads";
import { buildPulseAdsCheckoutCustom } from "@/lib/pulse-ads-checkout";
import { getCanonicalSiteUrl } from "@/lib/site-url";

export const metadata = {
  title: "Advertise",
  description: "Run a simple sponsored campaign inside Pulsercuit with a fixed budget and clear spend.",
};
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ state?: string }> };

const stateCopy: Record<string, string> = {
  pending_review: "Campaign received. We review the destination and creative before any payment is requested.",
  invalid: "Check the campaign details and try again.",
  "verification-failed": "Human verification did not complete. Try again.",
  "verification-unavailable": "Campaign verification is temporarily unavailable.",
  "service-unavailable": "Campaign creation is temporarily unavailable.",
  error: "The campaign could not be created.",
  "payment-returned": "Payment returned to Pulsercuit. Activation happens only after FaucetPay verification is confirmed.",
  "payment-cancelled": "Payment was cancelled. No campaign budget was activated.",
};

function campaignState(status: string) {
  if (status === "pending_review") return "Under review";
  if (status === "approved") return "Ready to fund";
  if (status === "active") return "Live";
  if (status === "paused") return "Paused";
  if (status === "exhausted") return "Budget used";
  if (status === "rejected") return "Needs changes";
  return "Closed";
}

function decimalUsd(micros: number) {
  return (micros / 1_000_000).toFixed(2);
}

export default async function AdvertisePage({ searchParams }: Props) {
  const [{ user }, params] = await Promise.all([getCurrentUserContext(), searchParams]);
  const campaigns = user ? await getUserPulseAds(user.id) : [];
  const merchantUsername = process.env.PULSE_ADS_MERCHANT_USERNAME?.trim() ?? "";
  const origin = getCanonicalSiteUrl().origin;

  return (
    <AppShell active="ads" userLabel={user?.email?.split("@")[0] ?? undefined}>
      <div className="pc-ads-page">
        <header className="pc-ads-hero">
          <div>
            <span className="app-eyebrow">Pulse Ads · sponsored</span>
            <h1>Put something worth seeing <em>inside the circuit.</em></h1>
            <p>Create a native sponsored placement with a fixed budget. Pulsercuit reviews it first, then FaucetPay handles funding. Claims stay separate and users are never paid to click.</p>
            <div className="pc-ads-principles" aria-label="Pulse Ads principles">
              <span><Check /> After the claim</span>
              <span><Shield /> Prepaid budget</span>
              <span><Trend /> One billable click per user/day</span>
            </div>
          </div>
          <aside className="pc-ads-economics">
            <span>Starting budget</span>
            <strong>$5</strong>
            <small>Current launch price · $0.05 per qualified click</small>
            <div><b>100</b><span>maximum billable clicks from a $5 campaign</span></div>
          </aside>
        </header>

        {params.state ? <div className="claim-message neutral">{stateCopy[params.state] ?? "Campaign state updated."}</div> : null}

        {!user ? (
          <section className="pc-ads-signin">
            <Spark />
            <div><span className="app-eyebrow">Advertiser access</span><h2>Use the same Pulsercuit account.</h2><p>Sign in, create the campaign, and keep funding and performance in one place.</p></div>
            <Link className="button button-light" href="/auth?next=/advertise">Sign in to advertise <ArrowUpRight /></Link>
          </section>
        ) : (
          <>
            <section className="pc-ads-builder">
              <div className="pc-ads-builder-copy">
                <span className="app-eyebrow">Create campaign</span>
                <h2>Simple enough to launch in one screen.</h2>
                <p>Sponsored campaigns buy traffic, not fake engagement. The click itself never creates a reward for the viewer.</p>
                <ol>
                  <li><b>1</b><span><strong>Create</strong><small>Title, message, URL and budget.</small></span></li>
                  <li><b>2</b><span><strong>Review</strong><small>We check the destination before funding.</small></span></li>
                  <li><b>3</b><span><strong>Fund</strong><small>Pay through FaucetPay only after approval.</small></span></li>
                  <li><b>4</b><span><strong>Run</strong><small>Spend occurs only on qualified sponsored clicks.</small></span></li>
                </ol>
              </div>

              <form className="pc-ads-form" action="/api/ads/campaigns" method="post">
                <label><span>Campaign title</span><input name="title" minLength={3} maxLength={90} required placeholder="A clear reason to visit" /></label>
                <label><span>Sponsored message</span><textarea name="body" minLength={1} maxLength={220} rows={4} required placeholder="Tell people what they will find after the click." /></label>
                <label><span>Destination</span><input name="destinationUrl" type="url" inputMode="url" required placeholder="https://example.com" /></label>
                <div className="pc-ads-form-grid">
                  <label><span>Budget · USD</span><input name="budgetUsd" type="number" inputMode="decimal" min="5" max="5000" step="0.01" defaultValue="5.00" required /></label>
                  <label><span>Countries · optional</span><input name="countryCodes" placeholder="BR, US, MX" maxLength={120} /></label>
                </div>
                <fieldset>
                  <legend>Devices · leave both selected for all</legend>
                  <label><input type="checkbox" name="mobile" defaultChecked /> Mobile</label>
                  <label><input type="checkbox" name="desktop" defaultChecked /> Desktop</label>
                </fieldset>
                <TurnstileField action="pulse_ads_create" />
                <button className="button button-light" type="submit">Submit for review <ArrowUpRight /></button>
                <small className="pc-ads-form-note">Submitting does not charge you. Funding is offered only after campaign approval.</small>
              </form>
            </section>

            <section className="pc-ads-campaigns">
              <div className="app-section-head">
                <div><span className="app-eyebrow">Your campaigns</span><h2>Budget and outcome stay visible.</h2></div>
                <span className="admin-badge">{campaigns.length} TOTAL</span>
              </div>

              {campaigns.length ? (
                <div className="pc-ads-campaign-list">
                  {campaigns.map((campaign) => {
                    const remaining = Math.max(0, campaign.fundedUsdMicros - campaign.spentUsdMicros);
                    const ctr = campaign.served > 0 ? (campaign.clicks / campaign.served) * 100 : 0;
                    const checkoutCustom = buildPulseAdsCheckoutCustom(campaign.id, campaign.checkoutReference);
                    return (
                      <article className="pc-ads-campaign" key={campaign.id}>
                        <div className="pc-ads-campaign-head">
                          <div><span className="app-eyebrow">Sponsored campaign</span><h3>{campaign.title}</h3><p>{campaign.body}</p></div>
                          <span className={"status-pill pc-ads-status status-" + campaign.status}>{campaignState(campaign.status)}</span>
                        </div>
                        <div className="pc-ads-metrics">
                          <div><small>Budget</small><strong>{formatUsdMicros(campaign.budgetUsdMicros)}</strong></div>
                          <div><small>Spent</small><strong>{formatUsdMicros(campaign.spentUsdMicros)}</strong></div>
                          <div><small>Remaining</small><strong>{campaign.fundedUsdMicros ? formatUsdMicros(remaining) : "—"}</strong></div>
                          <div><small>Clicks</small><strong>{campaign.clicks.toLocaleString("en-US")}</strong></div>
                          <div><small>CTR</small><strong>{ctr.toFixed(1)}%</strong></div>
                        </div>

                        {campaign.status === "approved" ? (
                          merchantUsername && checkoutCustom ? (
                            <form className="pc-ads-funding" action="https://faucetpay.io/merchant/webscr" method="post">
                              <input type="hidden" name="merchant_username" value={merchantUsername} />
                              <input type="hidden" name="item_description" value={"Pulse Ads — " + campaign.title} />
                              <input type="hidden" name="amount1" value={decimalUsd(campaign.budgetUsdMicros)} />
                              <input type="hidden" name="currency1" value="USDT" />
                              <input type="hidden" name="custom" value={checkoutCustom} />
                              <input type="hidden" name="callback_url" value={origin + "/api/ads/merchant/callback"} />
                              <input type="hidden" name="success_url" value={origin + "/advertise?state=payment-returned"} />
                              <input type="hidden" name="cancel_url" value={origin + "/advertise?state=payment-cancelled"} />
                              <div><Shield /><span><strong>Approved for funding</strong><small>FaucetPay verifies the payment before Pulsercuit activates spend.</small></span></div>
                              <button className="button" type="submit">Fund {formatUsdMicros(campaign.budgetUsdMicros)} with FaucetPay <ArrowUpRight /></button>
                            </form>
                          ) : (
                            <div className="pc-ads-waiting"><Shield /><span><strong>Approved.</strong><small>Merchant checkout is awaiting signed Pulsercuit configuration. No payment is requested yet.</small></span></div>
                          )
                        ) : null}

                        {campaign.status === "pending_review" ? <div className="pc-ads-waiting"><Spark /><span><strong>Review first.</strong><small>No payment is requested until the creative and destination pass review.</small></span></div> : null}
                        {campaign.status === "rejected" && campaign.reviewNote ? <div className="pc-ads-waiting"><Shield /><span><strong>Review note</strong><small>{campaign.reviewNote}</small></span></div> : null}
                      </article>
                    );
                  })}
                </div>
              ) : <div className="empty-ledger">No sponsored campaign yet. Your first campaign can start at $5 after review.</div>}
            </section>
          </>
        )}

        <section className="pc-ads-boundary">
          <div><span className="app-eyebrow">Faucet-first rule</span><h2>Advertising funds the ecosystem. It does not get in the way of the faucet.</h2></div>
          <p>Sponsored placements live after successful Pulse activity. The core claim remains a direct reward action, while Pulse Direct remains the higher-value path for advertisers that want verified outcomes instead of traffic.</p>
        </section>
      </div>
    </AppShell>
  );
}
