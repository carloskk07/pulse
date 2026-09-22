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

type Props = { searchParams: Promise<{ state?: string; interest?: string }> };

const interestCopy: Record<string, string> = {
  received: "Received. No account or budget was created. We will review the use case before asking you to set anything up.",
  invalid: "Check the contact, website and pilot details and try again.",
  "verification-failed": "Human verification did not complete. Try again.",
  "verification-unavailable": "Interest intake verification is temporarily unavailable.",
  "service-unavailable": "Advertiser intake is temporarily unavailable. No submission was stored.",
  failed: "The request could not be stored safely. Try again.",
};

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
            <span className="app-eyebrow">Pulsercuit Ads · qualified traffic</span>
            <h1>Reach crypto earners. <em>Pay for qualified clicks.</em></h1>
            <p>Start from $5 at the current $0.05 launch rate. Pulsercuit reviews the destination first, FaucetPay handles funding, and reward claims stay separate from advertising.</p>
            <div className="pc-ads-principles" aria-label="Pulse Ads principles">
              <span><Check /> Native placement after the claim</span>
              <span><Shield /> Prepaid, capped budget</span>
              <span><Trend /> One billable click per user/day</span>
            </div>
            <div className="pc-ads-hero-actions">
              <Link className="button button-light" href={user ? "#campaign-builder" : "#launch-interest"}>
                {user ? "Create a campaign" : "Plan a $5 test"} <ArrowUpRight />
              </Link>
              <Link className="button button-secondary" href="/business">Need verified actions?</Link>
            </div>
          </div>
          <aside className="pc-ads-economics">
            <span>Start testing from</span>
            <strong>$5</strong>
            <small>$0.05 per qualified click at the current launch rate</small>
            <div><b>100</b><span>maximum billable clicks from a $5 campaign</span></div>
          </aside>
        </header>

        {params.state ? <div className="claim-message neutral">{stateCopy[params.state] ?? "Campaign state updated."}</div> : null}
        {params.interest ? <div className={`claim-message ${params.interest === "received" ? "success" : "neutral"}`}>{interestCopy[params.interest] ?? "Advertiser interest state updated."}</div> : null}

        {!user ? (
          <>
            <section className="pc-ads-builder pc-ads-interest" id="launch-interest">
              <div className="pc-ads-builder-copy">
                <span className="app-eyebrow">Founding advertiser path</span>
                <h2>Tell us the result you want before creating an account.</h2>
                <p>Use this when you want to test the audience but do not want another dashboard yet. We review the fit first. No campaign, charge or traffic promise is created by this form.</p>
                <ol>
                  <li><b>1</b><span><strong>Describe</strong><small>Website, goal, geography and a small test range.</small></span></li>
                  <li><b>2</b><span><strong>Review</strong><small>We decide whether traffic or a verified-action pilot fits better.</small></span></li>
                  <li><b>3</b><span><strong>Configure</strong><small>Only then do you create and fund a real campaign.</small></span></li>
                </ol>
              </div>

              <form className="pc-ads-form" action="/api/ads/interest" method="post">
                <div className="pc-ads-form-grid">
                  <label><span>Company / brand</span><input name="company" minLength={2} maxLength={120} required autoComplete="organization" /></label>
                  <label><span>Your name</span><input name="contact_name" minLength={2} maxLength={120} required autoComplete="name" /></label>
                  <label><span>Work email</span><input name="work_email" type="email" maxLength={254} required autoComplete="email" /></label>
                  <label><span>Website</span><input name="website" inputMode="url" maxLength={500} required placeholder="company.com" /></label>
                  <label><span>What do you want?</span><select name="goal" required defaultValue=""><option value="" disabled>Select one</option><option value="traffic">Qualified website traffic</option><option value="verified_action">Verified user actions</option><option value="not_sure">Help me choose</option></select></label>
                  <label><span>First test</span><select name="budget_range" required defaultValue="traffic_5_25"><option value="traffic_5_25">$5–$25</option><option value="traffic_25_100">$25–$100</option><option value="pilot_100_500">$100–$500</option><option value="not_sure">Not sure yet</option></select></label>
                </div>
                <label><span>Target countries · optional</span><input name="target_countries" maxLength={300} placeholder="Brazil, United States, Mexico…" /></label>
                <label><span>What should happen after someone arrives?</span><textarea name="message" maxLength={3000} rows={4} placeholder="Example: visit a landing page and understand our new app. Or: install and complete onboarding with server-side verification." /></label>
                <TurnstileField action="pulse_ads_interest" />
                <button className="button button-light" type="submit">Request a small-test review <ArrowUpRight /></button>
                <small className="pc-ads-form-note">No login required. Submitting asks Pulsercuit to review the use case and contact you; it does not authorize spend or guarantee delivery.</small>
              </form>
            </section>

            <section className="pc-ads-signin">
              <Spark />
              <div><span className="app-eyebrow">Already decided?</span><h2>Create the campaign yourself.</h2><p>Sign in when you are ready to set the creative, targeting and exact prepaid budget.</p></div>
              <Link className="button button-light" href="/auth?next=/advertise">Sign in to advertise <ArrowUpRight /></Link>
            </section>
          </>
        ) : (
          <>
            <section className="pc-ads-builder" id="campaign-builder">
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
                <small className="pc-ads-form-note">Submitting does not charge you. Funding is offered only after campaign approval. <Link href="/advertising-policy">Campaign standards</Link> apply.</small>
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
          <div><span className="app-eyebrow">Faucet-first rule</span><h2>Ads appear after the reward, not in front of it.</h2></div>
          <p>Sponsored placements appear after successful reward activity. The faucet claim stays direct, while verified-action campaigns remain a separate path for advertisers that need outcomes instead of traffic.</p>
        </section>
      </div>
    </AppShell>
  );
}
