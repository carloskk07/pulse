import "server-only";

import { getControlledTechnicalReadiness } from "@/lib/controlled-technical-readiness";
import { getProductLaunchReadiness } from "@/lib/product-launch-readiness";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PreflightPayload = {
  ready?: boolean;
  pilot_mode?: boolean;
  already_public?: boolean;
  blockers?: unknown;
};

export type PublicLaunchSwitchState = {
  available: boolean;
  mode: "PILOT" | "READY_TO_OPEN" | "BLOCKED" | "PUBLIC";
  pilotMode: boolean;
  readyToOpen: boolean;
  databaseReady: boolean;
  technicalReady: boolean;
  governanceReady: boolean;
  callbackSecretReady: boolean;
  blockers: string[];
};

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

export async function getPublicLaunchSwitchState(): Promise<PublicLaunchSwitchState> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      available: false,
      mode: "BLOCKED",
      pilotMode: true,
      readyToOpen: false,
      databaseReady: false,
      technicalReady: false,
      governanceReady: false,
      callbackSecretReady: false,
      blockers: ["database"],
    };
  }

  const [preflightResult, controlled, launch] = await Promise.all([
    admin.rpc("public_launch_preflight"),
    getControlledTechnicalReadiness(),
    getProductLaunchReadiness(),
  ]);

  const preflight = preflightResult.data && typeof preflightResult.data === "object" && !Array.isArray(preflightResult.data)
    ? preflightResult.data as PreflightPayload
    : {};
  const pilotMode = preflight.pilot_mode !== false;
  const databaseReady = !preflightResult.error && preflight.ready === true;
  const callbackSecretReady = Boolean(process.env.CASHBACK_CALLBACK_SECRET?.trim());
  const governanceReady = launch.governanceAdvisories.length === 0;
  const nonAccessPublicBlockers = launch.publicProductBlockers.filter((item) => item.id !== "public-access");
  const technicalReady = controlled.ready && launch.technicalReady;

  const blockers = new Set<string>();
  if (preflightResult.error) blockers.add("database-preflight");
  for (const blocker of stringArray(preflight.blockers)) blockers.add(blocker);
  if (!controlled.ready) {
    for (const blocker of controlled.blockingIds) blockers.add(blocker);
  }
  for (const blocker of nonAccessPublicBlockers) blockers.add(blocker.id);
  for (const blocker of launch.governanceAdvisories) blockers.add(blocker.id);
  if (!callbackSecretReady) blockers.add("cashback-callback-secret");

  const readyToOpen = pilotMode
    && databaseReady
    && technicalReady
    && governanceReady
    && nonAccessPublicBlockers.length === 0
    && callbackSecretReady
    && blockers.size === 0;

  return {
    available: true,
    mode: !pilotMode ? "PUBLIC" : readyToOpen ? "READY_TO_OPEN" : "BLOCKED",
    pilotMode,
    readyToOpen,
    databaseReady,
    technicalReady,
    governanceReady,
    callbackSecretReady,
    blockers: [...blockers],
  };
}
