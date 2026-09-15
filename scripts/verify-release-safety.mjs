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

if (existsSync("lib/mock-data.ts")) {
  throw new Error("Dead fabricated offer fixtures must not ship in lib/mock-data.ts.");
}

requireText("next.config.ts", ["Strict-Transport-Security", "frame-ancestors 'none'", "Permissions-Policy", 'source: "/release.json"', 'value: "no-store, max-age=0"']);
requireText(".github/workflows/vercel-prebuilt.yml", ["Stamp exact release identity", "public/release.json", "process.env.GITHUB_SHA", "Verify exact canonical production release", "release.git_sha !== expectedSha"]);
requireText("lib/release-readiness.ts", ["RELEASE_SCHEMA_VERSION = 31", 'RELEASE_SCHEMA_MIGRATION = "0031_current_hourly_claim_security_contract.sql"']);
requireText("supabase/migrations/0031_current_hourly_claim_security_contract.sql", ["claim_hourly_pulse(uuid) security invoker", "claim_hourly_pulse(uuid)', 'EXECUTE'", "release_security_contract"]);
requireText("app/api/withdrawals/route.ts", ["hasCurrentFaucetPayReadProof", "idempotency_key", "matchesCurrentPayoutAuthority"]);
requireText("app/api/return-reminder/route.ts", ["getCanonicalSiteUrl", "new URL(reminderId ? \"/return\" : \"/dashboard\", getCanonicalSiteUrl())"]);
requireText("app/api/business/leads/route.ts", ["POSITIVE_INTEGER_RE", "url.username || url.password"]);
requireText("app/auth/page.tsx", ["safeAuthNext(params.next)"]);
requireText("components/circuit-share-studio.tsx", ["copyTextToClipboard", "isNativeShareAbort"]);
requireText("app/admin/prospects/actions.ts", ["normalizeProspectUrl", "LOCAL_DATETIME_RE", "new Date(`${value}:00Z`)"]);
requireText("components/app-shell.tsx", ["/admin/leads", "/admin/prospects", "/admin/retention"]);

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
