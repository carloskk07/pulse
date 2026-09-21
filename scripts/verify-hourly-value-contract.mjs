import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireAll(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(path + " missing hourly value contract: " + fragment);
    }
  }
}

function forbidAll(path, fragments) {
  const source = read(path).toLowerCase();
  for (const fragment of fragments) {
    if (source.includes(fragment.toLowerCase())) {
      throw new Error(path + " contains forbidden hourly value coupling: " + fragment);
    }
  }
}

requireAll("supabase/migrations/0080_hourly_value_loop.sql", [
  "create table if not exists public.pulse_value_sessions",
  "pulse_claim_id uuid primary key",
  "sponsored_revenue_usd_micros",
  "direct_revenue_usd_micros",
  "direct_reward_credits",
  "alter table public.pulse_value_sessions enable row level security",
  "zz_pulse_value_session_claim",
  "zz_pulse_value_session_ads",
  "source_pulse_claim_id",
  "attach_direct_session_to_pulse_claim",
  "created_at >= now() - interval '2 hours'",
  "already_attributed",
  "zz_pulse_value_session_direct",
  "admin_hourly_value_snapshot",
  "pulse_support_usd_micros",
  "self_sufficiency_ratio",
  "release_hourly_value_loop_contract",
]);

forbidAll("supabase/migrations/0080_hourly_value_loop.sql", [
  "update public.reward_treasuries",
  "fund_reward_treasury(",
  "pilot_mode = false",
  "variable_reward_enabled', true",
  "insert into public.withdrawals",
]);

requireAll("lib/hourly-value.ts", [
  "admin_hourly_value_snapshot",
  "sponsoredFillRate",
  "monetizedClaimRate",
  "pulseSupportUsdMicros",
  "selfSufficiencyRatio",
]);

requireAll("app/dashboard/claimed/page.tsx", [
  "Earn while you wait",
  '"/earn?claim=" + encodeURIComponent(receipt.id)',
]);

requireAll("app/earn/page.tsx", [
  "source_pulse_claim_id",
  "sourcePulseClaimId",
  "UUID_RE.test(params.claim)",
]);

requireAll("app/api/direct/start/route.ts", [
  "source_pulse_claim_id",
  "cleanSourcePulseClaimId",
  'admin.rpc("attach_direct_session_to_pulse_claim"',
  "Attribution must never block a funded user action.",
]);

requireAll("app/admin/page.tsx", [
  "getHourlyValueSnapshot",
  "Hourly value loop",
  "Sponsored fill",
  "Monetized Pulses",
  "Self-sufficiency",
  "claim-bound evidence",
]);

console.log("Hourly value loop V13.1 contract PASS");
