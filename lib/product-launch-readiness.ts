import { getProductReadiness } from "@/lib/product-readiness";
import { getReleaseReadiness } from "@/lib/release-readiness";

export async function getProductLaunchReadiness() {
  const [product, release] = await Promise.all([
    getProductReadiness(),
    getReleaseReadiness(),
  ]);

  const releaseBlockers = release.checks.filter(
    (item) => item.blocking && item.status !== "pass",
  );

  return {
    ready: product.ready && release.ready,
    product,
    release,
    releaseBlockers,
  };
}
