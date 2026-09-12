export type NormalizedConversion = {
  provider: string;
  externalId: string;
  originalExternalId?: string;
  callbackType: "conversion" | "chargeback";
  userId?: string;
  payoutUsdMicros: number;
  rewardCredits: number;
  status: "confirmed" | "reversed";
  occurredAt: string;
  raw: Record<string, string>;
};

export type NormalizedOpportunity = {
  provider: string;
  externalId: string;
  title: string;
  category: string;
  payoutUsdMicros: number;
  baseRewardCredits: number;
  estimatedMinutes?: number | null;
  completionProbability?: number | null;
  trackingReliability?: number | null;
  payoutReliability?: number | null;
  reversalRate?: number | null;
  countryCodes: string[];
  devicePlatforms: string[];
  metadata?: Record<string, unknown>;
};

export interface MonetizationProvider {
  readonly name: string;
  verifyCallback(request: Request): Promise<boolean>;
  normalizeCallback(request: Request): Promise<NormalizedConversion>;
}

export interface OpportunityProvider {
  readonly name: string;
  listOpportunities(input: {
    userId?: string;
    countryCode?: string;
    devicePlatform?: string;
  }): Promise<NormalizedOpportunity[]>;
}

export type PayoutRequest = {
  userId: string;
  destination: string;
  asset: string;
  amountCredits: number;
  amountSmallestUnits: number;
  idempotencyKey: string;
  ipAddress?: string | null;
};

export interface PayoutProvider {
  readonly name: string;
  validateDestination(destination: string, asset: string): Promise<boolean>;
  send(input: PayoutRequest): Promise<{ externalId: string; status: "submitted" | "paid" }>;
}
