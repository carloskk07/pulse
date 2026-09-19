import { getReleaseReadiness, type ReadinessCheck, type ReadinessState } from "@/lib/release-readiness";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const CURRENT_RELEASE_SCHEMA_VERSION = 52;
export const CURRENT_RELEASE_SCHEMA_MIGRATION = "0052_controlled_readiness_release_authority.sql";

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function getCurrentReleaseReadiness() {
  const base = await getReleaseReadiness();
  const admin = createSupabaseAdminClient();

  let schemaCheck: ReadinessCheck = {
    id: "schema",
    label: "Schema version",
    status: "fail",
    detail: `Migration ${CURRENT_RELEASE_SCHEMA_MIGRATION} has not been proven.`,
    blocking: true,
  };

  if (admin) {
    const { data, error } = await admin
      .from("app_config")
      .select("value,version")
      .eq("key", "release_schema")
      .maybeSingle();

    const marker = objectValue(data?.value);
    const schemaVersion = Number(marker.version ?? data?.version ?? 0);
    const schemaMigration = typeof marker.migration === "string" ? marker.migration : "";
    const current = !error
      && schemaVersion >= CURRENT_RELEASE_SCHEMA_VERSION
      && schemaMigration === CURRENT_RELEASE_SCHEMA_MIGRATION;

    schemaCheck = {
      id: "schema",
      label: "Schema version",
      status: current ? "pass" : "fail",
      detail: current
        ? `Database schema marker is v${schemaVersion} (${schemaMigration}).`
        : `Apply migrations through ${CURRENT_RELEASE_SCHEMA_MIGRATION}; current marker is v${schemaVersion || 0}${schemaMigration ? ` (${schemaMigration})` : ""}.`,
      blocking: true,
    };
  }

  const checks = base.checks.map((item) => item.id === "schema" ? schemaCheck : item);
  const failed = checks.filter((item) => item.status === "fail" && item.blocking).length;
  const pending = checks.filter((item) => item.status === "pending" && item.blocking).length;
  const passed = checks.filter((item) => item.status === "pass").length;
  const state: ReadinessState = failed > 0 ? "SETUP_REQUIRED" : pending > 0 ? "READY_FOR_EXTERNAL_PROOF" : "READY";

  return {
    ...base,
    state,
    ready: state === "READY",
    passed,
    failed,
    pending,
    checks,
    generatedAt: new Date().toISOString(),
  };
}
