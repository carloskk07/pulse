import { getFaucetPayReceiptProofState } from "@/lib/faucetpay-receipt-proof";
import { getLegalOperatorIdentity } from "@/lib/legal-release";
import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { CANONICAL_SITE_ORIGIN, isCanonicalProductionSiteUrl } from "@/lib/site-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFaucetPayPackConfig, getFaucetPaySendAuthorityConfig } from "@/providers/faucetpay";
import { getPrimaryConfiguredRewardProvider } from "@/providers/registry";

export const RELEASE_SCHEMA_VERSION = 52;
export const RELEASE_SCHEMA_MIGRATION = "0052_controlled_readiness_release_authority.sql";

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
    legalIdentity ? "pass" : "pending",
    legalIdentity
      ? `${legalIdentity.name} is configured for ${legalIdentity.jurisdiction} with formal legal and privacy contact channels.`
      : "Not required for controlled technical readiness. Configure the real operator identity and contact channels before broad public/global launch approval.",
    false,
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

  const faucetPaySendAuthority = getFaucetPaySendAuthorityConfig();
  checks.push(check(
    "faucetpay-send-authority-config",
    "FaucetPay send authority configuration",
    faucetPaySendAuthority.ready ? "pass" : "fail",
    faucetPaySendAuthority.ready
      ? `Read/send credentials are separated and the expected provider daily cap is ${faucetPaySendAuthority.dailyLimitUsd?.toLocaleString("en-US")} USD (${faucetPaySendAuthority.dailyLimitSource === "configured_override" ? "explicit override" : "one payout pack/day safety policy"}).`
      : "Configure distinct read/send credentials and a valid payout pack before attesting send authority.",
  ));

  const admin = createSupabaseAdminClient();
  if (!admin) {
    checks.push(check("database", "Database connectivity", "fail", "Database authority cannot be created until Supabase server configuration is complete."));
    checks.push(check("schema", "Schema version", "fail", `Migration ${RELEASE_SCHEMA_MIGRATION} has not been proven.`));
    checks.push(check("runtime-contracts", "Runtime contracts", "fail", "Economics, referrals, security, authenticated read scopes, withdrawal settlement integrity, controlled withdrawal pilot isolation, exact FaucetPay payout→receipt proof chaining, Treasury reservation lifecycle, exact-gap fully backed Treasury funding authority, fresh external Treasury backing guard, Reward Exchange, Opportunity Intelligence, Pulse Direct, business intake, advertiser outbound and Hourly Pulse pilot isolation contracts cannot be verified without database access."));
    checks.push(check("legal-policy-review", "Qualified legal policy review", "pending", "Public/global governance advisory cannot be verified until database authority is available.", false));
    checks.push(check("international-transfer-review", "International data-transfer review", "pending", "Public/global transfer advisory cannot be verified until database authority is available.", false));
    checks.push(check("supabase-auth-hardening", "Compromised-password protection", "pending", "Application-level breach-protection evidence cannot be verified until database authority is available.", true));
    checks.push(check("password-recovery-proof", "Hosted password recovery proof", "pending", "Real password-recovery evidence cannot be verified until database authority is available.", true));
    checks.push(check("faucetpay-read-proof", "FaucetPay read-only unit proof", "pending", "Live read-only FaucetPay evidence cannot be verified until database authority is available.", true));
    checks.push(check("faucetpay-send-scope-proof", "FaucetPay send-key least privilege", "pending", "Send-key scope attestation cannot be verified until database authority is available.", true));
    checks.push(check("faucetpay-payout-proof", "Exact FaucetPay provider payout", "pending", "Provider payout evidence cannot be verified until database authority is available.", true));
    checks.push(check("faucetpay-receipt-proof", "Actual payout receipt", "pending", "Destination receipt evidence cannot be verified until database authority is available.", true));
    checks.push(check("external-proof", "Core external smoke evidence", "pending", "Core human-verification, payout and actual-receipt evidence is still required after setup.", true));
  } else {
    const { error: connectivityError } = await admin.from("app_config").select("key").limit(1);
    const databaseOk = !connectivityError;
    checks.push(check("database", "Database connectivity", databaseOk ? "pass" : "fail", databaseOk ? "Service-role database access is working." : "The service role could not read the public application schema."));

    if (databaseOk) {
      const { data: runtimeSnapshotData, error: runtimeSnapshotError } = await admin.rpc(
        "release_runtime_contract_snapshot",
      );
      const runtimeSnapshot = objectValue(runtimeSnapshotData);
      const schemaVersion = Number(runtimeSnapshot.schema_version ?? 0);
      const schemaMigration = String(runtimeSnapshot.schema_migration ?? "");
      const schemaOk = !runtimeSnapshotError
        && schemaVersion >= RELEASE_SCHEMA_VERSION
        && schemaMigration === RELEASE_SCHEMA_MIGRATION;
      checks.push(check(
        "schema",
        "Schema version",
        schemaOk ? "pass" : "fail",
        schemaOk
          ? `Database schema marker is v${schemaVersion} (${schemaMigration}).`
          : `Apply migrations through ${RELEASE_SCHEMA_MIGRATION}.`,
      ));

      const securityOk = !runtimeSnapshotError && securityContractPasses(runtimeSnapshot.security);
      const snapshotAuthorityOk = !runtimeSnapshotError && runtimeSnapshot.snapshot_authority === true;
      const authenticatedReadScopeOk = !runtimeSnapshotError && runtimeSnapshot.authenticated_read_scope === true;
      const withdrawalReadOk = !runtimeSnapshotError && runtimeSnapshot.withdrawal_read === true;
      const withdrawalSettlementOk = !runtimeSnapshotError && runtimeSnapshot.withdrawal_settlement === true;
      const withdrawalPilotOk = !runtimeSnapshotError && runtimeSnapshot.withdrawal_pilot === true;
      const faucetPayProofChainOk = !runtimeSnapshotError && runtimeSnapshot.faucetpay_proof_chain === true;
      const rewardExchangeOk = !runtimeSnapshotError && runtimeSnapshot.reward_exchange === true;
      const treasuryFundingOk = !runtimeSnapshotError && runtimeSnapshot.treasury_funding === true;
      const treasuryBackingOk = !runtimeSnapshotError && runtimeSnapshot.treasury_backing === true;
      const opportunityIntelligenceOk = !runtimeSnapshotError && runtimeSnapshot.opportunity_intelligence === true;
      const pulseDirectOk = !runtimeSnapshotError && runtimeSnapshot.pulse_direct === true;
      const businessIntakeOk = !runtimeSnapshotError && runtimeSnapshot.business_intake === true;
      const advertiserOutboundOk = !runtimeSnapshotError && runtimeSnapshot.advertiser_outbound === true;
      const hourlyPilotOk = !runtimeSnapshotError && runtimeSnapshot.hourly_pilot === true;
      const hourlyScaleOk = !runtimeSnapshotError && runtimeSnapshot.hourly_scale === true;
      const userBalanceMaterializationOk = !runtimeSnapshotError && runtimeSnapshot.user_balance_materialization === true;
      const contractsOk = !runtimeSnapshotError
        && snapshotAuthorityOk
        && runtimeSnapshot.economics_ok === true
        && runtimeSnapshot.referral_ok === true
        && securityOk
        && authenticatedReadScopeOk
        && withdrawalReadOk
        && withdrawalSettlementOk
        && withdrawalPilotOk
        && faucetPayProofChainOk
        && rewardExchangeOk
        && treasuryFundingOk
        && treasuryBackingOk
        && opportunityIntelligenceOk
        && pulseDirectOk
        && businessIntakeOk
        && advertiserOutboundOk
        && hourlyPilotOk
        && hourlyScaleOk
        && userBalanceMaterializationOk;
      checks.push(check(
        "runtime-contracts",
        "Runtime contracts",
        contractsOk ? "pass" : "fail",
        contractsOk
          ? "One authoritative snapshot proves economics, referrals, security, authenticated read scopes, Wallet recovery, withdrawal settlement and pilot isolation, exact FaucetPay proof chaining, Treasury funding/backing, Reward Exchange, Opportunity Intelligence, Pulse Direct, business intake, advertiser outbound, Hourly Pulse pilot/scale and materialized balances."
          : "One or more required runtime contracts are missing, have drifted or the consolidated snapshot authority is invalid.",
      ));

      const proofValue = runtimeSnapshot.external_proof;
      const proofError = runtimeSnapshotError;

      const legalPolicyReview = !proofError && releaseEvidenceMatches(proofValue, "legal_policy_review");
      checks.push(check(
        "legal-policy-review",
        "Qualified legal policy review",
        legalPolicyReview ? "pass" : "pending",
        legalPolicyReview
          ? "The current governed Terms, Privacy and Rewards Policy bundle has matching external legal-review evidence for the configured operator identity."
          : "Public/global governance advisory: have qualified counsel review the governed policy revision before broad launch. This does not block controlled faucet technical readiness.",
        false,
      ));

      const transferReview = !proofError && releaseEvidenceMatches(proofValue, "international_transfer_review");
      checks.push(check(
        "international-transfer-review",
        "International data-transfer review",
        transferReview ? "pass" : "pending",
        transferReview
          ? "The current operator, governed policy bundle and configured external-provider set have matching international-transfer review evidence."
          : "Public/global governance advisory: confirm applicable transfer mechanisms and safeguards before broad launch. This does not block controlled faucet technical readiness.",
        false,
      ));

      const authHardeningProof = !proofError && releaseEvidenceMatches(proofValue, "supabase_auth_hardening");
      checks.push(check(
        "supabase-auth-hardening",
        "Compromised-password protection",
        authHardeningProof ? "pass" : "pending",
        authHardeningProof
          ? "Current 12+ character password policy and free HIBP Pwned Passwords k-anonymity screening have matching live evidence."
          : "Verify the built-in HIBP Pwned Passwords screening from the private product cockpit. Supabase Pro is not required for this equivalent application-level control.",
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

      const faucetPaySendScopeProof = !proofError && releaseEvidenceMatches(proofValue, "faucetpay_send_scope");
      checks.push(check(
        "faucetpay-send-scope-proof",
        "FaucetPay send-key least privilege",
        faucetPaySendScopeProof ? "pass" : "pending",
        faucetPaySendScopeProof
          ? "The current send credential and payout pack have fingerprint-bound operator evidence for send-only scope and a provider-side daily payout cap."
          : "Verify the current FaucetPay key in the provider dashboard as send-only, confirm a daily payout cap, and record the fingerprint-bound attestation in the private cockpit.",
        true,
      ));

      const receiptState = await getFaucetPayReceiptProofState(admin, proofValue);
      checks.push(check(
        "faucetpay-payout-proof",
        "Exact FaucetPay provider payout",
        receiptState.payoutProofCurrent ? "pass" : "pending",
        receiptState.payoutProofCurrent
          ? "The current payout configuration is fingerprint-bound to one exact paid FaucetPay withdrawal and provider payout reference."
          : "Complete one controlled FaucetPay payout under the current proven payout authority. Evidence must bind to that exact paid withdrawal.",
        true,
      ));
      checks.push(check(
        "faucetpay-receipt-proof",
        "Actual payout receipt",
        receiptState.receiptProofCurrent ? "pass" : "pending",
        receiptState.receiptProofCurrent
          ? "The same exact payout-bound FaucetPay withdrawal has fingerprint-bound evidence that funds were observed at the actual destination."
          : receiptState.payoutWithdrawal && receiptState.payoutProofCurrent
            ? "Provider-side payout is proven for an exact withdrawal, but receipt at that same destination must still be explicitly verified in the private FaucetPay cockpit."
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
      const faucetPayProof = receiptState.payoutProofCurrent;
      const proofComplete = turnstileProof && faucetPaySendScopeProof && faucetPayProof && receiptState.receiptProofCurrent;
      const missing = [
        !turnstileProof ? "Turnstile" : null,
        !faucetPaySendScopeProof ? "send-only FaucetPay key + daily cap attestation" : null,
        !faucetPayProof ? "exact FaucetPay provider payout" : null,
        !receiptState.receiptProofCurrent ? "same-withdrawal actual payout receipt" : null,
      ].filter(Boolean).join(", ");
      checks.push(check(
        "external-proof",
        "Core external smoke evidence",
        proofComplete ? "pass" : "pending",
        proofComplete ? "Current human-verification evidence and the exact same-withdrawal FaucetPay payout→receipt chain are proven." : `Awaiting current-configuration core evidence: ${missing || "external flows"}.`,
        true,
      ));
    } else {
      checks.push(check("schema", "Schema version", "fail", "Schema version cannot be verified while database access is failing."));
      checks.push(check("runtime-contracts", "Runtime contracts", "fail", "Runtime contracts cannot be verified while database access is failing."));
      checks.push(check("legal-policy-review", "Qualified legal policy review", "pending", "Public/global legal review remains advisory after database recovery.", false));
      checks.push(check("international-transfer-review", "International data-transfer review", "pending", "Public/global transfer review remains advisory after database recovery.", false));
      checks.push(check("supabase-auth-hardening", "Compromised-password protection", "pending", "Application-level breach-protection evidence is still required after database recovery.", true));
      checks.push(check("password-recovery-proof", "Hosted password recovery proof", "pending", "Real password-recovery evidence is still required after database recovery.", true));
      checks.push(check("faucetpay-read-proof", "FaucetPay read-only unit proof", "pending", "Live read-only FaucetPay evidence is still required after database recovery.", true));
      checks.push(check("faucetpay-send-scope-proof", "FaucetPay send-key least privilege", "pending", "Send-key least-privilege evidence is still required after database recovery.", true));
      checks.push(check("faucetpay-payout-proof", "Exact FaucetPay provider payout", "pending", "Provider payout evidence is still required after database recovery.", true));
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
