import { readFileSync } from "node:fs";

const CURRENT_RELEASE_PATH = "lib/current-release-readiness.ts";
const RELEASE_READINESS_PATH = "lib/release-readiness.ts";

export function readExpectedSchema(path = CURRENT_RELEASE_PATH) {
  const source = readFileSync(path, "utf8");
  const versionMatch = source.match(/CURRENT_RELEASE_SCHEMA_VERSION\s*=\s*(\d+)/);
  const migrationMatch = source.match(/CURRENT_RELEASE_SCHEMA_MIGRATION\s*=\s*"([^"]+)"/);

  if (!versionMatch || !migrationMatch) {
    throw new Error(`Unable to resolve current release schema contract from ${path}.`);
  }

  return {
    version: Number(versionMatch[1]),
    migration: migrationMatch[1],
  };
}

export function readBaseExpectedSchema(path = RELEASE_READINESS_PATH) {
  const source = readFileSync(path, "utf8");
  const versionMatch = source.match(/RELEASE_SCHEMA_VERSION\s*=\s*(\d+)/);
  const migrationMatch = source.match(/RELEASE_SCHEMA_MIGRATION\s*=\s*"([^"]+)"/);

  if (!versionMatch || !migrationMatch) {
    throw new Error(`Unable to resolve base release schema contract from ${path}.`);
  }

  return {
    version: Number(versionMatch[1]),
    migration: migrationMatch[1],
  };
}

export function verifySchemaResponse(status, body, expected = readExpectedSchema()) {
  if (status !== 200) {
    throw new Error(`Production schema authority returned HTTP ${status}; expected 200.`);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Production schema authority returned a non-object response.");
  }
  if (body.service !== "pulsercuit" || body.available !== true) {
    throw new Error(`Production schema authority is unavailable or has unexpected identity: ${JSON.stringify(body)}`);
  }

  const actualVersion = Number(body.schema_version ?? 0);
  const actualMigration = typeof body.schema_migration === "string" ? body.schema_migration : "";

  if (actualVersion !== expected.version || actualMigration !== expected.migration) {
    throw new Error(
      `Production database schema is not ready for this release: expected v${expected.version} (${expected.migration}), received v${actualVersion || 0} (${actualMigration || "unknown"}).`,
    );
  }

  return { expected, actual: { version: actualVersion, migration: actualMigration } };
}

function selfTest() {
  const expected = { version: 47, migration: "0047_faucetpay_payout_pack_authority.sql" };
  verifySchemaResponse(200, {
    service: "pulsercuit",
    available: true,
    schema_version: 47,
    schema_migration: "0047_faucetpay_payout_pack_authority.sql",
  }, expected);

  const failures = [
    [503, { service: "pulsercuit", available: false }],
    [200, { service: "other", available: true, schema_version: 47, schema_migration: expected.migration }],
    [200, { service: "pulsercuit", available: true, schema_version: 46, schema_migration: "0046_treasury_backing_freshness.sql" }],
    [200, { service: "pulsercuit", available: true, schema_version: 48, schema_migration: "0048_future.sql" }],
  ];

  for (const [status, body] of failures) {
    let failedClosed = false;
    try {
      verifySchemaResponse(status, body, expected);
    } catch {
      failedClosed = true;
    }
    if (!failedClosed) throw new Error("Production schema gate self-test accepted an invalid authority response.");
  }

  console.log("Production schema gate self-test PASS");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const status = Number(process.argv[2] ?? 0);
  const bodyPath = process.argv[3];
  if (!bodyPath) {
    throw new Error("Usage: node scripts/verify-production-schema-gate.mjs <http-status> <response-file>");
  }

  const current = readExpectedSchema();
  const base = readBaseExpectedSchema();
  if (current.version !== base.version || current.migration !== base.migration) {
    throw new Error(
      `Release schema constants disagree: current v${current.version} (${current.migration}) vs base v${base.version} (${base.migration}).`,
    );
  }

  const body = JSON.parse(readFileSync(bodyPath, "utf8"));
  const result = verifySchemaResponse(status, body, current);
  console.log(
    `Production schema authority PASS: v${result.actual.version} (${result.actual.migration}).`,
  );
}
