import { getHourlyPilotReadiness } from "@/lib/hourly-pilot-readiness";
import { getProductReadiness } from "@/lib/product-readiness";
import { getReleaseReadiness } from "@/lib/release-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [release, product, hourlyPilot] = await Promise.all([
    getReleaseReadiness(),
    getProductReadiness(),
    getHourlyPilotReadiness(),
  ]);

  const ready = release.ready && product.ready && hourlyPilot.ok;
  const readiness = release.state === "SETUP_REQUIRED" || !hourlyPilot.ok
    ? "SETUP_REQUIRED"
    : ready
      ? "READY"
      : "READY_FOR_EXTERNAL_PROOF";

  return Response.json(
    {
      service: "pulsercircuit",
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
