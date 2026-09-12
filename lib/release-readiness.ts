import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";
import { getPrimaryConfiguredRewardProvider } from "@/providers/registry";

export const RELEASE_SCHEMA_VERSION = 15;
export const RELEASE_SCHEMA_MIGRATION = "0015_pulse_direct_hardening.sql";

export type ReadinessCheckStatus = "pass" | "fail" | "pending";
export type ReadinessState = "SETUP_REQUIRED" | "READY_FOR_EXTERNAL_PROOF" | "READY";

export type ReadinessCheck = {
  id: string;
  label: string;
  status: ReadinessCheckStatus;
  detail: string;
  blocking: boolean;
};

export type ReleaseReadinessReport = {
  state: ReadinessState;
  ready: boolean;
  passed: number;
  failed: number;
  pending: number;
  checks: ReadinessCheck[];
  generatedAt: string;
};

function configured(...keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

function publicSiteReady() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    return url.protocol === "https:" && !local;
  } catch {
    return false;
  }
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function securityContractPasses(value: unknown) {
  const contract = objectValue(value);
  return contract.status === "ok"
    && contract.profiles_rls === true
    && contract.ledger_rls === true
    && contract.claims_rls === true
    && contract.referrals_rls === true
    && contract.withdrawals_rls === true
    && contract.app_config_rls === true
    && contract.anon_app_config_select === false
    && contract.anon_ledger_select === false
    && contract.authenticated_profile_select === true
    && contract.authenticated_ledger_select === true
    && contract.authenticated_claims_select === true
    && contract.authenticated_referrals_select === true
    && contract.authenticated_balance_select === true
    && contract.service_app_config_select === true
    && contract.service_withdrawals_insert === true
    && contract.service_withdrawals_update === true
    && contract.authenticated_claim_rpc_execute === false
    && contract.service_claim_rpc_execute === true
    && contract.claim_security_definer === false
    && contract.callback_security_definer === true;
}

function check(id: string, label: string, status: ReadinessCheckStatus, detail: string, blocking = true): ReadinessCheck {
  return { id, label, status, detail, blocking };
}

