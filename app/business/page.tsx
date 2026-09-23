import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { TurnstileField } from "@/components/turnstile-field";
import { ArrowUpRight, Check, Shield, Trend } from "@/components/icons";

export const metadata = {
  title: "Pulse for Business",
  description: "Run verified-action campaigns or connect purchase cashback with server-side proof.",
};

type Props = { searchParams: Promise<{ lead?: string }> };

const leadCopy: Record<string, string> = {
  received: "Received. We'll review whether the campaign is a fit before any budget is requested.",
  invalid: "Some campaign details need correction before we can review the pilot.",
  "verification-failed": "Human verification did not complete. Please try again.",
  "verification-not-configured": "Business intake verification is temporarily unavailable.",
  "service-unavailable": "Business intake is temporarily unavailable. No submission was stored.",
  failed: "The request could not be stored safely. Please try again.",
};

export default async function BusinessPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="marketing-page business-page">
      <SiteHeader />

      <section className="business-hero shell">
        <div className="business-hero-copy">
          <div className="eyebrow"><span className="live-dot" /> Pulse for Business</div>
          <h1>Pay for <em>verified results.</em> Not promises.</h1>
          <p>Run a verified-action campaign or connect purchase cashback. In both models, value moves only after an agreed server-side result is confirmed.</p>
          <div className="hero-actions">
            <Link className="button button-lg" href="#pilot">Plan a pilot <ArrowUpRight /></Link>
            <Link className="button button-ghost button-lg" href="/business/integration">Integration</Link>
          </div>
          <div className="trust-strip"><span><Check /> Outcome-priced</span><span><Shield /> Server-verified</span><span><Check /> Pseudonymous tracking</span></div>
          <Link className="pc-v10-business-proof" href="/proof">See the live user-side proof <ArrowUpRight /></Link>
        </div>

        <div className="business-console" aria-label="Illustrative campaign economics">
          <div className="business-console-head"><span>Illustrative pilot</span><span className="status-pill">Example economics</span></div>
          <div className="business-console-main">
            <span className="section-kicker">Verified action</span>
            <h2>Reach a defined product milestone</h2>
            <div className="business-metric-row"><span>Advertiser price / action</span><strong>$2.00</strong></div>
            <div className="business-metric-row"><span>User reward</span><strong>$1.60</strong></div>
            <div className="business-metric-row"><span>Pulse gross contribution</span><strong>$0.40</strong></div>
          </div>
          <div className="business-console-foot"><span><i className="dot positive" /> Budget reserved before start</span><span><i className="dot positive" /> Callback verified</span><span><i className="dot neutral" /> Example only</span></div>
        </div>
      </section>

      <section className="business-principles shell" id="model">
        <article><span>01</span><h3>Define the result.</h3><p>Installation, registration, trial, purchase, survey completion or another event that can be verified objectively.</p></article>
        <article><span>02</span><h3>Choose the model.</h3><p>Direct campaigns reserve funded budget before a start. Cashback settles from verified partner commission after a tracked purchase.</p></article>
        <article><span>03</span><h3>Settle on proof.</h3><p>When the agreed event is confirmed, Pulsercuit applies the configured economics and records the user reward under server authority.</p></article>
      </section>

      <section className="section shell business-value-section" aria-labelledby="business-products-title">
        <div className="section-heading split-heading"><div><span className="section-kicker">Two integration paths</span><h2 id="business-products-title">Acquisition or cashback — one verification philosophy.</h2></div><p>Choose the model that matches the event you can prove.</p></div>
        <div className="business-value-grid">
          <article><div className="step-icon"><Trend /></div><h3>Pulse Direct</h3><p>Prefund a bounded campaign and reward a verified registration, activation, trial or other agreed action.</p></article>
          <article><div className="step-icon"><Check /></div><h3>Cashback Partner</h3><p>Preserve one anonymous tracking reference and report verified commission after a purchase. Pulsercuit calculates the member&apos;s cashback.</p></article>
          <article><div className="step-icon"><Shield /></div><h3>One server boundary</h3><p>No client-side reward authority, no Pulsercuit account ID shared with the partner and no duplicate settlement from repeated callbacks.</p></article>
        </div>
      </section>

      <section className="section shell business-value-section">
        <div className="section-heading split-heading"><div><span className="section-kicker">Why verified-action pricing</span><h2>A clearer path from budget to a verified result.</h2></div><p>A direct pilot is designed around one measurable outcome instead of generic traffic.</p></div>
        <div className="business-value-grid">
          <article><div className="step-icon"><Trend /></div><h3>Outcome-priced</h3><p>Design the pilot around a measurable action instead of buying generic traffic and hoping it converts.</p></article>
          <article><div className="step-icon"><Shield /></div><h3>Funded before start</h3><p>Eligible starts reserve funded campaign capacity before the user is sent to the advertiser experience.</p></article>
          <article><div className="step-icon"><Check /></div><h3>Operator-controlled pilot</h3><p>Early campaigns are reviewed manually. No public self-service spend, no arbitrary pixel and no silent rule changes.</p></article>
        </div>
      </section>

      <section className="section shell business-flow-section">
        <div className="section-heading narrow"><span className="section-kicker">The operating model</span><h2>Four steps. One verified outcome.</h2></div>
        <div className="business-flow">
          <div><small>01</small><strong>Campaign</strong><span>Objective, geography, cap and verification rule</span></div>
          <i>→</i>
          <div><small>02</small><strong>Funding</strong><span>Advertiser budget verified before launch</span></div>
          <i>→</i>
          <div><small>03</small><strong>Funded start</strong><span>Capacity reserved for a pseudonymous session</span></div>
          <i>→</i>
          <div><small>04</small><strong>Verified result</strong><span>Verified result releases the agreed settlement</span></div>
        </div>
      </section>

      <section className="section shell business-pilot-section" id="pilot">
        <div className="business-pilot-copy">
          <span className="section-kicker">Pilot intake</span>
          <h2>Start small enough to learn fast.</h2>
          <p>Start with one verifiable result. For Direct, keep the campaign bounded. For cashback, start with a small catalog or market and a server callback your commerce stack already trusts.</p>
          <div className="trust-points"><span><Check /> No campaign launches automatically</span><span><Check /> We review economics before requesting funding</span><span><Check /> No test budget is created from this form</span></div>
        </div>

        <form className="business-form" action="/api/business/leads" method="post">
          {params.lead ? <div className={`claim-message ${params.lead === "received" ? "success" : "neutral"}`}>{leadCopy[params.lead] ?? "The request state could not be determined."}</div> : null}
          <div className="business-form-grid">
            <label><span>Company</span><input name="company" required minLength={2} maxLength={120} autoComplete="organization" placeholder="Company name" /></label>
            <label><span>Contact</span><input name="contact_name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Your name" /></label>
            <label><span>Work email</span><input name="work_email" required type="email" maxLength={254} autoComplete="email" placeholder="you@company.com" /></label>
            <label><span>Website</span><input name="website" maxLength={500} inputMode="url" placeholder="company.com" /></label>
            <label><span>Product</span><select name="product_interest" required defaultValue=""><option value="" disabled>Select one</option><option value="pulse_direct">Verified-action campaign</option><option value="cashback_partner">Cashback partnership</option><option value="pulse_ads">Advertising placement</option><option value="not_sure">Not sure yet</option></select></label>
            <label><span>Primary objective</span><select name="objective" required defaultValue=""><option value="" disabled>Select one</option><option value="app_install">App install / activation</option><option value="registration">Qualified registration</option><option value="trial">Product trial</option><option value="purchase">Verified purchase</option><option value="cashback">Purchase cashback</option><option value="survey">Survey / research</option><option value="custom">Custom verified action</option></select></label>
            <label><span>Initial budget</span><select name="budget_range" required defaultValue=""><option value="" disabled>Select range</option><option value="pilot_100_500">$100–$500 pilot</option><option value="growth_500_2500">$500–$2,500</option><option value="scale_2500_10000">$2,500–$10,000</option><option value="enterprise_10000_plus">$10,000+</option><option value="not_sure">Not sure yet</option></select></label>
            <label><span>Target countries</span><input name="target_countries" maxLength={300} placeholder="Brazil, Mexico, United States…" /></label>
            <label><span>Target actions</span><input name="estimated_actions" type="number" min={1} max={10000000} inputMode="numeric" placeholder="e.g. 100" /></label>
          </div>
          <label className="business-form-message"><span>What result can your server verify?</span><textarea name="message" maxLength={3000} rows={5} placeholder="Example: confirm an onboarding milestone, or send verified commission after a tracked purchase. Your server sends the callback only after the event is authoritative." /></label>
          <TurnstileField action="business_lead" />
          <button className="button button-lg business-submit" type="submit">Request pilot review <ArrowUpRight /></button>
          <small className="business-form-note">Submitting this form does not create a campaign, charge a card or authorize spend. Pulse reviews the use case first.</small>
        </form>
      </section>

      <section className="final-cta shell business-final-cta"><div><span className="section-kicker">Prefer the user side?</span><h2>Inspect the same proof users see.</h2><p>The marketplace that protects advertiser budget also exposes aggregate reward and payout evidence publicly.</p></div><Link className="button button-lg button-dark" href="/proof">See live proof <ArrowUpRight /></Link></section>

      <footer className="footer shell"><div><strong>Pulsercuit</strong><span>© 2026. Pay for verified actions.</span></div><div><Link href="/">For users</Link><Link href="#model">Model</Link><Link href="#pilot">Pilot</Link></div></footer>
    </main>
  );
}
