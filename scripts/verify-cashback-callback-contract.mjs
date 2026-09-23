import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireAll(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) throw new Error(`${path} missing cashback contract: ${fragment}`);
  }
  return source;
}

function forbidAll(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (source.includes(fragment)) throw new Error(`${path} contains forbidden cashback pattern: ${fragment}`);
  }
}

requireAll("supabase/migrations/0103_cashback_canonical_ingestion.sql", [
  "cashback_tracking_sessions",
  "create_cashback_tracking_session",
  "apply_cashback_attributed_event",
  "source_type='affiliate'",
  "tracking_already_bound",
  "p_commission_usd_micros::numeric * v_share_bps::numeric",
  "/ 10000000::numeric",
  "public.apply_cashback_event",
  "release_cashback_ingestion_contract",
  "Canonical release schema remains v55/0055",
]);

requireAll("supabase/migrations/0104_cashback_public_launch_guard.sql", [
  "cashback_public_launch_requirements_ready",
  "cashback_public_launch_ready",
  "enforce_cashback_public_launch_guard",
  "cashback_public_launch_guard",
  "cashback_public_launch_not_ready",
  "release_cashback_public_launch_contract",
  "source_type='affiliate'",
  "Canonical release schema remains v55/0055",
]);

forbidAll("supabase/migrations/0104_cashback_public_launch_guard.sql", [
  "fund_reward_treasury(",
  "'version', 56",
  "schema_version = 56",
]);

forbidAll("supabase/migrations/0103_cashback_canonical_ingestion.sql", [
  "pilot_mode = false",
  "fund_reward_treasury(",
  "update public.reward_treasuries",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("app/api/cashback/start/route.ts", [
  "export async function POST",
  "isTrustedSameOriginMutation(request)",
  "readUrlEncodedFormWithLimit(request, 1_024)",
  'admin.rpc("create_cashback_tracking_session"',
  "safeDestination",
  'destination.searchParams.set(trackingParam, result.tracking_id!)',
]);

forbidAll("app/api/cashback/start/route.ts", [
  "export async function GET",
  "request.formData()",
]);

requireAll("app/api/cashback/callback/route.ts", [
  "CASHBACK_CALLBACK_SECRET",
  "timingSafeEqual",
  "readRequestTextWithLimit(request, MAX_BODY_BYTES)",
  'request.headers.get("authorization")',
  'admin.rpc("apply_cashback_attributed_event"',
  "tracking_already_bound",
]);

forbidAll("app/api/cashback/callback/route.ts", [
  "request.json()",
  "payload.userId",
  "payload.user_id",
  "p_user_reward_credits",
]);

requireAll("components/cashback-start-button.tsx", [
  'action="/api/cashback/start"',
  'method="post"',
  'name="opportunity"',
]);

requireAll("app/earn/page.tsx", [
  "CashbackStartButton",
  'best?.sourceType === "affiliate"',
  'item.sourceType === "affiliate"',
  "Cashback is not live yet.",
]);

requireAll(".env.example", ["CASHBACK_CALLBACK_SECRET="]);

requireAll("lib/controlled-technical-readiness.ts", [
  'admin.rpc("release_cashback_ingestion_contract")',
  'setupBlockers.push("cashback-ingestion")',
  'admin.rpc("release_cashback_public_launch_contract")',
  'setupBlockers.push("cashback-public-launch")',
  '!pilotMode && !configured("CASHBACK_CALLBACK_SECRET")',
  'setupBlockers.push("cashback-callback-secret")',
]);

console.log("Cashback canonical ingestion contract PASS");
