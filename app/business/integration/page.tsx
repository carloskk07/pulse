import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ArrowUpRight, Check, Shield } from "@/components/icons";

export const metadata = {
  title: "Pulsercuit Partner Integration",
  description: "Technical integration guide for verified-action campaigns and purchase cashback partners.",
};

const callbackExample = `POST /api/direct/callback
Authorization: Bearer <campaign-callback-secret>
Content-Type: application/json

{
  "campaignId": "<pulse-campaign-id>",
  "sessionId": "<pulse-session-id>",
  "externalEventId": "your-unique-event-id",
  "occurredAt": "2026-09-12T20:00:00Z",
  "metadata": {
    "event": "tutorial_completed"
  }
}`;

const redirectExample = `https://your-product.example/start
  ?pulse_session_id=<uuid>
  &pulse_campaign_id=<uuid>`;


const cashbackRedirectExample = `https://your-store.example/product
  ?subid=<pulsercuit-tracking-uuid>`;

const cashbackCallbackExample = `POST /api/cashback/callback
Authorization: Bearer <cashback-callback-secret>
Content-Type: application/json

{
  "provider": "your-store",
  "trackingId": "<pulsercuit-tracking-uuid>",
  "externalId": "order-12345",
  "status": "confirmed",
  "commissionUsdMicros": 1000000,
  "metadata": {
    "orderReference": "order-12345"
  }
}`;

