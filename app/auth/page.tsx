import Link from "next/link";
import { Brand } from "@/components/brand";
import { TurnstileField } from "@/components/turnstile-field";
import { MIN_PASSWORD_LENGTH, safeAuthNext } from "@/lib/auth-security";
import { cleanReferralCode } from "@/lib/referrals";
import { signIn, signUp } from "./actions";

export const metadata = { title: "Enter Pulsercuit" };

type Props = { searchParams: Promise<{ error?: string; message?: string; next?: string; ref?: string; mode?: string }> };

const errorCopy: Record<string, string> = {
  "service-not-configured": "Authentication is temporarily unavailable.",
  "missing-credentials": "Enter your email and password.",
  "invalid-credentials": "Email or password is incorrect.",
  "auth-rate-limited": "Authentication is receiving too many requests right now. Wait a moment and try again.",
  "password-upgrade-required": "This password is no longer accepted by the security policy. Use password recovery to replace it safely.",
  "password-compromised": "This password appears in known breach data. Choose a unique password you have not used elsewhere.",
  "password-security-unavailable": "Password safety verification is temporarily unavailable. Try again in a moment.",
  "invalid-signup": `Use a valid email and a password with at least ${MIN_PASSWORD_LENGTH} characters.`,
  "verification-not-configured": "Human verification is temporarily unavailable.",
  "verification-token-missing": "Verification did not finish. Wait a moment and try again.",
  "verification-expired": "Verification expired. Refresh and try again.",
  "verification-key-mismatch": "Verification could not be completed.",
  "verification-hostname": "Verification could not be completed on this address.",
  "verification-action": "Verification needs another try.",
  "verification-unavailable": "Human verification is temporarily unavailable.",
  "verification-token-invalid": "Verification needs another try.",
  "verification-failed": "Human verification failed. Try again.",
  "signup-failed": "We could not create the account. Try another email or sign in.",
  "callback-failed": "The sign-in or recovery link could not be verified.",
};

function authModeHref(mode: "signin" | "signup", next: string, ref: string | null) {
  const query = new URLSearchParams({ mode, next });
  if (ref) query.set("ref", ref);
  return `/auth?${query.toString()}`;
}

export default async function AuthPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeAuthNext(params.next);
  const ref = cleanReferralCode(params.ref);
  const mode = params.mode === "signup" ? "signup" : "signin";
  const signingUp = mode === "signup";

  return (
    <main className="auth-page pc-v5-auth-page pc-luxe-auth-page">
      <div className="auth-glow" />
      <div className="pc-v5-auth-grid" aria-hidden="true" />
      <header className="auth-header shell"><Link href="/" aria-label="Pulsercuit home"><Brand /></Link></header>

      <section className="auth-shell shell pc-v5-auth-shell">
        <div className="auth-copy pc-v5-auth-copy pc-luxe-auth-copy">
          <span className="section-kicker">One account</span>
          <h1>{signingUp ? <>Start your <em>circuit.</em></> : <>Welcome <em>back.</em></>}</h1>
          <p>Pulse, progress and Vault follow the same account across devices.</p>
          <div className="auth-trust pc-v5-auth-trust">
            <span>Free to join</span>
            <span>Compromised passwords blocked</span>
            <span>Real history</span>
          </div>
        </div>

        <div className="auth-card pc-v5-auth-card pc-luxe-auth-card">
          <div>
            <span className="app-eyebrow">{signingUp ? "Create account" : "Sign in"}</span>
            <h2>{signingUp ? "Create your Pulsercuit account" : "Continue your circuit"}</h2>
          </div>

          <div className="auth-mode-switch" aria-label="Authentication mode">
            <Link className={!signingUp ? "active" : ""} href={authModeHref("signin", next, ref)}>Sign in</Link>
            <Link className={signingUp ? "active" : ""} href={authModeHref("signup", next, ref)}>Create account</Link>
          </div>

          {ref ? <div className="auth-alert success">Invite attached. Qualification still requires verified activity.</div> : null}
          {params.error ? <div className="auth-alert error">{errorCopy[params.error] ?? "Something went wrong."}</div> : null}
          {params.message === "check-email" ? <div className="auth-alert success">Check your email to confirm the account.</div> : null}
          {params.message === "password-updated" ? <div className="auth-alert success">Password updated. Sign in with your new password to finish account recovery.</div> : null}

          {signingUp ? (
            <form action={signUp} className="auth-form">
              <input type="hidden" name="next" value={next} />
              {ref ? <input type="hidden" name="ref" value={ref} /> : null}
              <label>Email<input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></label>
              <label>Password<input required minLength={MIN_PASSWORD_LENGTH} name="password" type="password" autoComplete="new-password" placeholder={MIN_PASSWORD_LENGTH + "+ characters"} /></label>
              <TurnstileField action="signup" />
              <button className="button button-lg pc-v5-primary" type="submit">Create account</button>
            </form>
          ) : (
            <form action={signIn} className="auth-form">
              <input type="hidden" name="next" value={next} />
              {ref ? <input type="hidden" name="ref" value={ref} /> : null}
              <label>Email<input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></label>
              <label>Password<input required name="password" type="password" autoComplete="current-password" placeholder="••••••••" /></label>
              <TurnstileField action="signin" />
              <button className="button button-lg pc-v5-primary" type="submit">Sign in</button>
              <div className="auth-help-line"><Link href="/auth/recover">Forgot password?</Link></div>
            </form>
          )}

          <small>By continuing you agree to the <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy</Link> and <Link href="/rewards-policy">Rewards policy</Link>.</small>
        </div>
      </section>
    </main>
  );
}
