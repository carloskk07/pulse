import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { ArrowUpRight, Check, Users } from "@/components/icons";
import { cleanReferralCode } from "@/lib/referrals";
import { formatUsdFromCredits, objectValue } from "@/lib/reward-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Props = { params: Promise<{ handle: string }> };

export default async function ReferralLanding({ params }: Props) {
  const { handle } = await params;
  const code = cleanReferralCode(handle);
  if (!code) notFound();

  const admin = createSupabaseAdminClient();
  if (!admin) notFound();

  const [{ data, error }, runtimeResult] = await Promise.all([
    admin.from("profiles").select("handle").eq("referral_code", code).maybeSingle(),
    admin.rpc("current_invite_runtime_state"),
  ]);
  if (error || !data) notFound();
  const inviter = data.handle || "A Pulsercuit member";
  const runtime = objectValue(runtimeResult.data);
  const reward = objectValue(runtime.referral_reward);
  const inviteeBonusRaw = Number(reward.invitee_credits ?? 0);
  const inviteeBonus = Number.isFinite(inviteeBonusRaw) && inviteeBonusRaw > 0 ? inviteeBonusRaw : null;

  return (
    <main className="referral-landing">
      <div className="referral-glow" />
      <header className="referral-header shell"><Brand /></header>
      <section className="referral-funnel shell">
        <div className="referral-proof"><Users /><span>Personal invite</span></div>
        <h1><em>{inviter}</em> invited you to earn free crypto with Pulsercuit.</h1>
        <p>Claim a recurring faucet reward, see what your balance is worth in dollars, explore optional ways to earn more, and build toward a FaucetPay payout.</p>

        {inviteeBonus ? (
          <div className="pc-referral-value-card">
            <small>Current invite bonus</small>
            <strong>+{formatUsdFromCredits(inviteeBonus)}</strong>
            <span>after your first eligible verified activity</span>
          </div>
        ) : null}

        <div className="referral-benefits">
          <span><Check /> Free to join</span>
          <span><Check /> Recurring faucet rewards</span>
          <span><Check /> FaucetPay payout path</span>
        </div>
        <Link className="button button-lg" href={`/auth?mode=signup&ref=${encodeURIComponent(code)}&next=${encodeURIComponent("/dashboard")}`}>Create free account <ArrowUpRight /></Link>
        <small>Your inviter is linked during signup. Referral bonuses apply only while a live reward rule is active and after eligible activity is verified.</small>
      </section>
    </main>
  );
}
