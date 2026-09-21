import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireAll(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) throw new Error(`${path} missing Pulse Ads contract: ${fragment}`);
  }
  return source;
}

function forbidAll(path, fragments) {
  const source = read(path).toLowerCase();
  for (const fragment of fragments) {
    if (source.includes(fragment.toLowerCase())) {
      throw new Error(`${path} contains forbidden Pulse Ads coupling: ${fragment}`);
    }
  }
}

const migration = requireAll("supabase/migrations/0074_pulse_ads_foundation.sql", [
  "create table if not exists public.pulse_ads_campaigns",
  "create table if not exists public.pulse_ads_funding_events",
  "create table if not exists public.pulse_ads_events",
  "create table if not exists public.pulse_ads_merchant_callbacks",
  "alter table public.pulse_ads_campaigns enable row level security",
  "alter table public.pulse_ads_funding_events enable row level security",
  "alter table public.pulse_ads_events enable row level security",
  "alter table public.pulse_ads_merchant_callbacks enable row level security",
  "revoke all on table public.pulse_ads_campaigns from public, anon, authenticated",
  "grant select, insert, update, delete on table public.pulse_ads_campaigns to service_role",
  "create or replace function public.create_pulse_ads_campaign",
  "create or replace function public.review_pulse_ads_campaign",
  "create or replace function public.record_verified_pulse_ads_payment",
  "create or replace function public.serve_pulse_ad",
  "create or replace function public.click_pulse_ad",
  "security invoker",
  "owner_user_id <> p_user_id",
  "unique (campaign_id, user_id, event_type, event_day)",
  "p_amount_usd_micros <> v_campaign.budget_usd_micros",
  "funded_usd_micros - c.spent_usd_micros >= c.price_per_click_usd_micros",
  "event_type='served'",
  "billed_usd_micros',0",
  "grant execute on function public.click_pulse_ad(uuid,uuid) to service_role",
]);

for (const table of [
  "pulse_ads_campaigns",
  "pulse_ads_funding_events",
  "pulse_ads_events",
  "pulse_ads_merchant_callbacks",
]) {
  if (migration.includes(`grant select on table public.${table} to authenticated`)
    || migration.includes(`grant select on table public.${table} to anon`)) {
    throw new Error(`Pulse Ads table ${table} must remain service-role only.`);
  }
}

forbidAll("supabase/migrations/0074_pulse_ads_foundation.sql", [
  "update public.reward_treasuries",
  "insert into public.pulse_claims",
  "insert into public.ledger_entries",
  "update public.withdrawals",
  "'version', 56",
  "schema_version = 56",
]);

requireAll("app/api/ads/campaigns/route.ts", [
  "export async function POST",
  "isTrustedSameOriginMutation(request)",
  'expectedAction: "pulse_ads_create"',
  "budgetUsd < 5",
  "budgetUsd > 5000",
  "createPulseAdCampaign",
]);
forbidAll("app/api/ads/campaigns/route.ts", ["export async function GET"]);

requireAll("app/api/ads/click/route.ts", [
  "export async function POST",
  "isTrustedSameOriginMutation(request)",
  "clickPulseAd(campaignId, userId)",
  'url.protocol === "https:"',
]);
forbidAll("app/api/ads/click/route.ts", [
  "export async function GET",
  "ledger_entries",
  "pulse_claims",
  "reward_credits",
]);

requireAll("app/api/ads/merchant/callback/route.ts", [
  'createHash("sha256")',
  "pulse_ads_merchant_callbacks",
  "PULSE_ADS_MERCHANT_USERNAME",
  "https://faucetpay.io/merchant/get-payment/",
  "verified.valid === true",
  "verifiedMerchant === merchantUsername",
  'pricingCurrency === "USDT"',
  "callbackTransactionId === verifiedTransactionId",
  "recordVerifiedPulseAdPayment",
]);
forbidAll("app/api/ads/merchant/callback/route.ts", [
  "token: token",
  "raw_token",
  "funded_usd_micros:",
  "update({ funded",
]);

const advertised = requireAll("app/advertise/page.tsx", [
  'action="https://faucetpay.io/merchant/webscr"',
  'name="merchant_username"',
  'name="callback_url"',
  'name="custom"',
  'campaign.status === "approved"',
  "Users are never paid to click".replace("Users", "users"),
]);
if (!advertised.includes("users are never paid to click") && !advertised.includes("Users are never paid to click")) {
  throw new Error("Advertiser surface must state that sponsored clicks are not user rewards.");
}

const claimed = requireAll("app/dashboard/claimed/page.tsx", [
  "getPulseAdPlacement",
  'aria-label="Sponsored placement"',
  'action="/api/ads/click"',
  "Sponsored · Pulse Ads",
  "Advertise here",
]);
const dashboard = read("app/dashboard/page.tsx");
if (dashboard.includes("getPulseAdPlacement") || dashboard.includes("/api/ads/click")) {
  throw new Error("Sponsored monetization must not be inserted before the core faucet claim.");
}

requireAll("app/faucet/page.tsx", [
  'sourceOverride="faucetpay"',
  "launch.publicClaimsOpen",
  "No ad wall before claim",
  "Public claiming stays closed",
]);
requireAll("lib/faucet-launch.ts", [
  "pilotMode",
  "maxUserDailyCredits * 2 <= treasury.dailyBudgetCredits",
  "publicClaimsOpen: !pilotMode && fairShareReady && treasuryReady",
]);
requireAll("lib/marketing-funnel.ts", [
  'MARKETING_EXPERIENCE_VERSION = "faucet-ads-v12"',
  '"faucet_signup"',
  '"faucet_proof"',
]);

console.log("Pulse Ads + faucet-first contract PASS");