export async function getReleaseReadiness(): Promise<ReleaseReadinessReport> {
  const checks: ReadinessCheck[] = [];
  const siteReady = publicSiteReady();

  checks.push(check(
    "public-site",
    "Public HTTPS URL",
    siteReady ? "pass" : "fail",
    siteReady ? "A non-local HTTPS site URL is configured." : "Set NEXT_PUBLIC_SITE_URL to the final HTTPS domain.",
  ));

  const authConfigured = configured("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  checks.push(check("supabase-auth", "Supabase auth", authConfigured ? "pass" : "fail", authConfigured ? "Public auth configuration is present." : "Supabase URL and anon key are required."));

  const serviceRoleConfigured = configured("SUPABASE_SERVICE_ROLE_KEY");
  checks.push(check("service-role", "Server financial authority", serviceRoleConfigured ? "pass" : "fail", serviceRoleConfigured ? "Service-role authority is available server-side." : "SUPABASE_SERVICE_ROLE_KEY is required for trusted financial writes."));

  const adminsConfigured = configured("ADMIN_EMAILS");
  checks.push(check("admin-allowlist", "Admin allowlist", adminsConfigured ? "pass" : "fail", adminsConfigured ? "Private operations access is allowlisted." : "ADMIN_EMAILS must contain at least one operator email."));

  const turnstileConfigured = configured("TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  checks.push(check("turnstile", "Human verification", turnstileConfigured ? "pass" : "fail", turnstileConfigured ? "Turnstile public and server keys are configured." : "Configure both Turnstile keys before enabling claims, signup and withdrawals."));

  const rewardProvider = getPrimaryConfiguredRewardProvider();
  checks.push(check(
    "reward-provider",
    "Reward provider",
    rewardProvider ? "pass" : "fail",
    rewardProvider ? `At least one verified earning route is configured (${rewardProvider.id}).` : "Configure at least one reward provider adapter before exposing payable inventory.",
  ));

  const faucetPay = getFaucetPayPackConfig();
  checks.push(check("faucetpay", "FaucetPay payout pack", faucetPay.ready ? "pass" : "fail", faucetPay.ready ? "Scoped payout key and fixed payout pack are configured." : "Configure the scoped key, payout currency, credits, exact provider units and display label."));

  const admin = createSupabaseAdminClient();
  if (!admin) {
    checks.push(check("database", "Database connectivity", "fail", "Database authority cannot be created until Supabase server configuration is complete."));
    checks.push(check("schema", "Schema version", "fail", `Migration ${RELEASE_SCHEMA_MIGRATION} has not been proven.`));
    checks.push(check("runtime-contracts", "Runtime contracts", "fail", "Economics, referrals, Reward Exchange, Opportunity Intelligence, Pulse Direct and database access contracts cannot be verified without database access."));
    checks.push(check("external-proof", "External smoke evidence", "pending", "Provider smoke evidence is still required after setup.", true));
  } else {
    const { error: connectivityError } = await admin.from("app_config").select("key").limit(1);
    const databaseOk = !connectivityError;
    checks.push(check("database", "Database connectivity", databaseOk ? "pass" : "fail", databaseOk ? "Service-role database access is working." : "The service role could not read the public application schema."));

    if (databaseOk) {
      const [
        { data: marker, error: markerError },
        economics,
        referral,
        securityContract,
        withdrawalReadContract,
        rewardExchangeContract,
        opportunityIntelligenceContract,
        pulseDirectContract,
        { data: proofRow, error: proofError },
      ] = await Promise.all([
        admin.from("app_config").select("value,version").eq("key", "release_schema").maybeSingle(),
        admin.rpc("admin_economics_snapshot", { p_from: "1970-01-01T00:00:00.000Z", p_to: "1970-01-02T00:00:00.000Z" }),
        admin.from("profiles").select("referral_code").limit(1),
        admin.rpc("release_security_contract"),
        admin.rpc("release_withdrawal_read_contract"),
        admin.rpc("release_reward_exchange_contract"),
        admin.rpc("release_opportunity_intelligence_contract"),
        admin.rpc("release_pulse_direct_contract"),
        admin.from("app_config").select("value").eq("key", "release_external_proof").maybeSingle(),
      ]);

      const markerValue = objectValue(marker?.value);
      const schemaVersion = Number(markerValue.version ?? marker?.version ?? 0);
      const schemaOk = !markerError && schemaVersion >= RELEASE_SCHEMA_VERSION;
      checks.push(check("schema", "Schema version", schemaOk ? "pass" : "fail", schemaOk ? `Database schema marker is v${schemaVersion}.` : `Apply migrations through ${RELEASE_SCHEMA_MIGRATION}.`));

      const securityOk = !securityContract.error && securityContractPasses(securityContract.data);
      const withdrawalReadOk = !withdrawalReadContract.error && withdrawalReadContract.data === true;
      const rewardExchangeOk = !rewardExchangeContract.error && rewardExchangeContract.data === true;
      const opportunityIntelligenceOk = !opportunityIntelligenceContract.error && opportunityIntelligenceContract.data === true;
      const pulseDirectOk = !pulseDirectContract.error && pulseDirectContract.data === true;
      const contractsOk = !economics.error && !referral.error && securityOk && withdrawalReadOk && rewardExchangeOk && opportunityIntelligenceOk && pulseDirectOk;
      checks.push(check(
        "runtime-contracts",
        "Runtime contracts",
        contractsOk ? "pass" : "fail",
        contractsOk
          ? "Economics, verified referrals, least-privilege security, Wallet recovery, Reward Exchange, Opportunity Intelligence and hardened prefunded Pulse Direct contracts are proven."
          : "One or more required runtime or database-access contracts are missing or have drifted.",
      ));

      const proofValue = proofRow?.value;
      const turnstileProof = !proofError && releaseEvidenceMatches(proofValue, "turnstile");
      const providerEvidenceKey = rewardProvider?.evidenceKey;
      const providerProof = Boolean(providerEvidenceKey) && !proofError && releaseEvidenceMatches(proofValue, providerEvidenceKey!);
      const faucetPayProof = !proofError && releaseEvidenceMatches(proofValue, "faucetpay_payout");
      const proofComplete = turnstileProof && providerProof && faucetPayProof;
      const missing = [
        !turnstileProof ? "Turnstile" : null,
        !providerProof ? "reward provider callback" : null,
        !faucetPayProof ? "FaucetPay payout" : null,
      ].filter(Boolean).join(", ");
      checks.push(check(
        "external-proof",
        "External smoke evidence",
        proofComplete ? "pass" : "pending",
        proofComplete ? "Current human-verification, earning-provider and payout configurations all have matching controlled smoke evidence." : `Awaiting current-configuration evidence: ${missing || "external flows"}.`,
        true,
      ));
    } else {
      checks.push(check("schema", "Schema version", "fail", "Schema version cannot be verified while database access is failing."));
      checks.push(check("runtime-contracts", "Runtime contracts", "fail", "Runtime contracts cannot be verified while database access is failing."));
      checks.push(check("external-proof", "External smoke evidence", "pending", "Provider smoke evidence is still required after database recovery.", true));
    }
  }

  const failed = checks.filter((item) => item.status === "fail" && item.blocking).length;
  const pending = checks.filter((item) => item.status === "pending" && item.blocking).length;
  const passed = checks.filter((item) => item.status === "pass").length;
  const state: ReadinessState = failed > 0 ? "SETUP_REQUIRED" : pending > 0 ? "READY_FOR_EXTERNAL_PROOF" : "READY";

  return { state, ready: state === "READY", passed, failed, pending, checks, generatedAt: new Date().toISOString() };
}