export default function BusinessIntegrationPage() {
  return (
    <main className="marketing-page integration-page">
      <SiteHeader />

      <section className="integration-hero shell">
        <div>
          <div className="eyebrow"><span className="live-dot" /> Pulsercuit partner integration</div>
          <h1>One reference. <em>One verified event.</em></h1>
          <p>Choose Direct for verified acquisition or Cashback for verified purchases. Neither model needs a Pulsercuit SDK: preserve one pseudonymous reference and send an authenticated server callback after your own backend confirms the event.</p>
          <div className="hero-actions">
            <Link className="button button-lg" href="/business#pilot">Plan a pilot <ArrowUpRight /></Link>
            <Link className="button button-ghost button-lg" href="#cashback">Cashback integration</Link>
          </div>
          <div className="trust-strip"><span><Check /> No Pulse user ID shared</span><span><Shield /> Server-side settlement</span><span><Check /> Idempotent callbacks</span></div>
        </div>
      </section>

      <section className="pc-v10-integration-summary shell" aria-label="Integration summary">
        <article><small>01</small><strong>No partner SDK</strong><span>Preserve one pseudonymous session or tracking ID.</span></article>
        <article><small>02</small><strong>One server event</strong><span>Confirm the milestone or purchase your backend already trusts.</span></article>
        <article><small>03</small><strong>Settlement after proof</strong><span>Pulsercuit applies the configured reward economics after verification.</span></article>
      </section>

      <section className="section shell integration-section" id="direct">
        <div className="section-heading narrow"><span className="section-kicker">Pulse Direct · 01 · Protected start</span><h2>Preserve the session identifier.</h2><p>When a user starts an eligible direct Drop, Pulse reserves campaign capacity before redirecting them. The destination receives only the campaign and pseudonymous session identifiers.</p></div>
        <pre className="integration-code"><code>{redirectExample}</code></pre>
        <div className="integration-note"><Shield /><div><strong>Privacy boundary</strong><span>The redirect does not append the user&apos;s Pulse account ID, email or balance identity.</span></div></div>
      </section>

      <section className="section shell integration-section">
        <div className="section-heading narrow"><span className="section-kicker">02 · Your event</span><h2>Confirm the milestone you actually value.</h2><p>Examples include tutorial completion, first multiplayer match, qualified registration, trial activation or another objective event agreed before campaign launch.</p></div>
        <div className="integration-path-grid">
          <article><span>App backend</span><h3>Server event</h3><p>Your backend stores the Pulse session ID with the acquired user/session and calls Pulse when the milestone becomes authoritative.</p></article>
          <article><span>MMP / attribution</span><h3>Postback path</h3><p>If your attribution stack can preserve a click parameter and return it with the conversion event, use the Pulse session ID as that correlation value.</p></article>
          <article><span>Web product</span><h3>Server conversion</h3><p>Carry the Pulse session through your own session/order/signup flow, then notify Pulse after your server confirms the target result.</p></article>
        </div>
      </section>

      <section className="section shell integration-section">
        <div className="section-heading narrow"><span className="section-kicker">03 · Callback</span><h2>Send one authenticated completion.</h2><p>The campaign callback secret remains server-side. Repeating the same confirmed event is idempotent and cannot credit the user twice.</p></div>
        <pre className="integration-code"><code>{callbackExample}</code></pre>
      </section>

      <section className="section shell integration-section">
        <div className="section-heading narrow"><span className="section-kicker">04 · Settlement</span><h2>Settle only after the event is verified.</h2></div>
        <div className="integration-flow">
          <div><small>1</small><strong>Validate</strong><span>Campaign, secret, session, expiry and event identity</span></div><i>→</i><div><small>2</small><strong>Consume</strong><span>Reserved budget becomes verified spend</span></div><i>→</i><div><small>3</small><strong>Credit</strong><span>User reward enters the verified account balance</span></div>
        </div>
      </section>


      <section className="section shell integration-section" id="cashback">
        <div className="section-heading narrow">
          <span className="section-kicker">Cashback Partner · 01 · Tracking</span>
          <h2>Keep one anonymous purchase reference.</h2>
          <p>When a signed-in member opens an eligible cashback offer, Pulsercuit creates a random tracking UUID tied internally to that member and offer. Your destination receives only that reference in the configured tracking parameter.</p>
        </div>
        <pre className="integration-code"><code>{cashbackRedirectExample}</code></pre>
        <div className="integration-note"><Shield /><div><strong>No account identity in the link</strong><span>The partner receives no Pulsercuit user ID, email, balance or referral identity.</span></div></div>
      </section>

      <section className="section shell integration-section">
        <div className="section-heading narrow">
          <span className="section-kicker">Cashback Partner · 02 · Purchase</span>
          <h2>Attach the tracking reference to your order.</h2>
          <p>Preserve the reference through your checkout or attribution stack. Once your server knows the purchase and commission are authoritative, send the callback. A single tracking reference cannot be rebound to a different external transaction.</p>
        </div>
        <div className="integration-path-grid">
          <article><span>Pending</span><h3>Purchase observed</h3><p>Use pending when the transaction exists but your normal confirmation window has not finished.</p></article>
          <article><span>Confirmed</span><h3>Commission verified</h3><p>Send the commission payable to Pulsercuit. The database computes the member cashback under the active policy.</p></article>
          <article><span>Reversed</span><h3>Refund or cancellation</h3><p>Send reversed for the same external transaction. Pulsercuit unwinds the original cashback authority.</p></article>
        </div>
      </section>

      <section className="section shell integration-section">
        <div className="section-heading narrow">
          <span className="section-kicker">Cashback Partner · 03 · Callback</span>
          <h2>Report commission, not user reward.</h2>
          <p>The callback secret stays server-side. <code>commissionUsdMicros</code> is the verified commission payable to Pulsercuit — not the order total and not the cashback amount. The partner never sends reward credits.</p>
        </div>
        <pre className="integration-code"><code>{cashbackCallbackExample}</code></pre>
      </section>

      <section className="section shell integration-section">
        <div className="section-heading narrow"><span className="section-kicker">Cashback Partner · 04 · Settlement</span><h2>Pulsercuit owns the reward calculation.</h2></div>
        <div className="integration-flow">
          <div><small>1</small><strong>Authenticate</strong><span>Callback secret, provider and tracking reference</span></div><i>→</i><div><small>2</small><strong>Bind</strong><span>Tracking reference to one external transaction</span></div><i>→</i><div><small>3</small><strong>Settle</strong><span>Database computes and records cashback from verified commission</span></div>
        </div>
      </section>

      <section className="section shell integration-boundaries">
        <div><span className="section-kicker">What Pulsercuit does not require</span><h2>Keep the first integration small.</h2></div>
        <div className="integration-checks"><span><Check /> No public advertiser dashboard required</span><span><Check /> No client-side reward claim</span><span><Check /> No arbitrary JavaScript conversion pixel</span><span><Check /> No access to Pulse financial tables</span><span><Check /> No open-ended campaign spend</span><span><Check /> No integration before economics are approved</span></div>
      </section>

      <section className="final-cta shell business-final-cta"><div><span className="section-kicker">Technical fit first</span><h2>Tell us the event or purchase flow.</h2><p>A request does not create spend, funding authority or a public cashback offer. We review the verification path and economics first.</p></div><Link className="button button-lg button-dark" href="/business#pilot">Request pilot review <ArrowUpRight /></Link></section>

      <footer className="footer shell"><div><strong>Pulsercuit</strong><span>© 2026. Verified-result infrastructure.</span></div><div><Link href="/business">Business</Link><Link href="/">For users</Link></div></footer>
    </main>
  );
}
