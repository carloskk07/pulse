import Link from "next/link";
import { Brand } from "@/components/brand";
import { ArrowUpRight, Check, Users } from "@/components/icons";

type Props = { params: Promise<{ handle: string }> };

function cleanHandle(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32) || "A friend";
}

export default async function ReferralLanding({ params }: Props) {
  const { handle } = await params;
  const inviter = cleanHandle(handle);

  return (
    <main className="referral-landing">
      <div className="referral-glow" />
      <header className="referral-header shell"><Brand /></header>
      <section className="referral-funnel shell">
        <div className="referral-proof"><Users /><span>Private invite</span></div>
        <h1><em>{inviter}</em> invited you to make your spare minutes count.</h1>
        <p>Join free, claim your welcome Pulse and unlock your first reward by completing a verified quest.</p>
        <div className="referral-benefits"><span><Check /> No deposit required</span><span><Check /> Clear reward before action</span><span><Check /> Bonus unlocks after a verified first quest</span></div>
        <Link className="button button-lg" href={`/dashboard?ref=${encodeURIComponent(inviter)}`}>Accept invite <ArrowUpRight /></Link>
        <small>Referral rewards activate only after verified activity. Empty signups do not generate a bonus.</small>
      </section>
    </main>
  );
}
