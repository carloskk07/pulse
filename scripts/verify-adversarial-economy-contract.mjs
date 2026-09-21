import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireAll(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(path + " missing adversarial economy contract: " + fragment);
    }
  }
  return source;
}

function forbidAll(path, fragments) {
  const source = read(path).toLowerCase();
  for (const fragment of fragments) {
    if (source.includes(fragment.toLowerCase())) {
      throw new Error(path + " contains forbidden adversarial economy pattern: " + fragment);
    }
  }
}

requireAll("supabase/migrations/0082_referral_network_cycle_guard.sql", [
  "referral_graph_acyclic_guard",
  "pg_advisory_xact_lock(hashtextextended('referral-graph', 0))",
  "'cycle_rejected'",
  "v_beneficiary = any(v_seen)",
  "release_referral_network_integrity_contract",
  "canonical release schema v55",
]);

forbidAll("supabase/migrations/0082_referral_network_cycle_guard.sql", [
  "network_commission_enabled','true",
  "pilot_mode = false",
  "fund_reward_treasury(",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("app/api/direct/start/route.ts", [
  "isTrustedSameOriginMutation(request)",
  'return json(401, { status: "auth-required" })',
  'target.protocol !== "https:"',
  "destination: target.toString()",
]);

forbidAll("app/api/direct/start/route.ts", [
  "NextResponse.redirect(target",
  "NextResponse.redirect(new URL(destination",
]);

requireAll("components/direct-start-button.tsx", [
  'fetch("/api/direct/start"',
  'method: "POST"',
  'credentials: "same-origin"',
  'target.protocol !== "https:"',
  "window.location.assign(target.toString())",
]);

const earn = requireAll("app/earn/page.tsx", [
  "DirectStartButton",
  "campaignId={best.externalId}",
  "campaignId={item.externalId}",
]);
if (earn.includes('action="/api/direct/start"')) {
  throw new Error("Pulse Direct must not depend on a form redirect to an external advertiser.");
}

const csp = read("next.config.ts");
if (csp.includes("form-action 'self' https:")) {
  throw new Error("CSP form-action must not be widened to arbitrary HTTPS origins.");
}

console.log("Adversarial economy + referral graph contract PASS");
