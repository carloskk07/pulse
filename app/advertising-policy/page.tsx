import Link from "next/link";
import { PulsercuitBrand } from "@/components/pulsercuit-brand";

export const metadata = { title: "Advertising Standards" };

export default function AdvertisingPolicyPage() {
  return (
    <main className="completion-page">
      <header className="completion-header shell"><PulsercuitBrand /><nav><Link href="/advertise">Advertise</Link><Link href="/support">Help</Link></nav></header>
      <section className="completion-hero shell">
        <span className="section-kicker">Pulse Ads standards</span>
        <h1>Useful promotion. Clear boundaries.</h1>
        <p>Pulse Ads is native sponsored inventory inside Pulsercuit. Campaigns are reviewed before funding and can be paused when the destination, creative or traffic quality no longer meets these standards.</p>
      </section>
      <section className="completion-card shell">
        <span className="app-eyebrow">Core rule</span>
        <h2>Sponsored traffic is not a paid click scheme.</h2>
        <p>The viewer receives no reward for clicking a Sponsored placement. Base Pulse rewards and Pulse Direct verified-action rewards remain separate products with separate financial authority.</p>
      </section>
      <article className="policy-body shell">
        <h2>Campaign review</h2>
        <p>Every new campaign starts under review. Approval covers the submitted creative and destination at that time; it does not authorize materially different content later.</p>

        <h2>Prohibited campaigns</h2>
        <p>Do not submit malware, phishing, credential theft, deceptive impersonation, fake giveaways, illegal goods or services, explicit sexual content, hate or violent extremist material, unlicensed gambling, weapons sales, controlled substances, or campaigns designed to manipulate Pulsercuit rewards, FaucetPay activity or advertising measurements.</p>

        <h2>Claims and disclosures</h2>
        <p>Campaign titles and messages must describe the destination truthfully. Material conditions, pricing or eligibility should not be hidden when their omission would make the promotion misleading.</p>

        <h2>Funding and billing</h2>
        <p>A campaign is not funded when it is submitted. After approval, the exact campaign budget must be verified through the supported FaucetPay Merchant flow before the campaign can become active. Sponsored CPC spend is recorded only after Pulsercuit served that campaign to the signed-in user and accepted the protected outbound click.</p>

        <h2>Invalid activity</h2>
        <p>Campaign owners cannot create billable clicks on their own campaigns. Duplicate billable clicks for the same campaign and user are limited by Pulsercuit controls. Automated, manipulated or abusive activity can be excluded or investigated.</p>

        <h2>Pauses and discrepancies</h2>
        <p>Pulsercuit may pause a campaign to protect users, advertisers, measurements or platform integrity. If a verified payment or campaign balance appears inconsistent, open a case through the <Link href="/support">Help Center</Link> rather than attempting a second payment.</p>

        <h2>Privacy</h2>
        <p>Pulse Ads stores the minimum internal event data needed for delivery and billing. Sponsored event records do not store a viewer&apos;s email, payout destination or Vault balance.</p>
      </article>
      <footer className="completion-footer shell"><span>Pulsercuit</span><div><Link href="/advertise">Advertise</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/support">Support</Link></div></footer>
    </main>
  );
}
