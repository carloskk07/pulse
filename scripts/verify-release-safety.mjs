import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(path, fragments) {
  const value = read(path);
  for (const fragment of fragments) {
    if (!value.includes(fragment)) {
      throw new Error(`${path} is missing required release-safety contract: ${fragment}`);
    }
  }
}

function forbidText(path, fragments) {
  const value = read(path);
  for (const fragment of fragments) {
    if (value.includes(fragment)) {
      throw new Error(`${path} contains forbidden release-safety pattern: ${fragment}`);
    }
  }
}

if (existsSync("lib/mock-data.ts")) {
  throw new Error("Dead fabricated offer fixtures must not ship in lib/mock-data.ts.");
}

requireText("next.config.ts", ["Strict-Transport-Security", "frame-ancestors 'none'", "Permissions-Policy", 'source: "/release.json"', 'value: "no-store, max-age=0"']);
requireText(".github/workflows/vercel-prebuilt.yml", ["Stamp exact release identity", "public/release.json", "process.env.GITHUB_SHA", "Verify exact canonical production release", "release.git_sha !== expectedSha"]);
requireText("lib/release-readiness.ts", ["RELEASE_SCHEMA_VERSION = 36", 'RELEASE_SCHEMA_MIGRATION = "0036_hourly_pulse_pilot_isolation.sql"', 'admin.rpc("release_authenticated_read_scope_contract")', 'admin.rpc("release_reward_exchange_contract")', 'admin.rpc("release_pulse_direct_contract")', 'admin.rpc("release_hourly_pulse_pilot_contract")', '"legal-operator"', 'legalIdentity ? "pass" : "pending"', 'Deferred from the current technical-readiness scope', 'false,']);
requireText("lib/hourly-pilot-readiness.ts", ["HOURLY_PILOT_SCHEMA_VERSION = 36", 'admin.rpc("release_hourly_pulse_pilot_contract")', "schemaVersion >= HOURLY_PILOT_SCHEMA_VERSION"]);
requireText("app/api/readiness/route.ts", ["getHourlyPilotReadiness", "hourlyPilot.ok", 'service: "pulsercuit"']);
requireText("supabase/migrations/0031_current_hourly_claim_security_contract.sql", ["claim_hourly_pulse(uuid) security invoker", "claim_hourly_pulse(uuid)', 'EXECUTE'", "release_security_contract"]);
requireText("supabase/migrations/0032_authenticated_read_scope_contract.sql", ["release_authenticated_read_scope_contract", "security_invoker=true", "risk_score", "role_table_grants"]);
requireText("supabase/migrations/0033_treasury_reservation_expiry.sql", ["release_expired_treasury_reservations", "status = 'expired'", "expires_at <= now()", "perform public.release_expired_treasury_reservations(v_treasury_id)", "release_reward_exchange_contract", "version', 33"]);
requireText("supabase/migrations/0034_treasury_idempotency_expiry.sql", ["v_existing.status = 'reserved' and v_existing.expires_at <= now()", "perform public.release_expired_treasury_reservations(v_existing.treasury_id)", "reservation_status", "version', 34"]);
requireText("supabase/migrations/0035_direct_event_temporal_integrity.sql", ["invalid_occurred_at", "v_session.created_at - interval '5 minutes'", "v_session.expires_at + interval '5 minutes'", "v_effective_occurred_at", "release_pulse_direct_contract", "version', 35"]);
requireText("supabase/migrations/0036_hourly_pulse_pilot_isolation.sql", ["pilot_mode", "pilot_user_ids", "pilot_restricted", "release_hourly_pulse_pilot_contract", "version', 36"]);
requireText("lib/request-security.ts", ["isTrustedSameOriginMutation", 'request.headers.get("origin")', 'request.headers.get("sec-fetch-site")', 'fetchSite !== "same-origin"']);
requireText("app/api/pulse/claim/route.ts", ["isTrustedSameOriginMutation(request)", "claim_hourly_pulse", "pilot_restricted"]);
requireText("app/api/withdrawals/route.ts", ["isTrustedSameOriginMutation(request)", "hasCurrentFaucetPayReadProof", "idempotency_key", "matchesCurrentPayoutAuthority"]);
requireText("app/api/return-reminder/route.ts", ["export async function POST", "isTrustedSameOriginMutation(request)", "getCanonicalSiteUrl", "new URL(reminderId ? \"/return\" : \"/dashboard\", getCanonicalSiteUrl())"]);
forbidText("app/api/return-reminder/route.ts", ["export async function GET"]);
requireText("app/api/direct/start/route.ts", ["isTrustedSameOriginMutation(request)", 'admin.rpc("start_direct_campaign_session"', 'target.protocol !== "https:"']);
forbidText("app/api/direct/start/route.ts", ['request.headers.get("origin")']);
requireText("app/api/direct/callback/route.ts", ["invalid_occurred_at", 'admin.rpc("settle_direct_campaign_completion"', 'p_occurred_at: occurredAt.toISOString()']);
requireText("components/next-circuit-panel.tsx", ['action="/api/return-reminder"', 'method="post"', 'type="submit"']);
requireText("app/api/business/leads/route.ts", ["POSITIVE_INTEGER_RE", "url.username || url.password"]);
requireText("app/auth/page.tsx", ["safeAuthNext(params.next)"]);
requireText("components/circuit-share-studio.tsx", ["copyTextToClipboard", "isNativeShareAbort"]);
requireText("app/admin/prospects/actions.ts", ["normalizeProspectUrl", "UUID_RE", "LOCAL_DATETIME_RE", "new Date(`${value}:00Z`)"]);
requireText("app/admin/support/actions.ts", ["UUID_RE.test(id)"]);
requireText("components/app-shell.tsx", ["/admin/leads", "/admin/prospects", "/admin/retention"]);
requireText("app/styles/pulsercuit-v7-fixes.css", ["Truthful public rank presentation", ".pc-v6-ranks article:nth-child(3):before{display:none!important}"]);
requireText("app/styles/pulsercuit-v7-audit.css", ['content:"PULSERCUIT / 01"']);

const manifest = JSON.parse(read("public/manifest.webmanifest"));
if (manifest.id !== "/" || manifest.scope !== "/" || !Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  throw new Error("PWA manifest must keep stable id/scope and at least one application icon.");
}
for (const icon of manifest.icons) {
  if (typeof icon?.src !== "string" || !icon.src.startsWith("/") || !existsSync(`public${icon.src}`)) {
    throw new Error(`PWA manifest references a missing or invalid icon: ${icon?.src ?? "unknown"}`);
  }
}

console.log("Release safety contracts PASS");
