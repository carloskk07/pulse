import { getCurrentReleaseReadiness } from "@/lib/current-release-readiness";
import { getProductReadiness } from "@/lib/product-readiness";

export async function getProductLaunchReadiness() {
  const [product, release] = await Promise.all([
    getProductReadiness(),
    getCurrentReleaseReadiness(),
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
