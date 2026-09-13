import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return <main className="completion-page">
    <header className="completion-header shell"><Link href="/"><Brand /></Link><nav><Link href="/support">Help</Link><Link href="/terms">Terms</Link></nav></header>
    <section className="completion-hero shell"><span className="section-kicker">Privacy</span><h1>Clear data practices.</h1><p>Reward Pulse uses account, security, reward and payout data to operate the service, prevent abuse and keep financial events traceable.</p></section>
    <article className="policy-body shell">
      <h2>What we process</h2><p>We may process account identifiers, authentication and session records, profile information, reward and ledger events, payout status and destination references, referral activity, security and anti-abuse signals, support requests, device or network information and technical logs needed to operate and protect the service.</p>
      <h2>Why we process it</h2><p>We use data to create and protect accounts, display the correct account state, verify rewards, maintain the ledger, process and recover payouts, prevent fraud and duplicate activity, rank useful opportunities, answer support requests, investigate disputes and meet legal, accounting or compliance obligations.</p>
      <h2>Sharing and service providers</h2><p>Infrastructure, authentication, human-verification, reward, analytics where enabled, and payout providers may process limited data when needed for their role. Provider-side offers and payouts can also be subject to the provider’s own privacy terms. We do not treat the public marketing page as authority to create financial events.</p>
      <h2>International processing</h2><p>Some infrastructure or provider services may process data in countries other than the country where you are located. Where an international transfer occurs, it must use an applicable legal mechanism and safeguards required for that transfer. You may request information about relevant sharing and transfer arrangements through the privacy channel.</p>
      <h2>Retention</h2><p>We keep personal data only for as long as needed for the purpose for which it was processed and for legitimate security, dispute, accounting or legal obligations. Account closure does not necessarily require immediate deletion of financial, anti-fraud or transaction records that must be preserved.</p>
      <h2>Security</h2><p>Pulse uses access controls, server-side authority for sensitive writes, row-level database restrictions and verification controls to reduce unauthorized access or manipulation. No internet service can promise absolute security, so security measures are reviewed as the product evolves.</p>
      <h2>Automated ranking</h2><p>Pulse may automatically rank opportunities using factors such as freshness, expected value, evidence quality and operational health. Ranking changes what is shown first; it does not by itself create a reward or move your balance. Where applicable, you may request information or review concerning an automated decision that affects your interests.</p>
      <h2>Your rights</h2><p>Depending on applicable law, you may request confirmation of processing, access, correction, information about sharing, portability, objection, anonymization, blocking or deletion, revocation of consent where consent is the legal basis, and review or explanation of qualifying automated decisions. Some requests can be limited by legal retention or other lawful obligations.</p>
      <h2>Privacy requests</h2><p>Use the <Link href="/support?category=privacy">Help Center privacy channel</Link>. The request receives a protocol so you can retain evidence of the request and its status.</p>
    </article>
    <footer className="completion-footer shell"><span>Reward Pulse</span><div><Link href="/support">Support</Link><Link href="/rewards-policy">Rewards</Link><Link href="/terms">Terms</Link></div></footer>
  </main>;
}
