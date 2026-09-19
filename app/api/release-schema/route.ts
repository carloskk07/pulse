import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json(
      { service: "pulsercuit", available: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data, error } = await admin
    .from("app_config")
    .select("value,version")
    .eq("key", "release_schema")
    .maybeSingle();

  const marker = objectValue(data?.value);
  const schemaVersion = Number(marker.version ?? data?.version ?? 0);
  const schemaMigration = typeof marker.migration === "string" ? marker.migration : "";
  const available = !error && schemaVersion > 0 && Boolean(schemaMigration);

  return Response.json(
    available
      ? {
          service: "pulsercuit",
          available: true,
          schema_version: schemaVersion,
          schema_migration: schemaMigration,
        }
      : { service: "pulsercuit", available: false },
    {
      status: available ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
