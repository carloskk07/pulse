import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { isPasswordRecoveryContext, MIN_PASSWORD_LENGTH, PASSWORD_RECOVERY_COOKIE } from "@/lib/auth-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateRecoveredPassword } from "../actions";

export const metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

const errorCopy: Record<string, string> = {
  "service-not-configured": "Password recovery is temporarily unavailable.",
  "password-mismatch": "The two passwords do not match.",
  "password-policy": `Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`,
  "password-update-failed": "The password could not be updated. Request a new recovery link and try again.",
};

export default async function UpdatePasswordPage({ searchParams }: Props) {
  const cookieStore = await cookies();
  const recoveryContext = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value;
  if (!isPasswordRecoveryContext(recoveryContext)) redirect("/auth/recover?error=recovery-required");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/auth/recover?error=service-not-configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/recover?error=recovery-required");

  const params = await searchParams;

  return (
    <main className="auth-page">
      <div className="auth-glow" />
      <header className="auth-header shell"><Link href="/" aria-label="Pulsercuit home"><Brand /></Link></header>
      <section className="auth-shell shell">
        <div className="auth-copy">
          <span className="section-kicker">Verified recovery</span>
          <h1>Create a new password.<br /><em>Keep the same account.</em></h1>
          <p>Your recovery link is valid for a limited time and can only be used to replace this account password.</p>
          <div className="auth-trust"><span>Recovery verified</span><span>{MIN_PASSWORD_LENGTH}+ character minimum</span><span>Link expires automatically</span></div>
        </div>

        <div className="auth-card">
          <div><span className="app-eyebrow">New password</span><h2>Set a new password</h2><p>Use a unique password you do not reuse on another service.</p></div>
          {params.error ? <div className="auth-alert error">{errorCopy[params.error] ?? "Password recovery could not continue."}</div> : null}

          <form action={updateRecoveredPassword} className="auth-form">
            <label>New password<input required minLength={MIN_PASSWORD_LENGTH} name="password" type="password" autoComplete="new-password" placeholder={`${MIN_PASSWORD_LENGTH}+ characters`} /></label>
            <label>Confirm new password<input required minLength={MIN_PASSWORD_LENGTH} name="confirmation" type="password" autoComplete="new-password" placeholder="Repeat your new password" /></label>
            <button className="button button-lg" type="submit">Update password</button>
          </form>

          <div className="auth-help-line">Recovery link expired? <Link href="/auth/recover">Request another one</Link></div>
          <small>Pulsercuit never asks for your previous password, reward balance or payout destination during email recovery.</small>
        </div>
      </section>
    </main>
  );
}
