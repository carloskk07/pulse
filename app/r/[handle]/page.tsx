import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { ArrowUpRight, Check, Users } from "@/components/icons";
import { cleanReferralCode } from "@/lib/referrals";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Props = { params: Promise<{ handle: string }> };

export default async function ReferralLanding({ params }: Props) {
  const { handle } = await params;
  const code = cleanReferralCode(handle);
  if (!code) notFound();

  const admin = createSupabaseAdminClient();
  if (!admin) notFound();

  const { data, error } = await admin.from("profiles").select("handle").eq("referral_code", code).maybeSingle();
  if (error || !data) notFound();
  const inviter = data.handle || "A Pulsercuit member";

  return (
    <main className="referral-landing">
      <div className="referral-glow" />
      <header className="referral-header shell"><Brand /></header>
      <section className="referral-funnel shell">
        <div className="referral-proof"><Users /><span>Verified invite</span></div>
        <h1><em>{inviter}</em> invited you to make your spare minutes count.</h1>
        <p>Join free. Your referral is linked once, and any bonus is released only after the current verified activity rule is satisfied.</p>
        <div className="referral-benefits"><span><Check /> No deposit required</span><span><Check /> One inviter per account</span><span><Check /> No bonus for empty signups</span></div>
        <Link className="button button-lg" href={`/auth?ref=${encodeURIComponent(code)}&next=${encodeURIComponent("/dashboard")}`}>Accept invite <ArrowUpRight /></Link>
        <small>The invite cannot be self-applied or changed after binding. If the qualifying activity is later reversed, any linked referral bonus is reversed as well.</small>
      </section>
    </main>
  );
}
