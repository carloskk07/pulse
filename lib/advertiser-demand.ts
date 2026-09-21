import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdvertiserDemandStage =
  | "LIVE_INVENTORY"
  | "CAMPAIGN_REVIEW"
  | "FUNDING_READY"
  | "INBOUND_REVIEW"
  | "OUTREACH_ACTIVE"
  | "OUTREACH_READY"
  | "PROSPECT_RESEARCH";

export type AdvertiserDemandSnapshot = {
  available: boolean;
  stage: AdvertiserDemandStage;
  nextAction: string;
  inboundTotal: number;
  inboundNew: number;
  pulseAdsInterest: number;
  directInterest: number;
  prospectsTotal: number;
  prospectsReady: number;
  prospectsContacted: number;
  prospectsReplied: number;
  prospectsPilot: number;
  readyWithPublicEmail: number;
  campaignsPending: number;
  campaignsApproved: number;
  campaignsActive: number;
};

const EMPTY: AdvertiserDemandSnapshot = {
  available: false,
  stage: "PROSPECT_RESEARCH",
  nextAction: "Demand telemetry is unavailable. Do not infer advertiser interest.",
  inboundTotal: 0,
  inboundNew: 0,
  pulseAdsInterest: 0,
  directInterest: 0,
  prospectsTotal: 0,
  prospectsReady: 0,
  prospectsContacted: 0,
  prospectsReplied: 0,
  prospectsPilot: 0,
  readyWithPublicEmail: 0,
  campaignsPending: 0,
  campaignsApproved: 0,
  campaignsActive: 0,
};

function stageFor(input: Omit<AdvertiserDemandSnapshot, "available" | "stage" | "nextAction">) {
  if (input.campaignsPending > 0) {
    return {
      stage: "CAMPAIGN_REVIEW" as const,
      nextAction: "Review pending campaign creative and destination. Do not request funding until review passes.",
    };
  }
  if (input.campaignsApproved > 0) {
    return {
      stage: "FUNDING_READY" as const,
      nextAction: "Close verified funding for approved campaigns. No inventory is live until funding authority confirms it.",
    };
  }
  if (input.inboundNew > 0) {
    return {
      stage: "INBOUND_REVIEW" as const,
      nextAction: "Qualify new inbound advertiser interest and choose Pulse Ads, Pulse Direct or reject the fit.",
    };
  }
  if (input.prospectsReplied > 0 || input.prospectsContacted > 0) {
    return {
      stage: "OUTREACH_ACTIVE" as const,
      nextAction: "Follow the active conversations. Convert one clean reply into a small, verifiable pilot.",
    };
  }
  if (input.prospectsReady > 0) {
    return {
      stage: "OUTREACH_READY" as const,
      nextAction: `Contact the ${input.prospectsReady} ready prospect${input.prospectsReady === 1 ? "" : "s"} before researching more companies.`,
    };
  }
  if (input.campaignsActive > 0) {
    return {
      stage: "LIVE_INVENTORY" as const,
      nextAction: "Measure fill, CTR and support per Pulse before changing pricing or reward economics.",
    };
  }
  return {
    stage: "PROSPECT_RESEARCH" as const,
    nextAction: "Research a small number of high-fit companies with a public business contact and a measurable pilot hypothesis.",
  };
}

export async function getAdvertiserDemandSnapshot(): Promise<AdvertiserDemandSnapshot> {
  const admin = createSupabaseAdminClient();
  if (!admin) return EMPTY;

  const [
    inboundTotal,
    inboundNew,
    pulseAdsInterest,
    directInterest,
    prospectsTotal,
    prospectsReady,
    prospectsContacted,
    prospectsReplied,
    prospectsPilot,
    readyWithPublicEmail,
    campaignsPending,
    campaignsApproved,
    campaignsActive,
  ] = await Promise.all([
    admin.from("business_leads").select("id", { count: "exact", head: true }),
    admin.from("business_leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin.from("business_leads").select("id", { count: "exact", head: true }).eq("product_interest", "pulse_ads"),
    admin.from("business_leads").select("id", { count: "exact", head: true }).eq("product_interest", "pulse_direct"),
    admin.from("advertiser_prospects").select("id", { count: "exact", head: true }),
    admin.from("advertiser_prospects").select("id", { count: "exact", head: true }).eq("status", "ready"),
    admin.from("advertiser_prospects").select("id", { count: "exact", head: true }).eq("status", "contacted"),
    admin.from("advertiser_prospects").select("id", { count: "exact", head: true }).eq("status", "replied"),
    admin.from("advertiser_prospects").select("id", { count: "exact", head: true }).eq("status", "pilot"),
    admin.from("advertiser_prospects")
      .select("id", { count: "exact", head: true })
      .eq("status", "ready")
      .not("public_contact_email", "is", null),
    admin.from("pulse_ads_campaigns").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    admin.from("pulse_ads_campaigns").select("id", { count: "exact", head: true }).eq("status", "approved"),
    admin.from("pulse_ads_campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const results = [
    inboundTotal,inboundNew,pulseAdsInterest,directInterest,prospectsTotal,prospectsReady,
    prospectsContacted,prospectsReplied,prospectsPilot,readyWithPublicEmail,
    campaignsPending,campaignsApproved,campaignsActive,
  ];

  if (results.some((result) => Boolean(result.error))) return EMPTY;

  const core = {
    inboundTotal: Number(inboundTotal.count ?? 0),
    inboundNew: Number(inboundNew.count ?? 0),
    pulseAdsInterest: Number(pulseAdsInterest.count ?? 0),
    directInterest: Number(directInterest.count ?? 0),
    prospectsTotal: Number(prospectsTotal.count ?? 0),
    prospectsReady: Number(prospectsReady.count ?? 0),
    prospectsContacted: Number(prospectsContacted.count ?? 0),
    prospectsReplied: Number(prospectsReplied.count ?? 0),
    prospectsPilot: Number(prospectsPilot.count ?? 0),
    readyWithPublicEmail: Number(readyWithPublicEmail.count ?? 0),
    campaignsPending: Number(campaignsPending.count ?? 0),
    campaignsApproved: Number(campaignsApproved.count ?? 0),
    campaignsActive: Number(campaignsActive.count ?? 0),
  };
  const decision = stageFor(core);

  return {
    available: true,
    ...core,
    ...decision,
  };
}
