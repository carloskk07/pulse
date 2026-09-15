import { getFaucetPayReceiptProofState } from "@/lib/faucetpay-receipt-proof";
import { getLegalOperatorIdentity } from "@/lib/legal-release";
import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { CANONICAL_SITE_ORIGIN, isCanonicalProductionSiteUrl } from "@/lib/site-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";
import { getPrimaryConfiguredRewardProvider } from "@/providers/registry";

export const RELEASE_SCHEMA_VERSION = 30;
export const RELEASE_SCHEMA_MIGRATION = "0030_wallet_withdrawal_read_contract.sql";

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
  const siteReady = isCanonicalProductionSiteUrl();

  checks.push(check(
    "public-site",
    "Canonical public origin",
    siteReady ? "pass" : "fail",
    siteReady ? `${CANONICAL_SITE_ORIGIN} is the configured production origin.` : `Set NEXT_PUBLIC_SITE_URL exactly to ${CANONICAL_SITE_ORIGIN}.`,
  ));

  const authConfigured = configured("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  checks.push(check("supabase-auth", "Supabase auth", authConfigured ? "pass" : "fail", authConfigured ? "Public auth configuration is present." : "Supabase URL and anon key are required."));

  const serviceRoleConfigured = configured("SUPABASE_SERVICE_ROLE_KEY");
  checks.push(check("service-role", "Server financial authority", serviceRoleConfigured ? "pass" : "fail", serviceRoleConfigured ? "Service-role authority is available server-side." : "SUPABASE_SERVICE_ROLE_KEY is required for trusted financial writes."));

  const adminsConfigured = configured("ADMIN_EMAILS");
  checks.push(check("admin-allowlist", "Admin allowlist", adminsConfigured ? "pass" : "fail", adminsConfigured ? "Private operations access is allowlisted." : "ADMIN_EMAILS must contain at least one operator email."));

  const turnstileConfigured = configured("TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  checks.push(check("turnstile", "Human verification", turnstileConfigured ? "pass" : "fail", turnstileConfigured ? "Turnstile public and server keys are configured." : "Configure both Turnstile keys before enabling claims, signup and withdrawals."));

  const legalIdentity = getLegalOperatorIdentity();
  checks.push(check(
    "legal-operator",
    "Formal legal operator identity",
    legalIdentity ? "pass" : "fail",
    legalIdentity
      ? `${legalIdentity.name} is configured for ${legalIdentity.jurisdiction} with formal legal and privacy contact channels.`
      : "Configure the real operator name, jurisdiction, formal address, legal contact email and privacy contact email before launch. Do not use placeholders.",
    true,
  ));

  const rewardProvider = getPrimaryConfiguredRewardProvider();
  checks.push(check(
    "reward-provider",
    "Optional Turbo provider",
    "pass",
    rewardProvider
      ? `Optional monetization inventory is configured (${rewardProvider.id}). Its callback proof is tracked separately and does not gate the provider-independent base loop.`
      : "No optional CPA provider is configured. The base Hourly Pulse → ledger → Wallet → FaucetPay loop remains independently releasable.",
    false,
  ));

  const faucetPay = getFaucetPayPackConfig();
  checks.push(check("faucetpay", "FaucetPay payout pack", faucetPay.ready ? "pass" : "fail", faucetPay.ready ? "Scoped payout key and fixed payout pack are configured." : "Configure the scoped key, payout currency, credits, exact provider units and display label."));

  const admin = createSupabaseAdminClient();
  if (!admin) {
    checks.push(check("database", "Database connectivity", "fail", "Database authority cannot be created until Supabase server configuration is complete."));
    checks.push(check("schema", "Schema version", "fail", `Migration ${RELEASE_SCHEMA_MIGRATION} has not been proven.`));
    checks.push(check("runtime-contracts", "Runtime contracts", "fail", "Economics, referrals, Reward Exchange, Opportunity Intelligence, Pulse Direct, business intake and advertiser outbound contracts cannot be verified without database access."));
    checks.push(check("legal-policy-review", "Qualified legal policy review", "pending", "Legal-review evidence cannot be verified until database authority is available.", true));
    checks.push(check("international-transfer-review", "International data-transfer review", "pending", "International-transfer evidence cannot be verified until database authority is available.", true));
    checks.push(check("supabase-auth-hardening", "Supabase Auth leaked-password protection", "pending", "Managed Auth hardening evidence cannot be verified until database authority is available.", true));
    checks.push(check("password-recovery-proof", "Hosted password recovery proof", "pending", "Real password-recovery evidence cannot be verified until database authority is available.", true));
    checks.push(check("faucetpay-read-proof", "FaucetPay read-only unit proof", "pending", "Live read-only FaucetPay evidence cannot be verified until database authority is available.", true));
    checks.push(check("faucetpay-receipt-proof", "Actual payout receipt", "pending", "Destination receipt evidence cannot be verified until database authority is available.", true));
    checks.push(check("external-proof", "Core external smoke evidence", "pending", "Core human-verification, payout and actual-receipt evidence is still required after setup.", true));
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
        businessIntakeContract,
        advertiserOutboundContract,
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
        admin.rpc("release_business_intake_contract"),
        admin.rpc("release_advertiser_outbound_contract"),
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
      const businessIntakeOk = !businessIntakeContract.error && businessIntakeContract.data === true;
      const advertiserOutboundOk = !advertiserOutboundContract.error && advertiserOutboundContract.data === true;
      const contractsOk = !economics.error
        && !referral.error
        && securityOk
        && withdrawalReadOk
        && rewardExchangeOk
        && opportunityIntelligenceOk
        && pulseDirectOk
        && businessIntakeOk
        && advertiserOutboundOk;
      checks.push(check(
        "runtime-contracts",
        "Runtime contracts",
        contractsOk ? "pass" : "fail",
        contractsOk
          ? "Economics, referrals, security, Wallet recovery, Reward Exchange, Opportunity Intelligence, hardened Pulse Direct, business intake and private advertiser outbound contracts are proven."
          : "One or more required runtime or database-access contracts are missing or have drifted.",
      ));

      const proofValue = proofRow?.value;

      const legalPolicyReview = !proofError && releaseEvidenceMatches(proofValue, "legal_policy_review");
      checks.push(check(
        "legal-policy-review",
        "Qualified legal policy review",
        legalPolicyReview ? "pass" : "pending",
        legalPolicyReview
          ? "The current governed Terms, Privacy and Rewards Policy bundle has matching external legal-review evidence for the configured operator identity."
          : "Have qualified counsel review the current governed policy revision for the intended launch jurisdictions, then record evidence against that exact revision and operator identity.",
        true,
      ));

      const transferReview = !proofError && releaseEvidenceMatches(proofValue, "international_transfer_review");
      checks.push(check(
        "international-transfer-review",
        "International data-transfer review",
        transferReview ? "pass" : "pending",
        transferReview
          ? "The current operator, governed policy bundle and configured external-provider set have matching international-transfer review evidence."
          : "Confirm the applicable transfer mechanisms, disclosures and safeguards for the current production provider set, then record evidence against that exact provider set.",
        true,
      ));

      const authHardeningProof = !proofError && releaseEvidenceMatches(proofValue, "supabase_auth_hardening");
      checks.push(check(
        "supabase-auth-hardening",
        "Supabase Auth leaked-password protection",
        authHardeningProof ? "pass" : "pending",
        authHardeningProof
          ? "Current Supabase project has matching external Auth-hardening evidence."
          : "Enable leaked-password protection in managed Supabase Auth, re-run the platform security advisor, then record evidence only after the advisor warning is cleared.",
        true,
      ));

      const passwordRecoveryProof = !proofError && releaseEvidenceMatches(proofValue, "password_recovery");
      checks.push(check(
        "password-recovery-proof",
        "Hosted password recovery proof",
        passwordRecoveryProof ? "pass" : "pending",
        passwordRecoveryProof
          ? "A current hosted recovery flow completed password update and a later successful new-password sign-in for the same user."
          : "Complete a real hosted recovery email, change the password through the recovery session, then sign in with the new password. Evidence is recorded automatically only after that final sign-in.",
        true,
      ));

      const faucetPayReadProof = !proofError && releaseEvidenceMatches(proofValue, "faucetpay_read");
      checks.push(check(
        "faucetpay-read-proof",
        "FaucetPay read-only unit proof",
        faucetPayReadProof ? "pass" : "pending",
        faucetPayReadProof
          ? "Live read-only FaucetPay evidence matches the current read key, asset and fixed payout pack."
          : "Run the private FaucetPay read-only preflight and record proof before enabling payout authority.",
        true,
      ));

      const receiptState = await getFaucetPayReceiptProofState(admin, proofValue);
      checks.push(check(
        "faucetpay-receipt-proof",
        "Actual payout receipt",
        receiptState.receiptProofCurrent ? "pass" : "pending",
        receiptState.receiptProofCurrent
          ? "The current controlled FaucetPay payout has fingerprint-bound evidence that funds were observed at the actual destination."
          : receiptState.withdrawal && receiptState.payoutProofCurrent
            ? "Provider-side payout is proven, but actual receipt at the destination must still be explicitly verified in the private FaucetPay cockpit."
            : "Complete and prove one controlled FaucetPay payout before destination receipt can be verified.",
        true,
      ));

      const providerEvidenceKey = rewardProvider?.evidenceKey;
      if (providerEvidenceKey) {
        const providerProof = !proofError && releaseEvidenceMatches(proofValue, providerEvidenceKey);
        checks.push(check(
          "optional-provider-proof",
          "Optional Turbo provider proof",
          providerProof ? "pass" : "pending",
          providerProof
            ? `Current ${rewardProvider?.id ?? "optional provider"} callback configuration has matching controlled evidence.`
            : `Optional ${rewardProvider?.id ?? "provider"} inventory is configured but its authoritative callback proof is not current. This does not block the base product loop.`,
          false,
        ));
      }

      const turnstileProof = !proofError && releaseEvidenceMatches(proofValue, "turnstile");
      const faucetPayProof = !proofError && releaseEvidenceMatches(proofValue, "faucetpay_payout");
      const proofComplete = turnstileProof && faucetPayProof && receiptState.receiptProofCurrent;
      const missing = [
        !turnstileProof ? "Turnstile" : null,
        !faucetPayProof ? "FaucetPay provider payout" : null,
        !receiptState.receiptProofCurrent ? "actual payout receipt" : null,
      ].filter(Boolean).join(", ");
      checks.push(check(
        "external-proof",
        "Core external smoke evidence",
        proofComplete ? "pass" : "pending",
        proofComplete ? "Current human-verification, provider payout and actual destination-receipt configurations have matching controlled evidence." : `Awaiting current-configuration core evidence: ${missing || "external flows"}.`,
        true,
      ));
    } else {
      checks.push(check("schema", "Schema version", "fail", "Schema version cannot be verified while database access is failing."));
      checks.push(check("runtime-contracts", "Runtime contracts", "fail", "Runtime contracts cannot be verified while database access is failing."));
      checks.push(check("legal-policy-review", "Qualified legal policy review", "pending", "Legal-review evidence is still required after database recovery.", true));
      checks.push(check("international-transfer-review", "International data-transfer review", "pending", "International-transfer review evidence is still required after database recovery.", true));
      checks.push(check("supabase-auth-hardening", "Supabase Auth leaked-password protection", "pending", "Managed Auth hardening evidence is still required after database recovery.", true));
      checks.push(check("password-recovery-proof", "Hosted password recovery proof", "pending", "Real password-recovery evidence is still required after database recovery.", true));
      checks.push(check("faucetpay-read-proof", "FaucetPay read-only unit proof", "pending", "Live read-only FaucetPay evidence is still required after database recovery.", true));
      checks.push(check("faucetpay-receipt-proof", "Actual payout receipt", "pending", "Destination receipt evidence is still required after database recovery.", true));
      checks.push(check("external-proof", "Core external smoke evidence", "pending", "Core human-verification, payout and actual-receipt evidence is still required after database recovery.", true));
    }
  }

  const failed = checks.filter((item) => item.status === "fail" && item.blocking).length;
  const pending = checks.filter((item) => item.status === "pending" && item.blocking).length;
  const passed = checks.filter((item) => item.status === "pass").length;
  const state: ReadinessState = failed > 0 ? "SETUP_REQUIRED" : pending > 0 ? "READY_FOR_EXTERNAL_PROOF" : "READY";

  return { state, ready: state === "READY", passed, failed, pending, checks, generatedAt: new Date().toISOString() };
}
