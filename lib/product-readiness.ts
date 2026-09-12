import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAyetExpectedCurrencyRate } from "@/providers/ayet";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";
import { getPrimaryConfiguredRewardProvider } from "@/providers/registry";

export type ProductReadinessCheck = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

export type ProductReadiness = {
  ready: boolean;
  checks: ProductReadinessCheck[];
  blockers: string[];
  confirmedMonetizationEvents: number;
  paidWithdrawals: number;
};

function configured(...keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

export async function getProductReadiness(): Promise<ProductReadiness> {
  const checks: ProductReadinessCheck[] = [];
  const provider = getPrimaryConfiguredRewardProvider();
  const payout = getFaucetPayPackConfig();
  const expectedAyetRate = provider?.id === "ayet" ? getAyetExpectedCurrencyRate() : null;

  checks.push({
    id: "auth",
    label: "Production authentication",
    pass: configured("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
    detail: "Supabase public auth and trusted server authority must be configured.",
  });
  checks.push({
    id: "turnstile-config",
    label: "Human verification configuration",
    pass: configured("TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
    detail: "Turnstile must be configured for production claims and sensitive actions.",
  });
  checks.push({
    id: "earning-route",
    label: "Real earning route",
    pass: Boolean(provider),
    detail: provider ? `Configured provider: ${provider.id}.` : "At least one real earning provider must be configured.",
  });
  checks.push({
    id: "payout-pack",
    label: "Real payout route",
    pass: payout.ready,
    detail: payout.ready ? `${payout.asset} payout pack is fully configured.` : "FaucetPay key, exact payout units and display pack must all be configured.",
  });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    checks.push({ id: "database", label: "Production database", pass: false, detail: "Trusted database authority is unavailable." });
    return {
      ready: false,
      checks,
      blockers: checks.filter((item) => !item.pass).map((item) => item.label),
      confirmedMonetizationEvents: 0,
      paidWithdrawals: 0,
    };
  }

  const [proofResult, monetizationResult, withdrawalResult] = await Promise.all([
    admin.from("app_config").select("value").eq("key", "release_external_proof").maybeSingle(),
    admin.from("monetization_events").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
    admin.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "paid"),
  ]);

  const proof = proofResult.data?.value;
  const turnstileProof = !proofResult.error && releaseEvidenceMatches(proof, "turnstile");
  const providerTransportProof = provider?.id === "ayet" && !proofResult.error && releaseEvidenceMatches(proof, "ayet_transport");
  const providerProof = Boolean(provider?.evidenceKey) && !proofResult.error && releaseEvidenceMatches(proof, provider!.evidenceKey!);
  const payoutProof = !proofResult.error && releaseEvidenceMatches(proof, "faucetpay_payout");
  const confirmedMonetizationEvents = monetizationResult.error ? 0 : Number(monetizationResult.count ?? 0);
  const paidWithdrawals = withdrawalResult.error ? 0 : Number(withdrawalResult.count ?? 0);

  checks.push({
    id: "turnstile-proof",
    label: "Turnstile production proof",
    pass: turnstileProof,
    detail: turnstileProof ? "Current Turnstile configuration has controlled evidence." : "Current Turnstile configuration still needs controlled proof.",
  });
  checks.push({
    id: "earning-proof",
    label: "Real earning proof",
    pass: providerProof && confirmedMonetizationEvents > 0,
    detail: providerProof && confirmedMonetizationEvents > 0
      ? `${confirmedMonetizationEvents} confirmed monetization event(s) exist with current provider evidence.`
      : providerTransportProof
        ? `ayeT sandbox preflight is proven for the current configuration, including HMAC, adslot binding, ${expectedAyetRate} credits/US$1 rate and exact event-reward alignment. A fresh production conversion must now credit the authoritative ledger.`
        : provider?.id === "ayet"
          ? `Run one ayeT sandbox callback after configuring currency_conversion_rate=${expectedAyetRate} and including currency_amount. It must prove HMAC, adslot, rate and exact event-reward alignment before the first real conversion.`
          : "A real provider callback must credit at least one authoritative monetization event. A non-financial provider preflight may be used first without satisfying PRODUCT_READY.",
  });
  checks.push({
    id: "payout-proof",
    label: "Real payout proof",
    pass: payoutProof && paidWithdrawals > 0,
    detail: payoutProof && paidWithdrawals > 0
      ? `${paidWithdrawals} paid withdrawal(s) exist with current FaucetPay evidence.`
      : "At least one controlled paid withdrawal must complete through the configured payout route.",
  });

  const blockers = checks.filter((item) => !item.pass).map((item) => item.label);
  return {
    ready: blockers.length === 0,
    checks,
    blockers,
    confirmedMonetizationEvents,
    paidWithdrawals,
  };
}
