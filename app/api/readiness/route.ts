import { getCurrentReleaseReadiness } from "@/lib/current-release-readiness";
import { getHourlyPilotReadiness } from "@/lib/hourly-pilot-readiness";
import { getProductReadiness, hasProductSetupBlocker } from "@/lib/product-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READINESS_CACHE_TTL_MS = 3_000;

type ReadinessPayload = {
  service: "pulsercuit";
  version: "0.1.0";
  scope: "controlled-technical";
  readiness: "SETUP_REQUIRED" | "READY_FOR_EXTERNAL_PROOF" | "READY";
  ready: boolean;
};

type ReadinessResult = {
  body: ReadinessPayload;
  status: 200 | 503;
};

let cachedReadiness: { value: ReadinessResult; expiresAt: number } | null = null;
let readinessInFlight: Promise<ReadinessResult> | null = null;

async function computeReadiness(): Promise<ReadinessResult> {
  const [release, product, hourlyPilot] = await Promise.all([
    getCurrentReleaseReadiness(),
    getProductReadiness(),
    getHourlyPilotReadiness(),
  ]);

  const ready = release.ready && product.ready && hourlyPilot.ok;
  const productSetupBlocked = hasProductSetupBlocker(product);
  const readiness = release.state === "SETUP_REQUIRED" || !hourlyPilot.ok || productSetupBlocked
    ? "SETUP_REQUIRED"
    : ready
      ? "READY"
      : "READY_FOR_EXTERNAL_PROOF";

  if (!ready) {
    const releaseBlockingIds = release.checks
      .filter((item) => item.blocking && item.status !== "pass")
      .map((item) => item.id);
    const publicOnlyProductIds = new Set(["public-access", "public-fair-share"]);
    const productBlockingIds = product.checks
      .filter((item) => !publicOnlyProductIds.has(item.id) && !item.pass)
      .map((item) => item.id);

    console.info("PULSECIRCUIT_READINESS_BLOCKERS", JSON.stringify({
      release: releaseBlockingIds,
      product: productBlockingIds,
      hourlyPilotOk: hourlyPilot.ok,
    }));
  }

  return {
    body: {
      service: "pulsercuit",
      version: "0.1.0",
      scope: "controlled-technical",
      readiness,
      ready,
    },
    status: ready ? 200 : 503,
  };
}

async function getReadinessSnapshot() {
  const now = Date.now();
  if (cachedReadiness && cachedReadiness.expiresAt > now) {
    return { value: cachedReadiness.value, source: "hit" as const };
  }

  if (readinessInFlight) {
    return { value: await readinessInFlight, source: "coalesced" as const };
  }

  const startedAt = Date.now();
  readinessInFlight = computeReadiness();

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

  return Response.json(
    snapshot.value.body,
    {
      status: snapshot.value.status,
      headers: {
        "Cache-Control": "no-store",
        "X-Pulse-Readiness-Cache": snapshot.source,
        "Server-Timing": `readiness;dur=${durationMs}`,
      },
    },
  );
}
