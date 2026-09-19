import {
  getControlledTechnicalReadiness,
  type ControlledTechnicalReadiness,
} from "@/lib/controlled-technical-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READINESS_CACHE_TTL_MS = 3_000;

let cachedReadiness: { value: ControlledTechnicalReadiness; expiresAt: number } | null = null;
let readinessInFlight: Promise<ControlledTechnicalReadiness> | null = null;

async function getReadinessSnapshot() {
  const now = Date.now();
  if (cachedReadiness && cachedReadiness.expiresAt > now) {
    return { value: cachedReadiness.value, source: "hit" as const };
  }

  if (readinessInFlight) {
    return { value: await readinessInFlight, source: "coalesced" as const };
  }

  const startedAt = Date.now();
  readinessInFlight = getControlledTechnicalReadiness();

  try {
    const value = await readinessInFlight;
    cachedReadiness = {
      value,
      expiresAt: Date.now() + READINESS_CACHE_TTL_MS,
    };

    const durationMs = Date.now() - startedAt;
    if (durationMs >= 1_000) {
      console.info("PULSECIRCUIT_READINESS_COMPUTE", JSON.stringify({
        durationMs,
        cacheTtlMs: READINESS_CACHE_TTL_MS,
      }));
    }

    return { value, source: "miss" as const };
  } finally {
    readinessInFlight = null;
  }
}

export async function GET() {
  const startedAt = Date.now();
  const snapshot = await getReadinessSnapshot();
  const durationMs = Date.now() - startedAt;

  if (!snapshot.value.ready) {
    console.info("PULSECIRCUIT_READINESS_BLOCKERS", JSON.stringify({
      state: snapshot.value.state,
      blockers: snapshot.value.blockingIds,
    }));
  }

  return Response.json(
    {
      service: "pulsercuit",
      version: "0.1.0",
      scope: "controlled-technical",
      readiness: snapshot.value.state,
      ready: snapshot.value.ready,
    },
    {
      status: snapshot.value.ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Pulse-Readiness-Cache": snapshot.source,
        "Server-Timing": `readiness;dur=${durationMs}`,
      },
    },
  );
}
