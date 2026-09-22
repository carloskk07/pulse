import { readFileSync, appendFileSync } from "node:fs";

const SENSITIVE_PLACEHOLDER = "[SENSITIVE]";
const CANONICAL_SITE = "https://pulsercuit.pro";

export function parseEnv(text) {
  const values = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    values.set(match[1], String(value));
  }
  return values;
}

export function classifyValue(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "MISSING";
  if (normalized === SENSITIVE_PLACEHOLDER) return "SENSITIVE_MANAGED";
  return "PRESENT";
}

export function classifyGroup(values, keys) {
  const states = keys.map((key) => classifyValue(values.get(key)));
  if (states.includes("MISSING")) return "MISSING";
  if (states.includes("SENSITIVE_MANAGED")) return "SENSITIVE_MANAGED";
  return "PRESENT";
}

export function classifyBuildVisibleGroup(values, keys) {
  const states = keys.map((key) => classifyValue(values.get(key)));
  if (states.includes("MISSING")) return "MISSING";
  if (states.includes("SENSITIVE_MANAGED")) return "BUILD_VALUE_UNAVAILABLE";
  return "PRESENT";
}

export function classifyBuildVisibleAny(values, keys) {
  const states = keys.map((key) => classifyValue(values.get(key)));
  if (states.includes("PRESENT")) return "PRESENT";
  if (states.includes("SENSITIVE_MANAGED")) return "BUILD_VALUE_UNAVAILABLE";
  return "MISSING";
}

export function classifySupabasePublicConfig(values) {
  const urlState = classifyBuildVisibleGroup(values, ["NEXT_PUBLIC_SUPABASE_URL"]);
  if (urlState !== "PRESENT") return urlState;
  return classifyBuildVisibleAny(values, [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]);
}

function runSelfTest() {
  const fixture = parseEnv(`\nPUBLIC=value\nSECRET=[SENSITIVE]\nQUOTED="hello"\nEMPTY=\n`);
  const publishableOnly = parseEnv(`\nNEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_example\n`);
  const legacyOnly = parseEnv(`\nNEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=legacy-anon\n`);
  const noPublicKey = parseEnv(`\nNEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\n`);
  const assertions = [
    [classifyValue(fixture.get("PUBLIC")), "PRESENT", "plain value"],
    [classifyValue(fixture.get("SECRET")), "SENSITIVE_MANAGED", "sensitive placeholder"],
    [classifyValue(fixture.get("EMPTY")), "MISSING", "empty value"],
    [classifyValue(fixture.get("UNKNOWN")), "MISSING", "missing value"],
    [classifyGroup(fixture, ["PUBLIC", "QUOTED"]), "PRESENT", "plain group"],
    [classifyGroup(fixture, ["PUBLIC", "SECRET"]), "SENSITIVE_MANAGED", "managed-sensitive server group"],
    [classifyGroup(fixture, ["PUBLIC", "UNKNOWN"]), "MISSING", "missing server group"],
    [classifyBuildVisibleGroup(fixture, ["PUBLIC", "QUOTED"]), "PRESENT", "build-visible group"],
    [classifyBuildVisibleGroup(fixture, ["PUBLIC", "SECRET"]), "BUILD_VALUE_UNAVAILABLE", "sensitive build-visible group"],
    [classifyBuildVisibleGroup(fixture, ["PUBLIC", "UNKNOWN"]), "MISSING", "missing build-visible group"],
    [classifyBuildVisibleAny(fixture, ["UNKNOWN", "PUBLIC"]), "PRESENT", "build-visible alternative"],
    [classifyBuildVisibleAny(fixture, ["UNKNOWN", "SECRET"]), "BUILD_VALUE_UNAVAILABLE", "managed build-visible alternative"],
    [classifyBuildVisibleAny(fixture, ["UNKNOWN", "EMPTY"]), "MISSING", "missing build-visible alternatives"],
    [classifySupabasePublicConfig(publishableOnly), "PRESENT", "publishable-only Supabase config"],
    [classifySupabasePublicConfig(legacyOnly), "PRESENT", "legacy-only Supabase config"],
    [classifySupabasePublicConfig(noPublicKey), "MISSING", "Supabase config without a public key"],
  ];

  for (const [actual, expected, label] of assertions) {
    if (actual !== expected) throw new Error(`Env audit self-test failed for ${label}: expected ${expected}, received ${actual}`);
  }
  console.log("Vercel production env audit contract PASS");
}

