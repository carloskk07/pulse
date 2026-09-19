import { readFileSync, appendFileSync } from "node:fs";

const SENSITIVE = "[SENSITIVE]";
const CREDITS_PER_USD = 1000;

function parseEnv(text) {
  const out = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try { value = JSON.parse(value); } catch { value = value.slice(1, -1); }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    out.set(match[1], String(value));
  }
  return out;
}

function safeValue(values, key) {
  const raw = String(values.get(key) ?? "").trim();
  if (!raw) return { state: "MISSING", value: null };
  if (raw === SENSITIVE) return { state: "SENSITIVE_MANAGED", value: null };
  return { state: "PRESENT", value: raw };
}

function positiveInteger(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function positiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const envPath = process.argv[2];
if (!envPath) throw new Error("Usage: node scripts/report-safe-payout-profile.mjs <env-file>");

const values = parseEnv(readFileSync(envPath, "utf8"));

const asset = safeValue(values, "FAUCETPAY_PAYOUT_CURRENCY");
const credits = safeValue(values, "FAUCETPAY_PAYOUT_CREDITS");
const units = safeValue(values, "FAUCETPAY_PAYOUT_UNITS");
const label = safeValue(values, "FAUCETPAY_PAYOUT_LABEL");
const daily = safeValue(values, "FAUCETPAY_SEND_DAILY_LIMIT_USD");

const creditsInt = credits.value ? positiveInteger(credits.value) : null;
const unitsInt = units.value ? positiveInteger(units.value) : null;
const configuredDaily = daily.value ? positiveNumber(daily.value) : null;
const payoutUsd = creditsInt ? creditsInt / CREDITS_PER_USD : null;
const effectiveDaily = configuredDaily ?? payoutUsd;
const dailySource = configuredDaily ? "configured_override" : payoutUsd ? "one_pack_default" : "unavailable";

const rows = [
  ["asset", asset.state, asset.value],
  ["credits", credits.state, creditsInt],
  ["provider-units", units.state, unitsInt],
  ["label", label.state, label.value],
  ["daily-limit-usd", daily.state, configuredDaily],
  ["effective-one-pack-usd", payoutUsd ? "DERIVED" : "UNAVAILABLE", payoutUsd],
  ["effective-daily-cap-usd", effectiveDaily ? "DERIVED" : "UNAVAILABLE", effectiveDaily],
  ["daily-cap-source", "DERIVED", dailySource],
];

for (const [name, state, value] of rows) {
  const printable = value === null || value === undefined ? "—" : String(value);
  console.log(`Safe payout config ${name}: state=${state} value=${printable}`);
}

const visiblePackReady =
  asset.state === "PRESENT" &&
  creditsInt !== null &&
  unitsInt !== null &&
  label.state === "PRESENT";

console.log(`Safe payout config visible-pack-ready: ${visiblePackReady ? "YES" : "NO"}`);

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) {
  const table = [
    "## Safe payout profile",
    "",
    "This report intentionally excludes FaucetPay credentials and any secret/token value.",
    "",
    "| Field | Visibility | Value |",
    "| --- | --- | --- |",
    ...rows.map(([name, state, value]) => `| ${name} | **${state}** | ${value === null || value === undefined ? "—" : String(value)} |`),
    `| visible-pack-ready | **${visiblePackReady ? "YES" : "NO"}** | — |`,
    "",
  ];
  appendFileSync(summary, table.join("\n") + "\n", "utf8");
}
