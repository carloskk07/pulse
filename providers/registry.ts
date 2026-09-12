import { buildAyetOfferwallUrl, isAyetConfigured } from "./ayet";

export type RewardProviderCapability = "offerwall" | "catalog" | "callback" | "surveys" | "direct-campaigns";

export type RewardProviderDefinition = {
  id: string;
  label: string;
  capabilities: RewardProviderCapability[];
  configured: () => boolean;
  evidenceKey?: "ayet_callback";
  buildUserEntryUrl?: (userId: string) => string | null;
};

const providers: RewardProviderDefinition[] = [
  {
    id: "ayet",
    label: "Provider inventory",
    capabilities: ["offerwall", "callback"],
    configured: isAyetConfigured,
    evidenceKey: "ayet_callback",
    buildUserEntryUrl: buildAyetOfferwallUrl,
  },
];

export function getRewardProviders() {
  return providers;
}

export function getConfiguredRewardProviders() {
  return providers.filter((provider) => provider.configured());
}

export function getPrimaryConfiguredRewardProvider() {
  return getConfiguredRewardProviders()[0] ?? null;
}

export function getRewardEntryChannels(userId: string) {
  return getConfiguredRewardProviders().flatMap((provider) => {
    const href = provider.buildUserEntryUrl?.(userId) ?? null;
    if (!href) return [];
    return [{ provider: provider.id, label: provider.label, href, capabilities: provider.capabilities }];
  });
}
