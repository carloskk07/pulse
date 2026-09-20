import { readFileSync } from "node:fs";

const page = readFileSync("app/auth/page.tsx", "utf8");
const actions = readFileSync("app/auth/actions.ts", "utf8");
const turnstileField = readFileSync("components/turnstile-field.tsx", "utf8");

const requiredPageFragments = [
  '<TurnstileField action="signin" />',
  '<TurnstileField action="signup" />',
];

const requiredActionFragments = [
  'const verification = await requireTurnstile(formData, "signin");',
  'const verification = await requireTurnstile(formData, "signup");',
  'const verification = await requireTurnstile(formData, "password_recovery");',
  'if (!verification.success) redirect(authError(turnstileAuthError(verification), next, ref));',
  'await recordReleaseEvidence("turnstile");',
  'function isAuthRateLimited(error: unknown) {',
  'Number(authError.status ?? 0) === 429',
  '"over_request_rate_limit"',
  'redirect(authError("auth-rate-limited", next, ref));',
];

const requiredMultiWidgetFragments = [
  "if (widgetIdRef.current) return true;",
  "const interval = window.setInterval(() => {",
  "if (renderWidget()) window.clearInterval(interval);",
  "if (!widgetIdRef.current && !tokenRef.current) setStatus(\"blocked\");",
];

for (const fragment of requiredPageFragments) {
  if (!page.includes(fragment)) throw new Error(`Auth page is missing required human-verification gate: ${fragment}`);
}

for (const fragment of requiredActionFragments) {
  if (!actions.includes(fragment)) throw new Error(`Auth actions are missing required human-verification contract: ${fragment}`);
}

for (const fragment of requiredMultiWidgetFragments) {
  if (!turnstileField.includes(fragment)) throw new Error(`Turnstile field is missing multi-widget loader contract: ${fragment}`);
}

const signInStart = actions.indexOf("export async function signIn");
const signUpStart = actions.indexOf("export async function signUp");
if (signInStart < 0 || signUpStart <= signInStart) throw new Error("Unable to isolate signIn action for verification");
const signIn = actions.slice(signInStart, signUpStart);
const challengeIndex = signIn.indexOf('requireTurnstile(formData, "signin")');
const passwordAttemptIndex = signIn.indexOf("supabase.auth.signInWithPassword");
if (challengeIndex < 0 || passwordAttemptIndex < 0 || challengeIndex > passwordAttemptIndex) {
  throw new Error("Sign-in must verify Turnstile before attempting password authentication");
}

const rateLimitIndex = signIn.indexOf('isAuthRateLimited(error)');
const invalidCredentialIndex = signIn.indexOf('"invalid-credentials"');
if (
  rateLimitIndex < passwordAttemptIndex
  || invalidCredentialIndex < 0
  || rateLimitIndex > invalidCredentialIndex
) {
  throw new Error("Sign-in must classify Auth rate limiting before invalid credentials");
}

console.log("Auth human-verification contract PASS");
