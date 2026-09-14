import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

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
  const payout = getFaucetPayPackConfig();

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

  const [proofResult, pulseConfigResult, treasuryResult, pulseClaimResult, monetizationResult, withdrawalResult] = await Promise.all([
    admin.from("app_config").select("value").eq("key", "release_external_proof").maybeSingle(),
    admin.from("app_config").select("value").eq("key", "hourly_pulse").maybeSingle(),
    admin.from("reward_treasuries").select("funded_credits,reserved_credits,spent_credits,daily_budget_credits,max_user_daily_credits,enabled,kill_switch").eq("code", "launch").maybeSingle(),
    admin.from("pulse_claims").select("id", { count: "exact", head: true }),
    admin.from("monetization_events").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
    admin.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "paid"),
  ]);

  const config = pulseConfigResult.data?.value as { credits?: number | string; interval_minutes?: number | string; treasury_code?: string } | null | undefined;
  const rewardCredits = Number(config?.credits ?? 0);
  const intervalMinutes = Number(config?.interval_minutes ?? 0);
  const pulseConfigured = !pulseConfigResult.error && rewardCredits > 0 && intervalMinutes >= 15 && Boolean(config?.treasury_code);

  const treasury = treasuryResult.data;
  const availableTreasury = Number(treasury?.funded_credits ?? 0) - Number(treasury?.reserved_credits ?? 0) - Number(treasury?.spent_credits ?? 0);
  const treasuryReady = !treasuryResult.error && Boolean(
    treasury?.enabled === true &&
    treasury?.kill_switch === false &&
    Number(treasury?.daily_budget_credits ?? 0) > 0 &&
    Number(treasury?.max_user_daily_credits ?? 0) > 0 &&
    availableTreasury >= rewardCredits &&
    rewardCredits > 0
  );

  const proof = proofResult.data?.value;
  const turnstileProof = !proofResult.error && releaseEvidenceMatches(proof, "turnstile");
  const faucetPayReadProof = !proofResult.error && releaseEvidenceMatches(proof, "faucetpay_read");
  const payoutProof = !proofResult.error && releaseEvidenceMatches(proof, "faucetpay_payout");
  const pulseClaims = pulseClaimResult.error ? 0 : Number(pulseClaimResult.count ?? 0);
  const confirmedMonetizationEvents = monetizationResult.error ? 0 : Number(monetizationResult.count ?? 0);
  const paidWithdrawals = withdrawalResult.error ? 0 : Number(withdrawalResult.count ?? 0);

  checks.push({
    id: "hourly-pulse-config",
    label: "Hourly Pulse contract",
    pass: pulseConfigured,
    detail: pulseConfigured ? `${rewardCredits} credit(s) every ${intervalMinutes} rolling minutes.` : "Hourly Pulse needs a positive deterministic reward, rolling interval and treasury binding.",
  });
  checks.push({
    id: "treasury",
    label: "Funded reward treasury",
    pass: treasuryReady,
    detail: treasuryReady ? `${availableTreasury} funded credit(s) remain behind the launch treasury.` : "The launch treasury must contain real funded credits, positive safety limits and an open kill switch before claims are promised.",
  });
  checks.push({
    id: "turnstile-proof",
    label: "Turnstile production proof",
    pass: turnstileProof,
    detail: turnstileProof ? "Current Turnstile configuration has controlled evidence." : "Current Turnstile configuration still needs controlled proof.",
  });
  checks.push({
    id: "faucetpay-read-proof",
    label: "FaucetPay read-only unit proof",
    pass: faucetPayReadProof,
    detail: faucetPayReadProof
      ? "Current FaucetPay asset and payout pack have fingerprint-bound live read-only unit evidence."
      : "The live FaucetPay read-only preflight must prove and record the exact unit scale before payout authority can be considered ready.",
  });
  checks.push({
    id: "pulse-proof",
    label: "Real Hourly Pulse proof",
    pass: pulseClaims > 0,
    detail: pulseClaims > 0 ? `${pulseClaims} treasury-backed Hourly Pulse claim(s) exist in production.` : "At least one real treasury-backed Hourly Pulse claim must complete through the authoritative ledger.",
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
