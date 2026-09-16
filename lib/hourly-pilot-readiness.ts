import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const HOURLY_PILOT_SCHEMA_VERSION = 36;

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function getHourlyPilotReadiness() {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, schemaVersion: 0 };

  const [{ data: marker, error: markerError }, contract] = await Promise.all([
    admin.from("app_config").select("value,version").eq("key", "release_schema").maybeSingle(),
    admin.rpc("release_hourly_pulse_pilot_contract"),
  ]);

  const markerValue = objectValue(marker?.value);
  const schemaVersion = Number(markerValue.version ?? marker?.version ?? 0);
  const ok = !markerError
    && !contract.error
    && schemaVersion >= HOURLY_PILOT_SCHEMA_VERSION
    && contract.data === true;

  return { ok, schemaVersion };
}