function audit(envPath) {
  const values = parseEnv(readFileSync(envPath, "utf8"));
  const siteState = classifyBuildVisibleGroup(values, ["NEXT_PUBLIC_SITE_URL"]);
  const siteValue = String(values.get("NEXT_PUBLIC_SITE_URL") ?? "").trim().replace(/\/+$/, "");

  const checks = [
    ["public-site", siteState === "PRESENT" && siteValue === CANONICAL_SITE ? "PRESENT" : siteState === "BUILD_VALUE_UNAVAILABLE" ? "BUILD_VALUE_UNAVAILABLE" : "MISSING"],
    ["supabase-public", classifySupabasePublicConfig(values)],
    ["turnstile-public", classifyBuildVisibleGroup(values, ["NEXT_PUBLIC_TURNSTILE_SITE_KEY"])],
    ["service-role", classifyGroup(values, ["SUPABASE_SERVICE_ROLE_KEY"])],
    ["turnstile-secret", classifyGroup(values, ["TURNSTILE_SECRET_KEY"])],
    ["faucetpay", classifyGroup(values, [
      "FAUCETPAY_SCOPED_KEY",
      "FAUCETPAY_PAYOUT_CURRENCY",
      "FAUCETPAY_PAYOUT_CREDITS",
      "FAUCETPAY_PAYOUT_UNITS",
      "FAUCETPAY_PAYOUT_LABEL",
    ])],
  ];

  const legalState = classifyGroup(values, [
    "LEGAL_OPERATOR_NAME",
    "LEGAL_OPERATOR_JURISDICTION",
    "LEGAL_OPERATOR_ADDRESS",
    "LEGAL_CONTACT_EMAIL",
    "PRIVACY_CONTACT_EMAIL",
  ]);
  const legalDisplay = legalState === "MISSING" ? "DEFERRED" : legalState;

  for (const [id, state] of checks) console.log(`Release config ${id}: ${state}`);
  console.log(`Release config legal-operator: ${legalDisplay}`);

  const blocking = checks.filter(([, state]) => state === "MISSING" || state === "BUILD_VALUE_UNAVAILABLE");
  const missing = blocking.filter(([, state]) => state === "MISSING").map(([id]) => id);
  const buildUnavailable = blocking.filter(([, state]) => state === "BUILD_VALUE_UNAVAILABLE").map(([id]) => id);
  const managedSensitive = checks.filter(([, state]) => state === "SENSITIVE_MANAGED").map(([id]) => id);

  if (missing.length) {
    console.log(`::error title=Pulsercuit release configuration::Missing required technical release configuration groups: ${missing.join(", ")}. Values are intentionally never printed.`);
  }
  if (buildUnavailable.length) {
    console.log(`::error title=Pulsercuit public build configuration::Client-visible configuration is marked sensitive and cannot be embedded into the prebuilt browser bundle: ${buildUnavailable.join(", ")}. Store these NEXT_PUBLIC values as runner-readable production variables.`);
  }
  if (managedSensitive.length) {
    console.log(`::notice title=Pulsercuit managed sensitive configuration::Server-only sensitive groups are configured in Vercel but their values are intentionally unavailable to the prebuilt runner: ${managedSensitive.join(", ")}. Runtime readiness is the authoritative post-deploy proof.`);
  }
  if (legalState === "MISSING") {
    console.log("::notice title=Pulsercuit deferred legal configuration::Legal operator identity remains explicitly deferred and does not satisfy public-launch legal approval.");
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const rows = [
      "## Pulsercuit release configuration visibility",
      "",
      "| Configuration group | Runner visibility |",
      "| --- | --- |",
      ...checks.map(([id, state]) => `| ${id} | **${state}** |`),
      `| legal-operator | **${legalDisplay}** |`,
      "",
      "PRESENT means the runner could inspect a non-empty value. SENSITIVE_MANAGED is accepted only for server-side secrets whose values Vercel intentionally withholds from the prebuilt runner. BUILD_VALUE_UNAVAILABLE means a client-visible NEXT_PUBLIC value is hidden from the build and blocks deployment. MISSING also blocks deployment. Runtime readiness remains authoritative for server-secret usability after deployment.",
      "",
    ];
    appendFileSync(summaryPath, `${rows.join("\n")}\n`, "utf8");
  }

  if (blocking.length) process.exitCode = 1;
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  const envPath = process.argv[2];
  if (!envPath) throw new Error("Usage: node scripts/audit-vercel-production-env.mjs <env-file>");
  audit(envPath);
}
