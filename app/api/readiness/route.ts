import { getProductReadiness } from "@/lib/product-readiness";
import { getReleaseReadiness } from "@/lib/release-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [release, product] = await Promise.all([
    getReleaseReadiness(),
    getProductReadiness(),
  ]);

  const ready = release.ready && product.ready;
  const readiness = release.state === "SETUP_REQUIRED"
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
