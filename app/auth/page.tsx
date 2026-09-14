import Link from "next/link";
import { Brand } from "@/components/brand";
import { TurnstileField } from "@/components/turnstile-field";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-security";
import { cleanReferralCode } from "@/lib/referrals";
import { signIn, signUp } from "./actions";

export const metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ error?: string; message?: string; next?: string; ref?: string }> };

const errorCopy: Record<string, string> = {
  "service-not-configured": "Authentication is not configured yet.",
  "missing-credentials": "Enter your email and password.",
  "invalid-credentials": "Email or password is incorrect.",
  "password-upgrade-required": "This password no longer meets the account security policy. Use password recovery to replace it safely.",
  "invalid-signup": `Use a valid email and a password with at least ${MIN_PASSWORD_LENGTH} characters.`,
  "verification-not-configured": "Human verification is not configured.",
  "verification-token-missing": "Human verification did not finish in your browser. Wait a few seconds, disable blockers for this site if needed, and try again.",
  "verification-expired": "Human verification expired or was already used. Refresh the page and try again.",
  "verification-key-mismatch": "Human verification keys do not match. Check that the Site Key and Secret Key belong to the same Turnstile widget.",
  "verification-hostname": "Human verification rejected this hostname. Open the production domain and verify the Turnstile hostname configuration.",
  "verification-action": "Human verification returned an unexpected action. Refresh the page and try again.",
  "verification-unavailable": "Human verification is temporarily unavailable. Please try again shortly.",
  "verification-token-invalid": "Human verification returned an invalid token. Refresh the page and try again.",
  "verification-failed": "Human verification failed. Please try again.",
  "signup-failed": "We could not create the account. Try another email or sign in.",
  "callback-failed": "The sign-in or recovery link could not be verified. Request a new link if needed.",
};

export default async function AuthPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/dashboard";
  const ref = cleanReferralCode(params.ref);

  return (
    <main className="auth-page">
      <div className="auth-glow" />
      <header className="auth-header shell"><Link href="/" aria-label="Pulsercuit home"><Brand /></Link></header>
      <section className="auth-shell shell">
        <div className="auth-copy">
          <span className="section-kicker">Pulsercuit account</span>
          <h1>One account.<br /><em>Your circuit.</em></h1>
          <p>Sign in to keep your Pulse history, Trust progress, verified rewards and Wallet attached to you across devices.</p>
          <div className="auth-trust"><span>Ledger-first balances</span><span>Verified actions only</span><span>No deposit required</span></div>
          <div className="auth-circuit-visual" aria-label="Pulsercuit product rails">
            <div className="auth-circuit-core"><i /></div>
            <span className="auth-circuit-node node-pulse">Pulse</span>
            <span className="auth-circuit-node node-trust">Trust</span>
            <span className="auth-circuit-node node-proof">Proof</span>
            <span className="auth-circuit-node node-turbo">Turbo</span>
          </div>
        </div>
        <div className="auth-card">
          <div><span className="app-eyebrow">Welcome</span><h2>Continue your Pulse</h2><p>Use the same credentials on every device.</p></div>
          {ref ? <div className="auth-alert success">Verified invite attached. Referral bonuses unlock only after the first confirmed earning conversion.</div> : null}
          {params.error ? <div className="auth-alert error">{errorCopy[params.error] ?? "Something went wrong."}</div> : null}
          {params.message === "check-email" ? <div className="auth-alert success">Check your email to confirm your Pulsercuit account. Your invite will stay attached.</div> : null}
          <form action={signIn} className="auth-form"><input type="hidden" name="next" value={next} />{ref ? <input type="hidden" name="ref" value={ref} /> : null}<label>Email<input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></label><label>Password<input required name="password" type="password" autoComplete="current-password" placeholder="••••••••" /></label><button className="button button-lg" type="submit">Sign in</button></form>
          <div className="auth-help-line">Forgot your password? <Link href="/auth/recover">Recover your account</Link></div>
          <div className="auth-divider"><span>or join the circuit</span></div>
          <form action={signUp} className="auth-form"><input type="hidden" name="next" value={next} />{ref ? <input type="hidden" name="ref" value={ref} /> : null}<label>Email<input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></label><label>Password<input required minLength={MIN_PASSWORD_LENGTH} name="password" type="password" autoComplete="new-password" placeholder={`${MIN_PASSWORD_LENGTH}+ characters`} /></label><TurnstileField action="signup" /><button className="button button-secondary button-lg" type="submit">Create free account</button></form>
          <small>By continuing you agree to the <Link href="/terms">Terms</Link> and acknowledge the <Link href="/privacy">Privacy notice</Link> and <Link href="/rewards-policy">Rewards policy</Link>.</small>
        </div>
      </section>
    </main>
  );
}
