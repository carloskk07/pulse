import "server-only";

import {
  getControlledTechnicalReadiness,
  type ControlledTechnicalReadiness,
} from "@/lib/controlled-technical-readiness";

export type DeploymentTechnicalReadiness = {
  state: "BLOCKED" | "READY";
  ready: boolean;
  blockingIds: string[];
  deferredOperationalIds: string[];
};

// These states can safely keep the product/reward loop paused while a newer
// application release is promoted. Everything else, including any future
// unknown blocker, remains deployment-blocking by default.
export const DEPLOYMENT_NON_BLOCKING_OPERATIONAL_IDS = new Set([
  "treasury",
  "auth-hardening-proof",
  "password-recovery-proof",
  "turnstile-proof",
  "faucetpay-read-proof",
  "faucetpay-send-scope-proof",
  "pulse-proof",
  "payout-proof",
  "payout-receipt-proof",
  "base-loop-continuity",
]);

export function deriveDeploymentTechnicalReadiness(
  controlled: ControlledTechnicalReadiness,
): DeploymentTechnicalReadiness {
  const blockingIds = controlled.blockingIds.filter(
    (id) => !DEPLOYMENT_NON_BLOCKING_OPERATIONAL_IDS.has(id),
  );
  const deferredOperationalIds = controlled.blockingIds.filter(
    (id) => DEPLOYMENT_NON_BLOCKING_OPERATIONAL_IDS.has(id),
  );

  return {
    state: blockingIds.length === 0 ? "READY" : "BLOCKED",
    ready: blockingIds.length === 0,
    blockingIds,
    deferredOperationalIds,
  };
}

export async function getDeploymentTechnicalReadiness() {
  return deriveDeploymentTechnicalReadiness(
    await getControlledTechnicalReadiness(),
  );
}
