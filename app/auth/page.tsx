import Link from "next/link";
import { Brand } from "@/components/brand";
import { TurnstileField } from "@/components/turnstile-field";
import { cleanReferralCode } from "@/lib/referrals";
import { signIn, signUp } from "./actions";

export const metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ error?: string; message?: string; next?: string; ref?: string }> };

const errorCopy: Record<string, string> = {
  "service-not-configured": "Authentication is not configured yet.",
  "missing-credentials": "Enter your email and password.",
  "invalid-credentials": "Email or password is incorrect.",
  "invalid-signup": "Use a valid email and a password with at least 8 characters.",
  "verification-not-configured": "Human verification is not configured.",
  "verification-failed": "Human verification failed. Please try again.",
  "signup-failed": "We could not create the account. Try another email or sign in.",
  "callback-failed": "The sign-in link could not be verified.",
};

export default async function AuthPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/dashboard";
  const ref = cleanReferralCode(params.ref);

  return (
    <main className="auth-page">
      <div className="auth-glow" />
      <header className="auth-header shell"><Link href="/" aria-label="Reward Pulse home"><Brand /></Link></header>
      <section className="auth-shell shell">
        <div className="auth-copy">
          <span className="section-kicker">Reward Pulse account</span>
          <h1>One account.<br /><em>Clear value.</em></h1>
          <p>Sign in to keep your streak, ledger and verified rewards attached to you.</p>
          <div className="auth-trust"><span>Ledger-first balances</span><span>Verified actions only</span><span>No deposit required</span></div>
        </div>

        <div className="auth-card">
          <div><span className="app-eyebrow">Welcome</span><h2>Continue your Pulse</h2><p>Use the same credentials on every device.</p></div>
          {ref ? <div className="auth-alert success">Verified invite attached. Referral bonuses unlock only after the first confirmed earning conversion.</div> : null}
          {params.error ? <div className="auth-alert error">{errorCopy[params.error] ?? "Something went wrong."}</div> : null}
          {params.message === "check-email" ? <div className="auth-alert success">Check your email to confirm your account. Your invite will stay attached.</div> : null}

          <form action={signIn} className="auth-form">
            <input type="hidden" name="next" value={next} />
            {ref ? <input type="hidden" name="ref" value={ref} /> : null}
            <label>Email<input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></label>
            <label>Password<input required name="password" type="password" autoComplete="current-password" placeholder="••••••••" /></label>
            <button className="button button-lg" type="submit">Sign in</button>
          </form>

          <div className="auth-divider"><span>or create your account</span></div>

          <form action={signUp} className="auth-form">
            <input type="hidden" name="next" value={next} />
            {ref ? <input type="hidden" name="ref" value={ref} /> : null}
            <label>Email<input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></label>
            <label>Password<input required minLength={8} name="password" type="password" autoComplete="new-password" placeholder="8+ characters" /></label>
            <TurnstileField action="signup" />
            <button className="button button-secondary button-lg" type="submit">Create free account</button>
          </form>
          <small>By continuing you agree to use the platform only for legitimate, human activity.</small>
        </div>
      </section>
    </main>
  );
}
