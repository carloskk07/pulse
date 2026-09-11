export type NormalizedConversion = {
  provider: string;
  externalId: string;
  originalExternalId?: string;
  callbackType: "conversion" | "chargeback";
  userId: string;
  payoutUsdMicros: number;
  rewardCredits: number;
  status: "confirmed" | "reversed";
  occurredAt: string;
  raw: Record<string, string>;
};

export interface MonetizationProvider {
  readonly name: string;
  verifyCallback(request: Request): Promise<boolean>;
  normalizeCallback(request: Request): Promise<NormalizedConversion>;
}

export type PayoutRequest = {
  userId: string;
  destination: string;
  asset: string;
  amountCredits: number;
  idempotencyKey: string;
};

export interface PayoutProvider {
  readonly name: string;
  validateDestination(destination: string, asset: string): Promise<boolean>;
  send(input: PayoutRequest): Promise<{ externalId: string; status: "submitted" | "paid" }>;
}
