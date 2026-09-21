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

requireAll("supabase/migrations/0075_pulse_ads_callback_durability.sql", [
  "provider_verified_at timestamptz",
  "verified_campaign_id uuid",
  "verified_checkout_reference uuid",
  "verified_amount_usd_micros bigint",
  "verified_pricing_currency text",
  "pulse_ads_merchant_callbacks_provider_proof_check",
]);
forbidAll("supabase/migrations/0075_pulse_ads_callback_durability.sql", [
  "update public.reward_treasuries",
  "insert into public.pulse_claims",
  "insert into public.ledger_entries",
  "update public.withdrawals",
  "update public.app_config",
]);

requireAll("supabase/migrations/0076_pulse_ads_claim_bound_delivery.sql", [
  "pulse_claim_id uuid references public.pulse_claims(id)",
  "pulse_ads_events_claim_type_unique",
  "p_pulse_claim_id uuid",
  "pc.id = p_pulse_claim_id",
  "pc.user_id = p_user_id",
  "status','already_served",
  "grant execute on function public.serve_pulse_ad(uuid,uuid,text,text) to service_role",
]);
forbidAll("supabase/migrations/0076_pulse_ads_claim_bound_delivery.sql", [
  "update public.reward_treasuries",
  "insert into public.pulse_claims",
  "insert into public.ledger_entries",
  "update public.withdrawals",
  "update public.app_config",
]);

requireAll("lib/pulse-receipt.ts", [
  "id: string;",
  '.select("id,created_at,reward_credits")',
  "id: String(data.id)",
]);
requireAll("lib/pulse-ads.ts", [
  "pulseClaimId: string;",
  "p_pulse_claim_id: input.pulseClaimId",
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

requireAll("lib/pulse-ads-checkout.ts", [
  'createHmac("sha256"',
  "timingSafeEqual",
  "PULSE_ADS_CHECKOUT_SECRET",
  "buildPulseAdsCheckoutCustom",
  "verifyPulseAdsCheckoutCustom",
]);

requireAll("next.config.ts", [
  `"form-action 'self' https://faucetpay.io"`,
]);

requireAll("app/api/ads/merchant/callback/route.ts", [
  'createHash("sha256")',
  "pulse_ads_merchant_callbacks",
  "PULSE_ADS_MERCHANT_USERNAME",
  "verifyPulseAdsCheckoutCustom",
  "provider_verified_at",
  "settlePersistedAuthority",
  "verified_amount_usd_micros",
  "provider_verified",
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
  "buildPulseAdsCheckoutCustom",
  'campaign.status === "approved"',
  "Users are never paid to click".replace("Users", "users"),
]);
if (!advertised.includes("users are never paid to click") && !advertised.includes("Users are never paid to click")) {
  throw new Error("Advertiser surface must state that sponsored clicks are not user rewards.");
}

requireAll("app/dashboard/claimed/page.tsx", [
  "getPulseAdPlacement",
  "pulseClaimId: receipt.id",
  'aria-label="Sponsored placement"',
  'action="/api/ads/click"',
  "Sponsored · Pulse Ads",
  "Advertise here",
]);
const dashboard = read("app/dashboard/page.tsx");
if (dashboard.includes("getPulseAdPlacement") || dashboard.includes("/api/ads/click")) {
  throw new Error("Sponsored monetization must not be inserted before the core faucet claim.");
}

requireAll("app/advertising-policy/page.tsx", [
  "Sponsored traffic is not a paid click scheme.",
  "Prohibited campaigns",
  "Invalid activity",
]);

requireAll("app/faucet/page.tsx", [
  '<FunnelBeacon event="home_view" />',
  "launch.publicClaimsOpen",
  "No ad wall before claim",
  "Public claiming stays closed",
]);
requireAll("lib/faucet-launch.ts", [
  "pilotMode",
  "maxUserDailyCredits * 2 <= treasury.dailyBudgetCredits",
  "publicClaimsOpen: !pilotMode && backingReady && fairShareReady && treasuryReady",
]);
requireAll("lib/marketing-funnel.ts", [
  'MARKETING_EXPERIENCE_VERSION = "faucet-ads-v12"',
  '"faucet_signup"',
  '"faucet_proof"',
]);

requireAll("app/admin/page.tsx", [
  "https://pulsercuit.pro/faucet?utm_source=faucetpay&amp;utm_medium=faucet-directory&amp;utm_campaign=listing",
]);

requireAll("lib/faucetpay-listing-readiness.ts", [
  '.eq("status", "paid")',
  '.eq("payout_provider", "faucetpay")',
  "uniqueUsersPaidLast7d >= 5",
  "allTimeUniqueUsersPaid >= 2",
]);
forbidAll("lib/faucetpay-listing-readiness.ts", [
  ".insert(",
  ".update(",
  ".upsert(",
  ".delete(",
]);

console.log("Pulse Ads + faucet-first contract PASS");
