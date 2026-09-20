import {
  getDeploymentTechnicalReadiness,
  type DeploymentTechnicalReadiness,
} from "@/lib/deployment-technical-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READINESS_CACHE_TTL_MS = 3_000;

let cachedReadiness: { value: DeploymentTechnicalReadiness; expiresAt: number } | null = null;
let readinessInFlight: Promise<DeploymentTechnicalReadiness> | null = null;

async function getReadinessSnapshot() {
  const now = Date.now();
  if (cachedReadiness && cachedReadiness.expiresAt > now) {
    return { value: cachedReadiness.value, source: "hit" as const };
  }

  if (readinessInFlight) {
    return { value: await readinessInFlight, source: "coalesced" as const };
  }

  readinessInFlight = getDeploymentTechnicalReadiness();

  try {
    const value = await readinessInFlight;
    cachedReadiness = {
      value,
      expiresAt: Date.now() + READINESS_CACHE_TTL_MS,
    };
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
    console.info("PULSECIRCUIT_DEPLOYMENT_READINESS_BLOCKERS", JSON.stringify({
      blockers: snapshot.value.blockingIds,
    }));
  } else if (snapshot.value.deferredOperationalIds.length > 0) {
    console.info("PULSECIRCUIT_DEPLOYMENT_OPERATIONAL_DEFERRED", JSON.stringify({
      blockers: snapshot.value.deferredOperationalIds,
    }));
  }

  return Response.json(
    {
      service: "pulsercuit",
      version: "0.1.0",
      scope: "deployment-technical",
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
