import "server-only";

import {
  faucetPayPayoutEvidenceMatches,
  faucetPayReceiptEvidenceMatches,
  type FaucetPayPaidWithdrawal,
} from "@/lib/faucetpay-receipt-proof";
import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { getCurrentRewardContract } from "@/lib/reward-contract";
import { isCanonicalProductionSiteUrl } from "@/lib/site-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deriveTreasuryDailyFundingState } from "@/lib/treasury";
import { getFaucetPayPackConfig, getFaucetPaySendAuthorityConfig } from "@/providers/faucetpay";

export const CONTROLLED_READINESS_SCHEMA_VERSION = 55;
export const CONTROLLED_READINESS_SCHEMA_MIGRATION = "0055_invite_snapshot_compaction.sql";

export type ControlledTechnicalReadinessState =
  | "SETUP_REQUIRED"
  | "READY_FOR_EXTERNAL_PROOF"
  | "READY";

export type ControlledTechnicalReadiness = {
  state: ControlledTechnicalReadinessState;
  ready: boolean;
  blockingIds: string[];
};

type JsonRecord = Record<string, unknown>;

type SnapshotPaidWithdrawal = FaucetPayPaidWithdrawal & {
  user_id: string;
  ledger_entry_id: string;
  created_at: string;
};

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function configured(...keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function positiveSafeInteger(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function validTimestampOrder(first: unknown, second: unknown) {
  if (typeof first !== "string" || typeof second !== "string") return false;
  const left = Date.parse(first);
  const right = Date.parse(second);
  return Number.isFinite(left) && Number.isFinite(right) && left <= right;
}

function normalizePaidWithdrawal(value: unknown): SnapshotPaidWithdrawal | null {
  const row = objectValue(value);
  const amountCredits = positiveSafeInteger(row.amount_credits);
  const payoutAmountUnits = positiveSafeInteger(row.payout_amount_units);
  const id = typeof row.id === "string" ? row.id : "";
  const userId = typeof row.user_id === "string" ? row.user_id : "";
  const ledgerEntryId = typeof row.ledger_entry_id === "string" ? row.ledger_entry_id : "";
  const createdAt = typeof row.created_at === "string" ? row.created_at : "";
  const idempotencyKey = typeof row.idempotency_key === "string" ? row.idempotency_key.trim() : "";
  const provider = typeof row.payout_provider === "string" ? row.payout_provider.trim().toLowerCase() : "";
  const asset = typeof row.asset === "string" ? row.asset.trim().toUpperCase() : "";
  const destination = typeof row.destination === "string" ? row.destination.trim() : "";
  const externalId = typeof row.external_id === "string" ? row.external_id.trim() : "";
  const status = row.status === "paid" ? "paid" : "";

  if (
    !id
    || !userId
    || !ledgerEntryId
    || !createdAt
    || !idempotencyKey
    || provider !== "faucetpay"
    || !asset
    || !destination
    || !externalId
    || status !== "paid"
    || !amountCredits
    || !payoutAmountUnits
  ) {
    return null;
  }

  return {
    id,
    user_id: userId,
    ledger_entry_id: ledgerEntryId,
    created_at: createdAt,
    idempotency_key: idempotencyKey,
    payout_provider: provider,
    asset,
    destination,
    amount_credits: amountCredits,
    payout_amount_units: payoutAmountUnits,
    external_id: externalId,
    status: "paid",
  };
}

export async function getControlledTechnicalReadiness(): Promise<ControlledTechnicalReadiness> {
  const setupBlockers: string[] = [];
  const proofBlockers: string[] = [];

  if (!isCanonicalProductionSiteUrl()) setupBlockers.push("public-site");
  if (!configured("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    setupBlockers.push("supabase-auth");
  }
  if (!configured("SUPABASE_SERVICE_ROLE_KEY")) setupBlockers.push("service-role");
  if (!configured("TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY")) {
    setupBlockers.push("turnstile-config");
  }

  const payout = getFaucetPayPackConfig();
  const sendAuthority = getFaucetPaySendAuthorityConfig();
  if (!payout.ready) setupBlockers.push("payout-pack");
  if (!sendAuthority.ready) setupBlockers.push("send-authority-config");

  const admin = createSupabaseAdminClient();
  if (!admin) {
    setupBlockers.push("database");
    return {
      state: "SETUP_REQUIRED",
      ready: false,
      blockingIds: setupBlockers,
    };
  }

  const [adminAllowlistResult, snapshotResult, referralIntegrityResult, stackedIncentiveBudgetResult, networkCommissionLaunchResult, cashbackBudgetResult, cashbackIngestionResult, cashbackPublicLaunchResult, variableRewardBudgetResult, variableRewardExecutionResult, variableRewardCadencePolicyResult, pilotBackingSeparationResult, withdrawalPassIntegrityResult, extraWithdrawalLaunchResult, withdrawalRecoveryAuthorityResult, withdrawalRetryBackoffResult, faucetPayWebhookReconciliationResult] = await Promise.all([
    admin.from("admin_users").select("user_id").limit(1).maybeSingle(),
    admin.rpc("controlled_technical_readiness_snapshot"),
    admin.rpc("release_referral_network_integrity_contract"),
    admin.rpc("release_stacked_incentive_budget_contract"),
    admin.rpc("release_network_commission_launch_contract"),
    admin.rpc("release_cashback_budget_contract"),
    admin.rpc("release_cashback_ingestion_contract"),
    admin.rpc("release_cashback_public_launch_contract"),
    admin.rpc("release_variable_reward_budget_contract"),
    admin.rpc("release_variable_reward_execution_contract"),
    admin.rpc("release_variable_reward_cadence_policy_contract"),
    admin.rpc("release_pilot_backing_separation_contract"),
    admin.rpc("release_withdrawal_pass_integrity_contract"),
    admin.rpc("release_extra_withdrawal_launch_contract"),
    admin.rpc("release_withdrawal_recovery_authority_contract"),
    admin.rpc("release_withdrawal_retry_backoff_contract"),
    admin.rpc("release_faucetpay_webhook_reconciliation_contract"),
  ]);

  if (adminAllowlistResult.error || !adminAllowlistResult.data?.user_id) {
    setupBlockers.push("admin-allowlist");
  }

  if (referralIntegrityResult.error || referralIntegrityResult.data !== true) {
    setupBlockers.push("referral-network-integrity");
  }
  if (stackedIncentiveBudgetResult.error || stackedIncentiveBudgetResult.data !== true) {
    setupBlockers.push("stacked-incentive-budget");
  }
  if (networkCommissionLaunchResult.error || networkCommissionLaunchResult.data !== true) {
    setupBlockers.push("network-commission-launch");
  }
  if (cashbackBudgetResult.error || cashbackBudgetResult.data !== true) {
    setupBlockers.push("cashback-budget");
  }
  if (cashbackIngestionResult.error || cashbackIngestionResult.data !== true) {
    setupBlockers.push("cashback-ingestion");
  }
  if (cashbackPublicLaunchResult.error || cashbackPublicLaunchResult.data !== true) {
    setupBlockers.push("cashback-public-launch");
  }
  if (variableRewardBudgetResult.error || variableRewardBudgetResult.data !== true) {
    setupBlockers.push("variable-reward-budget");
  }
  if (variableRewardExecutionResult.error || variableRewardExecutionResult.data !== true) {
    setupBlockers.push("variable-reward-execution");
  }
  if (variableRewardCadencePolicyResult.error || variableRewardCadencePolicyResult.data !== true) {
    setupBlockers.push("variable-reward-cadence-policy");
  }
  if (pilotBackingSeparationResult.error || pilotBackingSeparationResult.data !== true) {
    setupBlockers.push("pilot-backing-separation");
  }
  if (withdrawalPassIntegrityResult.error || withdrawalPassIntegrityResult.data !== true) {
    setupBlockers.push("withdrawal-pass-integrity");
  }
  if (extraWithdrawalLaunchResult.error || extraWithdrawalLaunchResult.data !== true) {
    setupBlockers.push("extra-withdrawal-launch");
  }
  if (withdrawalRecoveryAuthorityResult.error || withdrawalRecoveryAuthorityResult.data !== true) {
    setupBlockers.push("withdrawal-recovery-authority");
  }
  if (withdrawalRetryBackoffResult.error || withdrawalRetryBackoffResult.data !== true) {
    setupBlockers.push("withdrawal-retry-backoff");
  }
  if (faucetPayWebhookReconciliationResult.error || faucetPayWebhookReconciliationResult.data !== true) {
    setupBlockers.push("faucetpay-webhook-reconciliation");
  }

  const { data, error } = snapshotResult;
  if (error || !data) {
    setupBlockers.push("database-snapshot");
    return {
      state: "SETUP_REQUIRED",
      ready: false,
      blockingIds: [...new Set(setupBlockers)],
    };
  }

  const snapshot = objectValue(data);
  const releaseAuthority = objectValue(snapshot.release_authority);
  const hourlyPulse = objectValue(snapshot.hourly_pulse);
  const pulseEconomy = snapshot.pulse_economy;
  const authority = objectValue(snapshot.payout_pack_authority);
  const treasury = objectValue(snapshot.treasury);
  const latestClaim = objectValue(snapshot.latest_claim);
  const chainClaim = objectValue(snapshot.chain_claim);
  const claimLedger = objectValue(snapshot.chain_claim_ledger);
  const withdrawalLedger = objectValue(snapshot.chain_withdrawal_ledger);
  const proof = snapshot.external_proof;

  const schemaVersion = numberValue(snapshot.schema_version);
  const schemaMigration = String(snapshot.schema_migration ?? "");
  const schemaReady = schemaVersion === CONTROLLED_READINESS_SCHEMA_VERSION
    && schemaMigration === CONTROLLED_READINESS_SCHEMA_MIGRATION;
  if (!schemaReady) setupBlockers.push("schema");

  const authorityReady = snapshot.snapshot_authority === true
    && snapshot.authority_runtime_lock === true
    && releaseAuthority.contracts_passed === true
    && numberValue(releaseAuthority.schema_version) === CONTROLLED_READINESS_SCHEMA_VERSION
    && String(releaseAuthority.schema_migration ?? "") === CONTROLLED_READINESS_SCHEMA_MIGRATION;
  if (!authorityReady) setupBlockers.push("release-authority");

  const authorityCredits = positiveSafeInteger(authority.credits);
  const authorityUnits = positiveSafeInteger(authority.units);
  const authorityAsset = typeof authority.asset === "string" ? authority.asset.trim().toUpperCase() : "";
  const payoutPackAuthorityReady = Boolean(
    payout.ready
    && authorityAsset
    && authorityCredits
    && authorityUnits
    && payout.asset === authorityAsset
    && payout.amountCredits === authorityCredits
    && payout.amountSmallestUnits === authorityUnits
  );
  if (!payoutPackAuthorityReady) setupBlockers.push("payout-pack-authority");

  const pilotMode = String(hourlyPulse.pilot_mode ?? "true").toLowerCase() === "true";
  if (!pilotMode && !configured("CASHBACK_CALLBACK_SECRET")) {
    setupBlockers.push("cashback-callback-secret");
  }

  const rewardCredits = positiveSafeInteger(hourlyPulse.credits);
  const intervalMinutes = positiveSafeInteger(hourlyPulse.interval_minutes);
  const treasuryCode = typeof hourlyPulse.treasury_code === "string" ? hourlyPulse.treasury_code.trim() : "";
  const rewardContract = getCurrentRewardContract(rewardCredits ?? 0, pulseEconomy);
  const authorizedRewardCredits = rewardContract.credits;
  const pulseConfigured = Boolean(
    rewardCredits
    && intervalMinutes
    && intervalMinutes >= 15
    && treasuryCode
    && rewardContract.valid
  );
  if (!pulseConfigured) setupBlockers.push("hourly-pulse-config");

  const availableTreasury = numberValue(treasury.funded_credits)
    - numberValue(treasury.reserved_credits)
    - numberValue(treasury.spent_credits);
  const dailyBudgetCredits = numberValue(treasury.daily_budget_credits);
  const maxUserDailyCredits = numberValue(treasury.max_user_daily_credits);
  const dailyClaimCredits = numberValue(snapshot.daily_claim_credits);
  const dailyReservationCredits = numberValue(snapshot.daily_reservation_credits);
  const dailyFundingState = deriveTreasuryDailyFundingState({
    availableCredits: availableTreasury,
    dailyBudgetCredits,
    dailyClaimCredits,
    dailyReservationCredits,
  });
  const treasuryReady = Boolean(
    typeof treasury.id === "string"
    && treasury.code === treasuryCode
    && treasury.enabled === true
    && treasury.kill_switch === false
    && rewardCredits
    && dailyBudgetCredits >= rewardCredits
    && maxUserDailyCredits >= rewardCredits
    && dailyFundingState.availableCredits >= dailyFundingState.remainingDailyBudgetCredits
  );
  if (!treasuryReady) setupBlockers.push("treasury");

  const authHardeningProof = releaseEvidenceMatches(proof, "supabase_auth_hardening");
  const passwordRecoveryProof = releaseEvidenceMatches(proof, "password_recovery");
  const turnstileProof = releaseEvidenceMatches(proof, "turnstile");
  const faucetPayReadProof = releaseEvidenceMatches(proof, "faucetpay_read");
  const faucetPaySendScopeProof = releaseEvidenceMatches(proof, "faucetpay_send_scope");

  if (!authHardeningProof) proofBlockers.push("auth-hardening-proof");
  if (!passwordRecoveryProof) proofBlockers.push("password-recovery-proof");
  if (!turnstileProof) proofBlockers.push("turnstile-proof");
  if (!faucetPayReadProof) proofBlockers.push("faucetpay-read-proof");
  if (!faucetPaySendScopeProof) proofBlockers.push("faucetpay-send-scope-proof");

  const currentPulseProof = Boolean(
    typeof latestClaim.id === "string"
    && latestClaim.treasury_id === treasury.id
    && rewardContract.valid
    && authorizedRewardCredits.includes(numberValue(latestClaim.reward_credits))
    && numberValue(objectValue(latestClaim.metadata).interval_minutes) === intervalMinutes
  );
  if (!currentPulseProof) proofBlockers.push("pulse-proof");

  const payoutWithdrawal = normalizePaidWithdrawal(snapshot.payout_withdrawal);
  const receiptWithdrawal = normalizePaidWithdrawal(snapshot.receipt_withdrawal);
  const payoutProofCurrent = faucetPayPayoutEvidenceMatches(proof, payoutWithdrawal);
  const receiptProofCurrent = Boolean(
    payoutWithdrawal
    && receiptWithdrawal
    && payoutWithdrawal.id === receiptWithdrawal.id
    && payoutProofCurrent
    && faucetPayReceiptEvidenceMatches(proof, receiptWithdrawal)
  );

  if (!payoutProofCurrent) proofBlockers.push("payout-proof");
  if (!receiptProofCurrent) proofBlockers.push("payout-receipt-proof");

  const claimMetadata = objectValue(chainClaim.metadata);
  const claimLedgerMetadata = objectValue(claimLedger.metadata);
  const withdrawalLedgerMetadata = objectValue(withdrawalLedger.metadata);
  const baseLoopContinuity = Boolean(
    payoutWithdrawal
    && receiptWithdrawal
    && payoutWithdrawal.id === receiptWithdrawal.id
    && receiptProofCurrent
    && typeof chainClaim.id === "string"
    && chainClaim.user_id === payoutWithdrawal.user_id
    && chainClaim.treasury_id === treasury.id
    && rewardContract.valid
    && authorizedRewardCredits.includes(numberValue(chainClaim.reward_credits))
    && numberValue(claimMetadata.interval_minutes) === intervalMinutes
    && validTimestampOrder(chainClaim.created_at, payoutWithdrawal.created_at)
    && claimLedger.id === chainClaim.ledger_entry_id
    && claimLedger.user_id === payoutWithdrawal.user_id
    && claimLedger.event_key === `hourly_pulse:${chainClaim.id}`
    && claimLedger.entry_type === "pulse_reward"
    && claimLedger.state === "available"
    && numberValue(claimLedger.credits) === numberValue(chainClaim.reward_credits)
    && claimLedgerMetadata.claim_id === chainClaim.id
    && claimLedgerMetadata.funding_source === "pulse"
    && claimLedgerMetadata.treasury_code === treasuryCode
    && numberValue(claimLedgerMetadata.interval_minutes) === intervalMinutes
    && withdrawalLedger.id === payoutWithdrawal.ledger_entry_id
    && withdrawalLedger.user_id === payoutWithdrawal.user_id
    && withdrawalLedger.event_key === `withdrawal:reserve:${payoutWithdrawal.id}`
    && withdrawalLedger.entry_type === "withdrawal"
    && withdrawalLedger.state === "withdrawn"
    && numberValue(withdrawalLedger.credits) === -payoutWithdrawal.amount_credits
    && withdrawalLedgerMetadata.provider === "faucetpay"
    && withdrawalLedgerMetadata.asset === payoutWithdrawal.asset
    && withdrawalLedgerMetadata.withdrawal_id === payoutWithdrawal.id
    && validTimestampOrder(claimLedger.created_at, withdrawalLedger.created_at)
  );
  if (!baseLoopContinuity) proofBlockers.push("base-loop-continuity");

  if (setupBlockers.length > 0) {
    return {
      state: "SETUP_REQUIRED",
      ready: false,
      blockingIds: [...new Set([...setupBlockers, ...proofBlockers])],
    };
  }

  if (proofBlockers.length > 0) {
    return {
      state: "READY_FOR_EXTERNAL_PROOF",
      ready: false,
      blockingIds: [...new Set(proofBlockers)],
    };
  }

  return {
    state: "READY",
    ready: true,
    blockingIds: [],
  };
}
