import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireAll(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(path + " missing advertiser demand contract: " + fragment);
    }
  }
  return source;
}

function forbidAll(path, fragments) {
  const source = read(path).toLowerCase();
  for (const fragment of fragments) {
    if (source.includes(fragment.toLowerCase())) {
      throw new Error(path + " contains forbidden advertiser demand coupling: " + fragment);
    }
  }
}

requireAll("supabase/migrations/0081_advertiser_demand_intake.sql", [
  "product_interest",
  "traffic_5_25",
  "traffic_25_100",
  "website_traffic",
  "next_action_at",
  "operator_note",
  "alter table public.business_leads enable row level security",
].filter(Boolean));

const migration = read("supabase/migrations/0081_advertiser_demand_intake.sql");
if (!migration.includes("release_advertiser_demand_intake_contract")) {
  throw new Error("V13.2 migration must expose a release contract.");
}
forbidAll("supabase/migrations/0081_advertiser_demand_intake.sql", [
  "update public.reward_treasuries",
  "fund_reward_treasury(",
  "pilot_mode = false",
  "insert into public.pulse_ads_campaigns",
  "insert into public.direct_campaigns",
  "'release_schema',",
]);

requireAll("app/api/ads/interest/route.ts", [
  "isTrustedSameOriginMutation(request)",
  'expectedAction: "pulse_ads_interest"',
  'source: "advertise_interest"',
  'product_interest: productInterest',
  "ignoreDuplicates: true",
  'return redirectState(request, "received")',
]);
forbidAll("app/api/ads/interest/route.ts", [
  "createPulseAdCampaign",
  "pulse_ads_campaigns",
  "direct_campaigns",
  "fund_reward_treasury",
]);

requireAll("app/advertise/page.tsx", [
  'action="/api/ads/interest"',
  "Tell us the result you want before creating an account.",
  "No login required.",
  "does not authorize spend or guarantee delivery",
  'action="/api/ads/campaigns"',
  "$0.05 per qualified click",
]);

requireAll("lib/advertiser-demand.ts", [
  '"OUTREACH_READY"',
  '"INBOUND_REVIEW"',
  '"CAMPAIGN_REVIEW"',
  '"FUNDING_READY"',
  '"LIVE_INVENTORY"',
  "Contact the",
  "real campaign states",
].filter(Boolean));

requireAll("app/admin/ads/page.tsx", [
  "getAdvertiserDemandSnapshot",
  "Demand engine",
  "Inbound leads",
  "Outbound prospects",
  "never treats a researched company as interested",
]);

requireAll("app/admin/leads/actions.ts", [
  "requireAdmin",
  "LOCAL_DATETIME_RE",
  "operator_note",
  "next_action_at",
  "revalidatePath",
]);
forbidAll("app/admin/leads/actions.ts", [
  "pulse_ads_campaigns",
  "direct_campaigns",
  "reward_treasuries",
]);

requireAll("lib/outbound-prospects.ts", [
  "buildProspectOutreachHref",
  "publicContactEmail",
  "mailto:",
  "small 25–50 action test",
]);
forbidAll("lib/outbound-prospects.ts", [
  "sendmail",
  "sendemail",
  "resend.",
  "nodemailer",
]);

requireAll("app/admin/prospects/page.tsx", [
  "Open outreach draft",
  "buildProspectOutreachHref",
]);

console.log("Advertiser demand engine V13.2 contract PASS");
