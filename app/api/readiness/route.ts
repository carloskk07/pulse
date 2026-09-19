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

  return Response.json(
    {
      service: "pulsercuit",
      version: "0.1.0",
      scope: "controlled-technical",
      readiness,
      ready,
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
