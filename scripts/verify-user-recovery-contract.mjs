import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireFragments(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(`${path} is missing recovery/readiness contract: ${fragment}`);
    }
  }
  return source;
}

function copyKeys(path, constantName) {
  const source = read(path);
  const start = source.indexOf(`const ${constantName}: Record<string, string> = {`);
  const end = source.indexOf("\n};", start);
  if (start < 0 || end < 0) throw new Error(`Unable to isolate ${constantName} in ${path}`);
  const block = source.slice(start, end);
  return new Set(
    [...block.matchAll(/^\s*(?:"([^"]+)"|([A-Za-z0-9_-]+))\s*:/gm)]
      .map((match) => match[1] ?? match[2])
      .filter(Boolean),
  );
}

const claimKeys = copyKeys("app/dashboard/page.tsx", "claimCopy");
for (const state of [
  "success",
  "not-ready",
  "budget-paused",
  "backing-refreshing",
  "claim-in-progress",
  "trust-review",
  "verification-failed",
  "verification-not-configured",
  "service-not-configured",
  "failed",
]) {
  if (!claimKeys.has(state)) throw new Error(`Dashboard is missing claim recovery copy for ${state}`);
}

const withdrawalKeys = copyKeys("app/wallet/page.tsx", "withdrawalCopy");
for (const state of [
  "paid",
  "processing",
  "held",
  "insufficient",
  "invalid-destination",
  "provider-temporary",
  "verification-failed",
  "verification-not-configured",
  "payout-not-configured",
  "pilot-restricted",
  "service-not-configured",
  "free-pass-used",
  "reserve-failed",
  "failed",
]) {
  if (!withdrawalKeys.has(state)) throw new Error(`Wallet is missing payout recovery copy for ${state}`);
}

requireFragments("lib/turnstile.ts", [
  "export function hasTurnstileRuntimeAuthority()",
  "allowedHostnames().length > 0",
  "if (hostnames.length === 0)",
]);

requireFragments("app/dashboard/page.tsx", [
  'import { cleanOperationalReference } from "@/lib/operational-flow";',
  'import { hasTurnstileRuntimeAuthority } from "@/lib/turnstile";',
  "hasTurnstileRuntimeAuthority()",
  'cleanOperationalReference(params.ref, "claim")',
  "Support reference: {operationalRef}",
]);

requireFragments("app/wallet/page.tsx", [
  'import { cleanOperationalReference } from "@/lib/operational-flow";',
  'import { hasTurnstileRuntimeAuthority } from "@/lib/turnstile";',
  "hasTurnstileRuntimeAuthority()",
  'cleanOperationalReference(params.ref, "withdrawal")',
  "Support reference: {operationalRef}",
]);

const operational = requireFragments("lib/operational-flow.ts", [
  'export type OperationalFlow = "claim" | "withdrawal";',
  'const REFERENCE_RE = /^(cl|wd)-[0-9a-f]{12}$/;',
  "createOperationalReference",
  "cleanOperationalReference",
  "logOperationalIssue",
  '"PULSECIRCUIT_OPERATIONAL_ISSUE"',
  "stage:",
  "status:",
  "code:",
  "retryable:",
]);

for (const forbidden of [
  "userId",
  "email",
  "destination",
  "wallet",
  "ipAddress",
  "remoteIp",
]) {
  if (operational.includes(forbidden)) {
    throw new Error(`Operational log authority must not accept sensitive field ${forbidden}`);
  }
}

requireFragments("app/api/pulse/claim/route.ts", [
  "claimIssueRedirect(",
  '"profile-self-heal"',
  '"claim-rpc"',
  '"unexpected-claim-status"',
  'url.searchParams.set("ref", reference)',
]);

requireFragments("app/api/withdrawals/route.ts", [
  "withdrawalIssueRedirect(",
  '"reserved-payout-shape"',
  '"dispatch-claim"',
  '"paid-finalize"',
  '"failed-finalize"',
  '"provider-send"',
  '"active-withdrawal-read"',
  '"reserve-withdrawal"',
  'url.searchParams.set("ref", reference)',
]);

requireFragments("app/auth/actions.ts", [
  'const { error } = await supabase.auth.resetPasswordForEmail(email, {',
  "if (isAuthRateLimited(error))",
  'redirect("/auth/recover?error=auth-rate-limited")',
  'redirect("/auth/recover?error=recovery-unavailable")',
  'redirect("/auth/recover?message=check-email")',
]);

const recoveryCopy = copyKeys("app/auth/recover/page.tsx", "errorCopy");
for (const state of [
  "auth-rate-limited",
  "recovery-unavailable",
]) {
  if (!recoveryCopy.has(state)) {
    throw new Error(`Recovery page is missing truthful delivery copy for ${state}`);
  }
}

console.log("User recovery and operational observability contract PASS");
