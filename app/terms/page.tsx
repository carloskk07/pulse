import Link from "next/link";
import { LegalOperatorDisclosure } from "@/components/legal-operator-disclosure";
import { PulsercuitBrand } from "@/components/pulsercuit-brand";

export const metadata = { title: "Terms" };
export const dynamic = "force-dynamic";

export default function TermsPage() {
  return <main className="completion-page">
    <header className="completion-header shell"><PulsercuitBrand /><nav><Link href="/support">Help</Link><Link href="/privacy">Privacy</Link></nav></header>
    <section className="completion-hero shell"><span className="section-kicker">Terms of use</span><h1>Simple rules for earning, balances and payouts.</h1><p>Use Pulsercuit legitimately, keep your account secure, and rely on verified account history for rewards, balances and payouts.</p></section><section className="completion-card shell"><span className="app-eyebrow">Quick summary</span><h2>Use one real account. Earn only from verified activity.</h2><p>Features and third-party availability can change. Rewards can be reversed when the qualifying event is reversed or invalid. Support is available for reward, payout and account questions.</p></section>
    <article className="policy-body shell">
      <LegalOperatorDisclosure />
      <h2>Using the service</h2><p>You may use Pulsercuit only for legitimate activity and only if you can lawfully use the service and the connected reward or payout providers in your location. One person should not operate duplicate accounts to obtain repeated rewards.</p>
      <h2>Reward availability</h2><p>Hourly faucet windows, extra earning opportunities, cashback and other reward options can change, expire or become unavailable. A displayed opportunity is not a promise of payment until the required event is verified under the applicable reward policy. XP, rank and mission progress are participation signals and are not cash, transferable balance or a separate payout entitlement.</p>
      <h2>Account responsibility</h2><p>You are responsible for the accuracy of information you provide and for keeping access to your account secure. Activity that appears automated, deceptive, duplicated or abusive may be limited or reviewed.</p>
      <h2>Third-party services</h2><p>Some opportunities and payouts are delivered by independent providers. Their own eligibility, content and service terms may also apply. Pulsercuit does not control every external offer or provider decision.</p>
      <h2>Sponsored advertising</h2><p>Pulse Ads campaigns are reviewed before funding and are also subject to the <Link href="/advertising-policy">Advertising Standards</Link>. Submitting a campaign does not charge the advertiser. Approved campaigns can be funded through the supported payment flow and spend only under the campaign&apos;s applicable billing rule. Sponsored clicks do not create a reward for the viewer. Pulsercuit may pause or reject advertising to protect users, measurement integrity, legal compliance or the service.</p>
      <h2>Balances and reversals</h2><p>Pulsercuit balances are derived from the authoritative ledger. Verified reversals, chargebacks, duplicate events or invalid activity may reduce a balance when the corresponding original reward is reversed. Cashback becomes spendable only after the underlying partner event is confirmed and can be reversed when that event is cancelled or charged back.</p><h2>Network rewards</h2><p>Network structure can show multiple connection levels, but recruitment alone does not create a monetary reward. Any enabled network commission must be based on verified eligible economic activity and the applicable rule shown by Pulsercuit. A member&apos;s reward is not reduced merely because another member is upstream in the network.</p><h2>Withdrawals and fees</h2><p>Where a Withdrawal Pass policy is active, Pulsercuit may provide a fee-free withdrawal window and may offer additional withdrawals for a clearly disclosed service fee. Any fee must be shown before the withdrawal is reserved. Provider availability, payout authority and safety controls can still limit or delay withdrawals.</p>
      <h2>Changes and availability</h2><p>We may change, suspend or retire features when needed for security, compliance, provider changes or product reliability. We will avoid representing unavailable functions as active.</p>
      <h2>Questions</h2><p>Open a case in the <Link href="/support">Help Center</Link> if you need clarification about a reward, payout, account or policy.</p>
    </article>
    <footer className="completion-footer shell"><span>Pulsercuit</span><div><Link href="/privacy">Privacy</Link><Link href="/rewards-policy">Rewards policy</Link><Link href="/advertising-policy">Advertising</Link><Link href="/support">Support</Link></div></footer>
  </main>;
}
