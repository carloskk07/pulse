import { readFileSync } from "node:fs";

const page = readFileSync("app/auth/page.tsx", "utf8");
const actions = readFileSync("app/auth/actions.ts", "utf8");

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
];

for (const fragment of requiredPageFragments) {
  if (!page.includes(fragment)) throw new Error(`Auth page is missing required human-verification gate: ${fragment}`);
}

for (const fragment of requiredActionFragments) {
  if (!actions.includes(fragment)) throw new Error(`Auth actions are missing required human-verification contract: ${fragment}`);
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

console.log("Auth human-verification contract PASS");
