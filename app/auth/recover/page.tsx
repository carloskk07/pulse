import Link from "next/link";
import { Brand } from "@/components/brand";
import { TurnstileField } from "@/components/turnstile-field";
import { requestPasswordReset } from "../actions";

export const metadata = { title: "Recover account" };

type Props = { searchParams: Promise<{ error?: string; message?: string }> };

const errorCopy: Record<string, string> = {
  "service-not-configured": "Account recovery is temporarily unavailable.",
  "missing-email": "Enter the email address used for your Pulsercuit account.",
  "recovery-required": "That recovery session is missing or expired. Request a new recovery link.",
  "verification-not-configured": "Human verification is not configured.",
  "verification-token-missing": "Human verification did not finish. Wait a few seconds and try again.",
  "verification-expired": "Human verification expired. Refresh the page and try again.",
  "verification-key-mismatch": "Human verification is misconfigured for this environment.",
  "verification-hostname": "Human verification rejected this hostname. Use the production domain.",
  "verification-action": "Human verification returned an unexpected action. Refresh and try again.",
  "verification-unavailable": "Human verification is temporarily unavailable. Try again shortly.",
  "verification-token-invalid": "Human verification returned an invalid token. Refresh and try again.",
  "verification-failed": "Human verification failed. Please try again.",
};

export default async function RecoverPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="auth-page">
      <div className="auth-glow" />
      <header className="auth-header shell"><Link href="/" aria-label="Pulsercuit home"><Brand /></Link></header>
      <section className="auth-shell shell">
        <div className="auth-copy">
          <span className="section-kicker">Account security</span>
          <h1>Recover your account.<br /><em>Keep your progress.</em></h1>
          <p>Enter the email used for your Pulsercuit account. If recovery is available, you will receive the next step by email.</p>
          <div className="auth-trust"><span>Secure reset</span><span>Short-lived link</span><span>Same response for every email</span></div>
        </div>

        <div className="auth-card">
          <div><span className="app-eyebrow">Password recovery</span><h2>Send a secure reset link</h2><p>If the account can be recovered, a secure reset link will be sent by email.</p></div>
          {params.error ? <div className="auth-alert error">{errorCopy[params.error] ?? "Recovery could not continue. Request a new link."}</div> : null}
          {params.message === "check-email" ? <div className="auth-alert success">If an account can be recovered for that address, a reset email is on its way. Check spam or junk folders too.</div> : null}

          <form action={requestPasswordReset} className="auth-form">
            <label>Email<input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></label>
            <TurnstileField action="password_recovery" />
            <button className="button button-lg" type="submit">Send recovery link</button>
          </form>

          <div className="auth-help-line">Remembered your password? <Link href="/auth">Return to sign in</Link></div>
          <small>For privacy, Pulsercuit shows the same completion message whether or not an address is registered.</small>
        </div>
      </section>
    </main>
  );
}
