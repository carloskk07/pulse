import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ArrowUpRight, Check, Shield } from "@/components/icons";

export const metadata = {
  title: "Pulse Direct Integration",
  description: "Technical integration guide for prefunded Pulse Direct verified-action campaigns.",
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

export default function BusinessIntegrationPage() {
  return (
    <main className="marketing-page integration-page">
      <SiteHeader />

      <section className="integration-hero shell">
        <div>
          <div className="eyebrow"><span className="live-dot" /> Pulse Direct integration</div>
          <h1>One session ID. <em>One verified event.</em></h1>
          <p>Pulse itself does not require an advertiser SDK. Your stack only needs to preserve the pseudonymous Pulse session identifier and send one authenticated server-side callback after the agreed milestone is confirmed.</p>
          <div className="hero-actions">
            <Link className="button button-lg" href="/business#pilot">Plan a pilot <ArrowUpRight /></Link>
            <Link className="button button-ghost button-lg" href="/business">Business overview</Link>
          </div>
          <div className="trust-strip"><span><Check /> No Pulse user ID shared</span><span><Shield /> Server-side settlement</span><span><Check /> Idempotent callbacks</span></div>
        </div>
      </section>

      <section className="section shell integration-section">
        <div className="section-heading narrow"><span className="section-kicker">01 · Protected start</span><h2>Preserve the session identifier.</h2><p>When a user starts an eligible direct Drop, Pulse reserves campaign capacity before redirecting them. The destination receives only the campaign and pseudonymous session identifiers.</p></div>
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
        <div className="section-heading narrow"><span className="section-kicker">04 · Atomic settlement</span><h2>The reward moves only after proof.</h2></div>
        <div className="integration-flow">
          <div><small>1</small><strong>Validate</strong><span>Campaign, secret, session, expiry and event identity</span></div><i>→</i><div><small>2</small><strong>Consume</strong><span>Reserved advertiser budget becomes settled spend</span></div><i>→</i><div><small>3</small><strong>Credit</strong><span>User reward enters the authoritative Pulse ledger</span></div>
        </div>
      </section>

      <section className="section shell integration-boundaries">
        <div><span className="section-kicker">What Pulse does not require</span><h2>Keep the first pilot small.</h2></div>
        <div className="integration-checks"><span><Check /> No public advertiser dashboard required</span><span><Check /> No client-side reward claim</span><span><Check /> No arbitrary JavaScript conversion pixel</span><span><Check /> No access to Pulse financial tables</span><span><Check /> No open-ended campaign spend</span><span><Check /> No integration before pilot economics are approved</span></div>
      </section>

      <section className="final-cta shell business-final-cta"><div><span className="section-kicker">Technical fit first</span><h2>Tell us the event. We&apos;ll tell you if the pilot is practical.</h2><p>A campaign request does not create spend or funding authority. We review the verification path before asking for budget.</p></div><Link className="button button-lg button-dark" href="/business#pilot">Request pilot review <ArrowUpRight /></Link></section>

      <footer className="footer shell"><div><strong>Reward Pulse</strong><span>© 2026. Verified-action infrastructure.</span></div><div><Link href="/business">Business</Link><Link href="/">For users</Link></div></footer>
    </main>
  );
}
