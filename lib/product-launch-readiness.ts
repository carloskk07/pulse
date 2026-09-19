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
  const publicGovernanceIds = new Set([
    "legal-operator",
    "legal-policy-review",
    "international-transfer-review",
  ]);
  const governanceAdvisories = release.checks.filter(
    (item) => publicGovernanceIds.has(item.id) && item.status !== "pass",
  );
  const publicAccessBlockers = product.checks.filter(
    (item) => item.id === "public-access" && !item.pass,
  );
  const technicalReady = product.ready && release.ready;
  const publicExpansionBlockers = [...publicAccessBlockers, ...governanceAdvisories];

  return {
    ready: technicalReady,
    technicalReady,
    publicLaunchReady: technicalReady && product.publicReady && governanceAdvisories.length === 0,
    product,
    release,
    releaseBlockers,
    governanceAdvisories,
    publicAccessBlockers,
    publicExpansionBlockers,
  };
}
