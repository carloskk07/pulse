import Link from "next/link";
import { Brand } from "@/components/brand";
import { TurnstileField } from "@/components/turnstile-field";
import { MIN_PASSWORD_LENGTH, safeAuthNext } from "@/lib/auth-security";
import { cleanReferralCode } from "@/lib/referrals";
import { signIn, signUp } from "./actions";

export const metadata = { title: "Enter Pulsercuit" };

type Props = { searchParams: Promise<{ error?: string; message?: string; next?: string; ref?: string }> };

const errorCopy: Record<string, string> = {
  "service-not-configured": "Authentication is not configured yet.",
  "missing-credentials": "Enter your email and password.",
  "invalid-credentials": "Email or password is incorrect.",
  "password-upgrade-required": "This password no longer meets the account security policy. Use password recovery to replace it safely.",
  "invalid-signup": `Use a valid email and a password with at least ${MIN_PASSWORD_LENGTH} characters.`,
  "verification-not-configured": "Human verification is not configured.",
  "verification-token-missing": "Human verification did not finish. Wait a few seconds and try again.",
  "verification-expired": "Human verification expired. Refresh and try again.",
  "verification-key-mismatch": "Human verification keys do not match.",
  "verification-hostname": "Human verification rejected this hostname.",
  "verification-action": "Human verification returned an unexpected action.",
  "verification-unavailable": "Human verification is temporarily unavailable.",
  "verification-token-invalid": "Human verification returned an invalid token.",
  "verification-failed": "Human verification failed. Try again.",
  "signup-failed": "We could not create the account. Try another email or sign in.",
  "callback-failed": "The sign-in or recovery link could not be verified.",
};

export default async function AuthPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeAuthNext(params.next);
  const ref = cleanReferralCode(params.ref);

  return (
    <main className="auth-page pc-v5-auth-page pc-luxe-auth-page">
      <div className="auth-glow" />
      <div className="pc-v5-auth-grid" aria-hidden="true" />
      <header className="auth-header shell"><Link href="/" aria-label="Pulsercuit home"><Brand /></Link></header>
      <section className="auth-shell shell pc-v5-auth-shell">
        <div className="auth-copy pc-v5-auth-copy pc-luxe-auth-copy">
          <span className="section-kicker">Enter the circuit</span>
          <h1>One account.<br /><em>Keep the climb.</em></h1>
          <p>Pulse, rank, rhythm and Vault — carried across devices.</p>
          <div className="auth-trust pc-v5-auth-trust"><span>Free to join</span><span>Funded rewards</span><span>Real history</span></div>
          <div className="auth-circuit-visual" aria-label="Pulsercuit product rails">
            <div className="auth-circuit-core"><i /></div>
            <span className="auth-circuit-node node-pulse">Pulse</span>
            <span className="auth-circuit-node node-trust">Rank</span>
            <span className="auth-circuit-node node-proof">Proof</span>
            <span className="auth-circuit-node node-turbo">Turbo</span>
          </div>
        </div>
        <div className="auth-card pc-v5-auth-card pc-luxe-auth-card">
          <div><span className="app-eyebrow">Welcome</span><h2>Continue your circuit</h2></div>
          {ref ? <div className="auth-alert success">Invite attached. Qualification still requires verified activity.</div> : null}
          {params.error ? <div className="auth-alert error">{errorCopy[params.error] ?? "Something went wrong."}</div> : null}
          {params.message === "check-email" ? <div className="auth-alert success">Check your email to confirm the account.</div> : null}
          <form action={signIn} className="auth-form"><input type="hidden" name="next" value={next} />{ref ? <input type="hidden" name="ref" value={ref} /> : null}<label>Email<input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></label><label>Password<input required name="password" type="password" autoComplete="current-password" placeholder="••••••••" /></label><TurnstileField action="signin" /><button className="button button-lg pc-v5-primary" type="submit">Enter Pulsercuit</button></form>
          <div className="auth-help-line"><Link href="/auth/recover">Forgot password?</Link></div>
          <div className="auth-divider"><span>new here?</span></div>
          <form action={signUp} className="auth-form"><input type="hidden" name="next" value={next} />{ref ? <input type="hidden" name="ref" value={ref} /> : null}<label>Email<input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></label><label>Password<input required minLength={MIN_PASSWORD_LENGTH} name="password" type="password" autoComplete="new-password" placeholder={`${MIN_PASSWORD_LENGTH}+ characters`} /></label><TurnstileField action="signup" /><button className="button button-secondary button-lg" type="submit">Create your circuit</button></form>
          <small>By continuing you agree to the <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy</Link> and <Link href="/rewards-policy">Rewards policy</Link>.</small>
        </div>
      </section>
    </main>
  );
}
