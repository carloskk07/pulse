import { getCurrentReleaseReadiness } from "@/lib/current-release-readiness";
import { getHourlyPilotReadiness } from "@/lib/hourly-pilot-readiness";
import { getProductReadiness, hasProductSetupBlocker } from "@/lib/product-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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

  return Response.json(
    {
      service: "pulsercuit",
      version: "0.1.0",
      readiness,
      ready,
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
