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

function runSelfTest() {
  const fixture = parseEnv(`\nPUBLIC=value\nSECRET=[SENSITIVE]\nQUOTED="hello"\nEMPTY=\n`);
  const assertions = [
    [classifyValue(fixture.get("PUBLIC")), "PRESENT", "plain value"],
    [classifyValue(fixture.get("SECRET")), "SENSITIVE_MANAGED", "sensitive placeholder"],
    [classifyValue(fixture.get("EMPTY")), "MISSING", "empty value"],
    [classifyValue(fixture.get("UNKNOWN")), "MISSING", "missing value"],
    [classifyGroup(fixture, ["PUBLIC", "QUOTED"]), "PRESENT", "plain group"],
    [classifyGroup(fixture, ["PUBLIC", "SECRET"]), "SENSITIVE_MANAGED", "managed-sensitive group"],
    [classifyGroup(fixture, ["PUBLIC", "UNKNOWN"]), "MISSING", "missing group"],
  ];

  for (const [actual, expected, label] of assertions) {
    if (actual !== expected) throw new Error(`Env audit self-test failed for ${label}: expected ${expected}, received ${actual}`);
  }
  console.log("Vercel production env audit contract PASS");
}

function audit(envPath) {
  const values = parseEnv(readFileSync(envPath, "utf8"));
  const siteValue = String(values.get("NEXT_PUBLIC_SITE_URL") ?? "").trim().replace(/\/+$/, "");

  const checks = [
    ["public-site", siteValue === CANONICAL_SITE ? "PRESENT" : "MISSING"],
    ["supabase-auth", classifyGroup(values, ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])],
    ["service-role", classifyGroup(values, ["SUPABASE_SERVICE_ROLE_KEY"])],
    ["admin-allowlist", classifyGroup(values, ["ADMIN_EMAILS"])],
    ["turnstile", classifyGroup(values, ["TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"])],
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

  const missing = checks.filter(([, state]) => state === "MISSING").map(([id]) => id);
  const managedSensitive = checks.filter(([, state]) => state === "SENSITIVE_MANAGED").map(([id]) => id);

  if (missing.length) {
    console.log(`::warning title=Pulsercuit release configuration::Missing required technical release configuration groups: ${missing.join(", ")}. Values are intentionally never printed.`);
  }
  if (managedSensitive.length) {
    console.log(`::notice title=Pulsercuit managed sensitive configuration::Sensitive groups are configured in Vercel but their values are intentionally unavailable to the prebuilt runner: ${managedSensitive.join(", ")}. Runtime readiness is the authoritative post-deploy proof.`);
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
      "PRESENT means the runner could inspect a non-empty value. SENSITIVE_MANAGED means Vercel confirmed the variable exists but intentionally returned only its sensitive placeholder. MISSING means no usable configuration entry was observed. Runtime readiness remains authoritative for server-secret usability after deployment.",
      "",
    ];
    appendFileSync(summaryPath, `${rows.join("\n")}\n`, "utf8");
  }

  if (missing.length) process.exitCode = 1;
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  const envPath = process.argv[2];
  if (!envPath) throw new Error("Usage: node scripts/audit-vercel-production-env.mjs <env-file>");
  audit(envPath);
}
