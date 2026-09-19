import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(path, fragments) {
  const value = read(path);
  for (const fragment of fragments) {
    if (!value.includes(fragment)) {
      throw new Error(`${path} is missing required release-safety contract: ${fragment}`);
    }
  }
}

function forbidText(path, fragments) {
  const value = read(path);
  for (const fragment of fragments) {
    if (value.includes(fragment)) {
      throw new Error(`${path} contains forbidden release-safety pattern: ${fragment}`);
    }
  }
}

if (existsSync("lib/mock-data.ts")) {
  throw new Error("Dead fabricated offer fixtures must not ship in lib/mock-data.ts.");
}

requireText("next.config.ts", ["Strict-Transport-Security", "frame-ancestors 'none'", "Permissions-Policy", 'source: "/release.json"', 'value: "no-store, max-age=0"']);
requireText(".github/workflows/vercel-prebuilt.yml", ["Stamp exact release identity", "public/release.json", "process.env.GITHUB_SHA", "Verify exact canonical production release", "release.git_sha !== expectedSha", 'body.scope !== "controlled-technical"', "Controlled technical status"]);
requireText("lib/release-readiness.ts", ['admin.rpc(\n        "release_runtime_contract_snapshot"', "runtimeSnapshot.snapshot_authority === true", "runtimeSnapshot.economics_ok === true", "runtimeSnapshot.referral_ok === true", "runtimeSnapshot.authenticated_read_scope === true", "runtimeSnapshot.withdrawal_settlement === true", "runtimeSnapshot.treasury_backing === true", "runtimeSnapshot.hourly_scale === true", "runtimeSnapshot.user_balance_materialization === true", "runtimeSnapshot.reward_snapshot === true", "getFaucetPaySendAuthorityConfig", '"faucetpay-send-authority-config"', '"faucetpay-send-scope-proof"', 'releaseEvidenceMatches(proofValue, "faucetpay_send_scope")', '"faucetpay-payout-proof"', 'receiptState.payoutProofCurrent', '"legal-operator"', 'legalIdentity ? "pass" : "pending"', 'Not required for controlled technical readiness', 'Public/global governance advisory', '"Compromised-password protection"', 'HIBP Pwned Passwords', 'false,']);
forbidText("lib/release-readiness.ts", [
  'admin.rpc("release_authenticated_read_scope_contract")',
  'admin.rpc("release_withdrawal_read_contract")',
  'admin.rpc("release_withdrawal_settlement_contract")',
  'admin.rpc("release_withdrawal_pilot_contract")',
  'admin.rpc("release_faucetpay_proof_chain_contract")',
  'admin.rpc("release_reward_exchange_contract")',
  'admin.rpc("release_treasury_funding_contract")',
  'admin.rpc("release_treasury_backing_guard_contract")',
  'admin.rpc("release_opportunity_intelligence_contract")',
  'admin.rpc("release_pulse_direct_contract")',
  'admin.rpc("release_business_intake_contract")',
  'admin.rpc("release_advertiser_outbound_contract")',
  'admin.rpc("release_hourly_pulse_pilot_contract")',
  'admin.rpc("release_hourly_pulse_scale_contract")',
  'admin.rpc("release_user_balance_materialization_contract")',
]);
requireText("lib/current-release-readiness.ts", ["CURRENT_RELEASE_SCHEMA_VERSION = 53", 'CURRENT_RELEASE_SCHEMA_MIGRATION = "0053_compact_reward_snapshot.sql"', "getCurrentReleaseReadiness", "schemaMigration === CURRENT_RELEASE_SCHEMA_MIGRATION", 'item.id === "schema" ? schemaCheck : item', 'state === "READY"']);
requireText("lib/product-launch-readiness.ts", ["getCurrentReleaseReadiness", "releaseBlockers", "governanceAdvisories", "publicProductBlockers", "publicAccessBlockers", "publicExpansionBlockers", 'new Set(["public-access", "public-fair-share"])', "technicalReady", "publicLaunchReady", "product.publicReady"]);
requireText("lib/product-readiness.ts", ["PRODUCT_SETUP_CHECK_IDS", '"payout-pack-authority"', "getCanonicalFaucetPayPackAuthority", '"send-authority-config"', '"hourly-pulse-config"', '"public-access"', '"public-fair-share"', '"treasury"', "getFaucetPaySendAuthorityConfig", "deriveTreasuryDailyFundingState", '"faucetpay-send-scope-proof"', 'releaseEvidenceMatches(proof, "faucetpay_send_scope")', "hasProductSetupBlocker", "!item.pass", "dailyBudgetCredits >= rewardCredits", "maxUserDailyCredits >= rewardCredits", "maxUserDailyCredits * 2 <= dailyBudgetCredits", "utcTodayStart.setUTCHours(0, 0, 0, 0)", '.gte("created_at", utcTodayStartIso)', '.in("status", ["reserved", "consumed"])', "dailyFundingState.dailyCommittedCredits", "dailyFundingState.remainingDailyBudgetCredits", "dailyFundingState.availableCredits >= remainingDailyBudget", "current UTC day's remaining", "config?.pilot_mode === false", "does not block technical readiness", "publicReady", "publicBlockers", 'new Set(["public-access", "public-fair-share"])']);
requireText("lib/treasury.ts", ["deriveTreasuryDailyFundingState", "getTreasuryDailyFundingState", "remainingDailyBudgetCredits", "fundingGapCredits", "utcTodayStart.setUTCHours(0, 0, 0, 0)", '.in("status", ["reserved", "consumed"])']);
forbidText("lib/product-readiness.ts", ["availableTreasury >= rewardCredits", "availableTreasury >= dailyBudgetCredits", "covering at least one full"]);
requireText("lib/hourly-pilot-readiness.ts", ["HOURLY_PILOT_SCHEMA_VERSION = 36", 'admin.rpc("release_hourly_pulse_pilot_contract")', "schemaVersion >= HOURLY_PILOT_SCHEMA_VERSION"]);
requireText("app/api/readiness/route.ts", ["getControlledTechnicalReadiness", 'service: "pulsercuit"', 'scope: "controlled-technical"', '"PULSECIRCUIT_READINESS_BLOCKERS"', "blockingIds", "READINESS_CACHE_TTL_MS = 3_000", "cachedReadiness", "readinessInFlight", 'source: "coalesced"', '"X-Pulse-Readiness-Cache"', '"Cache-Control": "no-store"']);
forbidText("app/api/readiness/route.ts", ["getCurrentReleaseReadiness", "getProductReadiness", "getHourlyPilotReadiness", "hasProductSetupBlocker"]);
requireText("lib/controlled-technical-readiness.ts", [
  'admin.rpc("controlled_technical_readiness_snapshot")',
  "CONTROLLED_READINESS_SCHEMA_VERSION = 53",
  'CONTROLLED_READINESS_SCHEMA_MIGRATION = "0053_compact_reward_snapshot.sql"',
  "snapshot.authority_runtime_lock === true",
  "releaseAuthority.contracts_passed === true",
  "numberValue(releaseAuthority.schema_version) === CONTROLLED_READINESS_SCHEMA_VERSION",
  '"release-authority"',
  'releaseEvidenceMatches(proof, "supabase_auth_hardening")',
  'releaseEvidenceMatches(proof, "password_recovery")',
  'releaseEvidenceMatches(proof, "turnstile")',
  'releaseEvidenceMatches(proof, "faucetpay_read")',
  'releaseEvidenceMatches(proof, "faucetpay_send_scope")',
  "faucetPayPayoutEvidenceMatches",
  "faucetPayReceiptEvidenceMatches",
  "deriveTreasuryDailyFundingState",
  "payout-pack-authority",
  "base-loop-continuity",
  'state: "SETUP_REQUIRED"',
  'state: "READY_FOR_EXTERNAL_PROOF"',
  'state: "READY"'
]);
forbidText("lib/controlled-technical-readiness.ts", ["runtimeContractsPass", "securityContractPasses", "runtime.external_proof"]);
forbidText("app/api/readiness/route.ts", ["item.detail", "fingerprint"]);
requireText("app/api/release-schema/route.ts", ['.from("app_config")', '.eq("key", "release_schema")', '"Cache-Control": "no-store"', 'schema_version: schemaVersion', 'schema_migration: schemaMigration', 'service: "pulsercuit"', 'available: true']);
forbidText("app/api/release-schema/route.ts", ["process.env", "release_external_proof", "faucetpay", "treasury", "profiles", "withdrawals", "ledger_entries"]);
requireText("app/api/pulse/claim/route.ts", ["claimReceiptRedirect", "ensureFreshTreasuryBacking", '"launch"', "pulse_backing_guard:", "PULSECIRCUIT_POST_CLAIM_RETENTION_FAILED", "PULSECIRCUIT_POST_CLAIM_REVALIDATION_FAILED", "PULSECIRCUIT_POST_CLAIM_COOKIE_CLEAR_FAILED", "try {", "catch {", 'new URL("/dashboard/claimed", request.url)', 'result.status === "claimed"']);
requireText("lib/treasury-backing.ts", ["hasCurrentFaucetPayReadProof", "getCanonicalFaucetPayPackAuthority", "hasCanonicalFaucetPayPackAuthority", '.from("faucetpay_payout_pack_authority")', '.eq("singleton", true)', "payoutMatchesAuthority", "getFaucetPayBalanceReadOnly", "treasury_backing_guard", "record_treasury_backing_observation", "p_observed_balance_units", "pack_authority_mismatch", "backing_refresh_required", "backing_insufficient", "read_proof_required", "ensureFreshTreasuryBacking"]);
forbidText("lib/treasury-backing.ts", ["p_backing_asset", "p_payout_pack_credits", "p_payout_pack_units", '.eq("key", "faucetpay_payout_pack_authority")']);
{
  const source = read("lib/treasury-backing.ts");
  const ensureStart = source.indexOf("export async function ensureFreshTreasuryBacking");
  const proofCheck = source.indexOf("hasCurrentFaucetPayReadProof(admin)", ensureStart);
  const guardCheck = source.indexOf("getTreasuryBackingGuard(treasuryCode, admin)", ensureStart);
  if (ensureStart < 0 || proofCheck < ensureStart || guardCheck < ensureStart || proofCheck > guardCheck) {
    throw new Error("Treasury backing TTL reuse must validate the current FaucetPay read proof before accepting a cached observation.");
  }
}
forbidText("app/api/pulse/claim/route.ts", ["console.warn(userId", "console.warn(reminderId"]);
requireText("supabase/migrations/0031_current_hourly_claim_security_contract.sql", ["claim_hourly_pulse(uuid) security invoker", "claim_hourly_pulse(uuid)', 'EXECUTE'", "release_security_contract"]);
requireText("supabase/migrations/0032_authenticated_read_scope_contract.sql", ["release_authenticated_read_scope_contract", "security_invoker=true", "risk_score", "role_table_grants"]);
requireText("supabase/migrations/0033_treasury_reservation_expiry.sql", ["release_expired_treasury_reservations", "status = 'expired'", "expires_at <= now()", "perform public.release_expired_treasury_reservations(v_treasury_id)", "release_reward_exchange_contract", "version', 33"]);
requireText("supabase/migrations/0034_treasury_idempotency_expiry.sql", ["v_existing.status = 'reserved' and v_existing.expires_at <= now()", "perform public.release_expired_treasury_reservations(v_existing.treasury_id)", "reservation_status", "version', 34"]);
requireText("supabase/migrations/0035_direct_event_temporal_integrity.sql", ["invalid_occurred_at", "v_session.created_at - interval '5 minutes'", "v_session.expires_at + interval '5 minutes'", "v_effective_occurred_at", "release_pulse_direct_contract", "version', 35"]);
requireText("supabase/migrations/0036_hourly_pulse_pilot_isolation.sql", ["pilot_mode", "pilot_user_ids", "pilot_restricted", "release_hourly_pulse_pilot_contract", "version', 36"]);
requireText("supabase/migrations/0037_password_recovery_proof_authority.sql", ["password_updated_at", "delete from public.auth_recovery_proof_challenges", "auth_recovery_proof_password_update_order", "version', 37"]);
requireText("supabase/migrations/0038_withdrawal_settlement_integrity.sql", ["withdrawals_paid_external_id_check", "withdrawals_paid_provider_external_id_uidx", "enforce_withdrawal_paid_terminal", "withdrawals_paid_terminal_guard", "invalid_external_id", "release_withdrawal_settlement_contract", "withdrawals_idempotency_key_key", "withdrawals_one_active_per_user_idx", "service_role", "version', 38"]);
requireText("supabase/migrations/0039_faucetpay_proof_chain.sql", ["record_faucetpay_payout_evidence", "record_faucetpay_receipt_evidence", "faucetpay_payout,withdrawal_id", "idempotency_key", "Legacy unbound FaucetPay payout/receipt evidence invalidated", "release_faucetpay_proof_chain_contract", "version', 39"]);
requireText("supabase/migrations/0040_withdrawal_dispatch_lease.sql", ["dispatch_claimed_at", "dispatch_attempts", "withdrawals_dispatch_attempts_check", "claim_withdrawal_dispatch", "for update", "'dispatch', true", "p_retry_after_seconds", "service_role", "version', 40"]);
requireText("supabase/migrations/0041_faucetpay_send_scope_evidence.sql", ["faucetpay_send_scope", "record_release_evidence", "service_role", "version', 41"]);
requireText("supabase/migrations/0042_withdrawal_pilot_isolation.sql", ["withdrawal_pilot_allowed", "pilot_mode", "pilot_user_ids", "pilot_restricted", "reserve_withdrawal", "claim_withdrawal_dispatch", "release_withdrawal_pilot_contract", "security invoker", "service_role", "version', 42"]);
requireText("supabase/migrations/0043_treasury_funding_authority.sql", ["treasury_funding_events", "fund_reward_treasury", "security invoker", "idempotency_key", "backing_balance_units", "liability_credits", "backing_required_units", "release_treasury_funding_contract", "service_role", "version', 43"]);
requireText("supabase/migrations/0044_treasury_liability_backing.sql", ["user_balance_liability_credits", "active_withdrawal_liability_credits", "active_reservation_liability_credits", "public.user_balances", "status in ('requested', 'held', 'submitted')", "status = 'reserved'", "liability_changed", "p_liability_credits <> v_liability_credits", "release_treasury_funding_contract", "version', 44"]);
requireText("supabase/migrations/0045_treasury_exact_gap_backing.sql", ["available_credits_before", "available_credits_after", "remaining_daily_budget_credits", "total_backed_exposure_credits", "treasury_funding_events_actor_user_idx", "v_top_up_credits", "funding_gap_changed", "already_sufficient", "v_total_exposure_credits := v_liability_credits + v_available_after", "status in ('reserved', 'consumed')", "p_amount_credits <> v_top_up_credits", "release_treasury_funding_contract", "version', 45"]);
requireText("supabase/migrations/0046_treasury_backing_freshness.sql", ["treasury_backing_observations", "max_age_seconds', 900", "record_treasury_backing_observation", "treasury_backing_guard", "backing_refresh_required", "backing_insufficient", "read_proof_fingerprint", "observed_balance_units < v_required_units", "pulse_claim_backing_guard", "pulse_backing_guard", "release_treasury_backing_guard_contract", "security invoker", "service_role", "version', 46"]);
requireText("supabase/migrations/0047_faucetpay_payout_pack_authority.sql", ["create table if not exists public.faucetpay_payout_pack_authority", "values (true, 'USDT', 10, 1000000, 1)", "delete from public.app_config", "where key = 'faucetpay_payout_pack_authority'", "revoke all on table public.faucetpay_payout_pack_authority", "from public, anon, authenticated, service_role", "grant select on table public.faucetpay_payout_pack_authority", "not has_table_privilege('service_role', 'public.faucetpay_payout_pack_authority', 'INSERT')", "not has_table_privilege('service_role', 'public.faucetpay_payout_pack_authority', 'UPDATE')", "not has_table_privilege('service_role', 'public.faucetpay_payout_pack_authority', 'DELETE')", "not has_table_privilege('service_role', 'public.faucetpay_payout_pack_authority', 'TRUNCATE')", "not exists (", "record_treasury_backing_observation(text,bigint)", "record_treasury_backing_observation(text,text,bigint,bigint,bigint)') is null", "v_pack_credits", "v_pack_units", "v_observation.payout_pack_credits <> v_pack_credits", "v_observation.payout_pack_units <> v_pack_units", "release_treasury_backing_guard_contract", "version', 47"]);
requireText("supabase/migrations/0048_hourly_pulse_claim_concurrency.sql", ["pulse_claims_treasury_created_idx", "include (reward_credits, user_id)", "treasury_reservations_expiry_idx", "SCALE_V48_GLOBAL_CRITICAL_SECTION", "pulse_claim_abort:daily_budget_exhausted", "pulse_claim_abort:user_daily_limit", "release_hourly_pulse_scale_contract", "security invoker", "service_role", "version', 48"]);
requireText("supabase/migrations/0049_user_balance_materialization.sql", [
  "create table if not exists public.user_balance_state",
  "alter table public.user_balance_state enable row level security",
  'create policy "user_balance_state_read_own"',
  "sync_user_balance_state_from_ledger",
  "security definer",
  "ledger_user_balance_state_sync",
  "lock table public.ledger_entries in share row exclusive mode",
  "truncate table public.user_balance_state",
  "user_balance_state_backfill_mismatch",
  "with (security_invoker = true)",
  "release_user_balance_materialization_contract",
  "not has_table_privilege('service_role', 'public.user_balance_state', 'INSERT')",
  "not has_table_privilege('service_role', 'public.user_balance_state', 'UPDATE')",
  "not has_table_privilege('service_role', 'public.user_balance_state', 'DELETE')",
  "version', 49"
]);
{
  const source = read("supabase/migrations/0049_user_balance_materialization.sql");
  const lockLedger = source.indexOf("lock table public.ledger_entries in share row exclusive mode");
  const truncateState = source.indexOf("truncate table public.user_balance_state", lockLedger);
  const backfill = source.indexOf("insert into public.user_balance_state", truncateState);
  const createTrigger = source.indexOf("create trigger ledger_user_balance_state_sync", backfill);
  const replaceView = source.indexOf("create or replace view public.user_balances", createTrigger);
  const verifyBackfill = source.indexOf("user_balance_state_backfill_mismatch", replaceView);
  if (
    lockLedger < 0
    || truncateState < 0
    || backfill < 0
    || createTrigger < 0
    || replaceView < 0
    || verifyBackfill < 0
    || lockLedger > truncateState
    || truncateState > backfill
    || backfill > createTrigger
    || createTrigger > replaceView
    || replaceView > verifyBackfill
  ) {
    throw new Error("v49 must lock ledger writes, truncate/rebuild exact state, attach trigger, replace the view, then verify equivalence.");
  }
}
{
  const source = read("supabase/migrations/0048_hourly_pulse_claim_concurrency.sql");
  const claimInsert = source.indexOf("insert into public.pulse_claims");
  const trustRefresh = source.indexOf("v_trust := public.refresh_pulse_trust(p_user_id);");
  const criticalMarker = source.indexOf("-- SCALE_V48_GLOBAL_CRITICAL_SECTION");
  const treasuryLock = source.indexOf("for update;", criticalMarker);
  const treasurySpend = source.indexOf("spent_credits = spent_credits + v_reward", criticalMarker);
  const criticalEnd = source.indexOf("-- SCALE_V48_GLOBAL_CRITICAL_SECTION_END", criticalMarker);
  if (
    claimInsert < 0
    || trustRefresh < 0
    || criticalMarker < 0
    || treasuryLock < 0
    || treasurySpend < 0
    || criticalEnd < 0
    || claimInsert > trustRefresh
    || trustRefresh > criticalMarker
    || criticalMarker > treasuryLock
    || treasuryLock > treasurySpend
    || treasurySpend > criticalEnd
  ) {
    throw new Error("v48 must keep claim/backing/trust work before the short serialized Treasury close.");
  }
}
requireText("lib/release-evidence.ts", ["FAUCETPAY_SEND_SCOPE_PROOF_SCHEMA", '"faucetpay_send_scope"', "getFaucetPaySendAuthorityConfig", "sendAuthority.dailyLimitUsd", "sendAuthority.dailyLimitSource", '"scope:send-only"', '"daily-cap:exact-value-operator-verified"', "GenericRecordableReleaseEvidenceKind", 'Exclude<ReleaseEvidenceKind, "faucetpay_payout">', "recordReleaseEvidence(kind: GenericRecordableReleaseEvidenceKind)", 'PASSWORD_RECOVERY_PROOF_SCHEMA = "password-recovery-proof-v2"', "PASSWORD_RECOVERY_MAX_AGE_SECONDS", '"hosted-email:pkce-or-otp"', '"password-update:bounded-recovery-context"', '"fresh-password-signin-required"', 'SUPABASE_AUTH_HARDENING_PROOF_SCHEMA = "auth-breach-protection-proof-v2"', "getPwnedPasswordProtectionContract"]);
requireText("lib/faucetpay-authority.ts", ["hasCurrentFaucetPayEvidence", '"faucetpay_send_scope"', "hasCurrentFaucetPaySendScopeProof"]);
requireText("lib/faucetpay-receipt-proof.ts", ["FAUCETPAY_PAYOUT_PROOF_SCHEMA", "FAUCETPAY_RECEIPT_PROOF_SCHEMA", "getFaucetPayPayoutFingerprint", "faucetPayPayoutEvidenceMatches", "recordFaucetPayPayoutProofById", "payoutWithdrawal", "payoutWithdrawal.id === receiptWithdrawal.id"]);
requireText("lib/product-readiness.ts", ['const receiptState = await getFaucetPayReceiptProofState(admin, proof)', 'pass: receiptState.payoutProofCurrent && paidWithdrawals > 0', "exact paid FaucetPay withdrawal"]);
forbidText("lib/product-readiness.ts", ['releaseEvidenceMatches(proof, "faucetpay_payout")', "const payoutProof ="]);
requireText("app/api/withdrawals/route.ts", ["isTrustedSameOriginMutation(request)", "hasCurrentFaucetPayReadProof", "hasCurrentFaucetPaySendScopeProof", "hasCanonicalFaucetPayPackAuthority", "reservedMatchesCanonicalPayoutAuthority", "getFaucetPayReadOnlyPreflight", "hasLivePayoutPreflight", 'live.state === "READ_ONLY_VERIFIED"', "live.balanceSmallestUnits >= config.amountSmallestUnits", "validateDestination(active.destination, active.asset)", "idempotency_key", "matchesCurrentPayoutAuthority", "readProof && sendScopeProof", "recordFaucetPayPayoutProofById", "reserved.withdrawal_id", "FinalizeWithdrawalResult", "authoritativePaidSettlement", 'settlement.status === "paid"', "settledExternalId === expectedExternalId", "finalized.error || !authoritativePaidSettlement(finalized.data, payout.externalId)", "PAYOUT_DISPATCH_RETRY_SECONDS", "claimDispatch", 'admin.rpc("claim_withdrawal_dispatch"', "hasWithdrawalPilotAccess", '"pilot-restricted"', 'dispatch.status !== "submitted" || dispatch.dispatch !== true']);
forbidText("app/api/withdrawals/route.ts", ['recordReleaseEvidence("faucetpay_payout")']);
{
  const source = read("app/api/withdrawals/route.ts");
  const executorStart = source.indexOf("async function executeReservedPayout");
  const canonicalGate = source.indexOf("reservedMatchesCanonicalPayoutAuthority(admin, reserved)", executorStart);
  const dispatchCall = source.indexOf("claimDispatch(admin, reserved.withdrawal_id)", executorStart);
  const providerSend = source.indexOf("provider.send({", executorStart);
  if (
    executorStart < 0
    || canonicalGate < executorStart
    || dispatchCall < executorStart
    || providerSend < executorStart
    || canonicalGate > dispatchCall
    || canonicalGate > providerSend
  ) {
    throw new Error("Every payout execution must prove the reserved pack matches the immutable database authority before dispatch or provider send.");
  }
}
requireText("providers/faucetpay-read.ts", ["getFaucetPayBalanceReadOnly", 'fetch(`${BASE_URL}/balance`', "FAUCETPAY_READ_KEY", "balanceSmallestUnits", 'body: JSON.stringify({ currency: normalizedAsset })']);
requireText("providers/faucetpay.ts", ["getFaucetPaySendAuthorityConfig", "CREDITS_PER_USD", "FAUCETPAY_SEND_DAILY_LIMIT_USD", "onePackDailyLimitUsd", '"one_pack_default"', '"configured_override"', "credentialsSeparated", "dailyLimitUsd", "const externalId =", "String(payoutId).trim()", "if (!externalId)", "without a usable payout id"]);
requireText("app/admin/faucetpay/actions.ts", ["completeFaucetPayConnection", "FAUCETPAY_SEND_SETUP_CONFIRMED", 'recordReleaseEvidence("faucetpay_read")', "getFaucetPaySendAuthorityConfig", "credentialsSeparated", "expected_daily_limit_usd", "sendAuthority.dailyLimitUsd", 'releaseEvidenceMatches(proofRow?.value, "faucetpay_read")', 'recordReleaseEvidence("faucetpay_send_scope")', "reconcileFaucetPayPayoutProof", "recordFaucetPayPayoutProof", "expectedWithdrawalId", "state.withdrawal", "paidWithdrawal.id !== expectedWithdrawalId", "payout-proof-reconciled", "state.payoutWithdrawal", "state.payoutWithdrawal.id !== expectedWithdrawalId", "recordFaucetPayReceiptProof(admin, state.payoutWithdrawal)"]);
requireText("app/admin/faucetpay/page.tsx", ["completeFaucetPayConnection", '"faucetpay_send_scope"', "getFaucetPaySendAuthorityConfig", "sendAuthority.credentialsSeparated", "sendAuthority.dailyLimitUsd", "sendAuthority.dailyLimitSource", "Automatic: one payout pack/day", 'name="expected_daily_limit_usd"', 'name="setup_confirmation"', "FAUCETPAY_SEND_SETUP_CONFIRMED", "It never calls the FaucetPay payout endpoint", "reconcileFaucetPayPayoutProof", 'action={reconcileFaucetPayPayoutProof}', 'name="withdrawal_id"', "settlementWithdrawal.id", "does not call FaucetPay and cannot resend funds", "receiptState.payoutWithdrawal.id", "receipt-payout-changed", "EXACT WITHDRAWAL"]);
requireText("lib/request-security.ts", ["isTrustedSameOriginMutation", 'request.headers.get("origin")', 'request.headers.get("sec-fetch-site")', 'fetchSite !== "same-origin"']);
requireText("lib/auth-security.ts", ["PASSWORD_RECOVERY_CONTEXT_LEGACY", "PASSWORD_RECOVERY_CONTEXT_PKCE", "PASSWORD_RECOVERY_CONTEXT_OTP", "isPasswordRecoveryContext", "PASSWORD_RECOVERY_CONTEXTS.has(value)"]);
requireText("lib/pwned-passwords.ts", ['createHash("sha1")', '"https://api.pwnedpasswords.com/range/"', '"User-Agent"', '"Add-Padding": "true"', 'cache: "no-store"', '"new-password:fail-closed-on-unavailable"', '"existing-signin:fail-open-on-unavailable"', "probePwnedPasswordProtection"]);
requireText("app/admin/product/actions.ts", ["verifyPasswordBreachProtection", "probePwnedPasswordProtection", 'recordReleaseEvidence("supabase_auth_hardening")', "fundLaunchTreasury", "getTreasuryDailyFundingState", "getFaucetPayBalanceReadOnly", 'admin.rpc("fund_reward_treasury"', "user_balances", "activeWithdrawals", "activeReservations", 'formData.get("confirm") === "real-funding"', "treasuryState.fundingGapCredits", "totalCapacityAfterTopUp", "totalCreditsToBack", "liabilityCredits", "requiredUnits", '"liability_changed"', '"funding_gap_changed"', '"already_sufficient"']);
forbidText("app/admin/product/actions.ts", ["FAUCETPAY_SCOPED_KEY", '"/send"']);
requireText("app/admin/product/page.tsx", ["Password security without Pro", "Verify free breach protection", "Backed Treasury funding", "getTreasuryDailyFundingState", "Remaining today", "Exact top-up", "Top up exact gap", 'name="confirm"', "publicExpansionBlockers", "publicLaunchReady", "bounded per-account share of the daily faucet budget"]);
requireText("lib/auth-recovery-proof.ts", ["beginPasswordRecoveryProofChallenge", "markPasswordRecoveryPasswordUpdated", "password_updated_at: null", '.is("password_updated_at", null)', '.select("user_id,password_updated_at,expires_at")', "!data.password_updated_at"]);
requireText("app/auth/callback/route.ts", ["beginPasswordRecoveryProofChallenge", "hasRecentRecoverySend", 'beginPasswordRecoveryProofChallenge(user.id, "pkce")']);
requireText("app/auth/confirm/route.ts", ["beginPasswordRecoveryProofChallenge", 'type === "recovery"', 'beginPasswordRecoveryProofChallenge(user.id, "otp")']);
requireText("app/auth/actions.ts", ["isPasswordRecoveryContext(recoveryContext)", "PASSWORD_RECOVERY_CONTEXT_OTP", "PASSWORD_RECOVERY_CONTEXT_PKCE", "markPasswordRecoveryPasswordUpdated", 'markPasswordRecoveryPasswordUpdated(user.id, "otp")', 'markPasswordRecoveryPasswordUpdated(user.id, "pkce")', "finalizePasswordRecoveryProof", "checkPasswordBreach", 'breach.state === "compromised"', 'breach.state === "unavailable"', 'recordReleaseEvidence("supabase_auth_hardening")', "await supabase.auth.signOut()", 'redirect("/auth?message=password-updated&next=/dashboard")']);
forbidText("app/auth/actions.ts", ['redirect("/dashboard?security=password-updated")']);
requireText("app/auth/update-password/page.tsx", ["isPasswordRecoveryContext", "const recoveryContext = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value", "isPasswordRecoveryContext(recoveryContext)"]);
requireText("app/api/pulse/claim/route.ts", ["isTrustedSameOriginMutation(request)", "claim_hourly_pulse", "pilot_restricted", "revalidateRewardViews", '["/dashboard", "/dashboard/claimed", "/wallet", "/progress"]', "revalidatePath(path)"]);
requireText("lib/reward-state.ts", ["maximumFractionDigits: 3", "minimumFractionDigits: 2"]);
requireText("lib/withdrawal-pilot.ts", ["hasWithdrawalPilotAccess", 'admin.rpc("withdrawal_pilot_allowed"', "return !error && data === true"]);
requireText("scripts/report-safe-payout-profile.mjs", ["FAUCETPAY_PAYOUT_CURRENCY", "FAUCETPAY_PAYOUT_CREDITS", "FAUCETPAY_PAYOUT_UNITS", "FAUCETPAY_PAYOUT_LABEL", "FAUCETPAY_SEND_DAILY_LIMIT_USD", "visible-pack-ready"]);
requireText(".github/workflows/ci.yml", ["npm@11.19.1", 'test "$(npm --version)" = "11.19.1"', "node scripts/audit-production-dependencies.mjs", "Reject direct pushes to main", "verify-deploy-provenance.mjs push", "Main integrity rejected:", "pull-requests: read"]);
requireText(".github/workflows/vercel-prebuilt.yml", ["npm@11.19.1", 'test "$(npm --version)" = "11.19.1"', "node scripts/audit-production-dependencies.mjs", "Require merged PR provenance for production deploy", 'verify-deploy-provenance.mjs "$GITHUB_EVENT_NAME"', "Require current main HEAD", "Reconfirm current main HEAD before deploy", 'verify-current-main-head.mjs "$GITHUB_SHA"', "Require production database schema authority", "verify-production-schema-gate.mjs", "https://pulsercuit.pro/api/release-schema", "Production deploy rejected: database schema authority does not match the release contract."]);
{
  const source = read(".github/workflows/ci.yml");
  const mainGate = source.indexOf("Reject direct pushes to main");
  const dependencyAudit = source.indexOf("Audit production dependency surface");
  if (mainGate < 0 || dependencyAudit < 0 || mainGate > dependencyAudit) {
    throw new Error("Main merged-PR provenance must be checked before dependency audit and the expensive CI path.");
  }
}
requireText("scripts/audit-production-dependencies.mjs", ["MAX_ATTEMPTS = 5", '"audit", "--omit=dev", "--audit-level=high"', "retryableInfrastructureFailure", "process.exit(status)", "attempt * 5000", "Security audit infrastructure remained unavailable"]);
requireText("scripts/verify-deploy-provenance.mjs", ["requireMergedMainPrProvenance", 'eventName !== "push" && eventName !== "workflow_dispatch"', "accepted missing PR provenance", "Unsupported production deploy event"]);
requireText("scripts/verify-current-main-head.mjs", ["verifyCurrentMainHead", "is not the current main HEAD", "Current main HEAD contract PASS"]);
forbidText("scripts/verify-deploy-provenance.mjs", ["Deploy provenance PASS: explicit workflow_dispatch invocation."]);
forbidText(".github/workflows/vercel-prebuilt.yml", ["Allow explicit manual production deploy", "not-required.json"]);
requireText("supabase/migrations/0050_release_runtime_contract_snapshot.sql", [
  "create or replace function public.release_runtime_contract_snapshot()",
  "returns jsonb",
  "security invoker",
  "admin_economics_snapshot",
  "release_security_contract()",
  "release_authenticated_read_scope_contract()",
  "release_withdrawal_settlement_contract()",
  "release_treasury_backing_guard_contract()",
  "release_hourly_pulse_scale_contract()",
  "release_user_balance_materialization_contract()",
  "'snapshot_authority'",
  "not has_function_privilege(",
  "grant execute on function public.release_runtime_contract_snapshot()",
  "to service_role",
  "version', 50"
]);
requireText("supabase/migrations/0051_controlled_technical_readiness_snapshot.sql", [
  "create or replace function public.controlled_technical_readiness_snapshot()",
  "returns jsonb",
  "security invoker",
  "release_runtime_contract_snapshot()",
  "faucetpay_payout_pack_authority",
  "daily_claim_credits",
  "daily_reservation_credits",
  "payout_withdrawal",
  "receipt_withdrawal",
  "chain_claim",
  "chain_claim_ledger",
  "chain_withdrawal_ledger",
  "'snapshot_authority'",
  "not has_function_privilege(",
  "grant execute on function public.controlled_technical_readiness_snapshot()",
  "to service_role",
  "version', 51"
]);
requireText("supabase/migrations/0052_controlled_readiness_release_authority.sql", [
  "create table public.controlled_readiness_release_authority",
  "enable row level security",
  "revoke all on table public.controlled_readiness_release_authority",
  "from public, anon, authenticated, service_role",
  "grant select on table public.controlled_readiness_release_authority",
  "to service_role",
  "release_runtime_contract_snapshot()",
  "v52 release authority refused",
  "contracts_passed",
  "create or replace function public.controlled_technical_readiness_snapshot()",
  "security invoker",
  "controlled_readiness_release_authority",
  "'authority_runtime_lock'",
  "has_table_privilege(",
  "'INSERT'",
  "'UPDATE'",
  "'DELETE'",
  "'TRUNCATE'",
  "'external_proof'",
  "grant execute on function public.controlled_technical_readiness_snapshot()",
  "to service_role",
  "version', 52"
]);
forbidText("supabase/migrations/0052_controlled_readiness_release_authority.sql", [
  "grant insert on table public.controlled_readiness_release_authority",
  "grant update on table public.controlled_readiness_release_authority",
  "grant delete on table public.controlled_readiness_release_authority",
  "grant truncate on table public.controlled_readiness_release_authority"
]);
{
  const source = read("supabase/migrations/0052_controlled_readiness_release_authority.sql");
  const fnStart = source.indexOf("create or replace function public.controlled_technical_readiness_snapshot()");
  const fnEnd = source.indexOf("revoke all on function public.controlled_technical_readiness_snapshot()", fnStart);
  if (fnStart < 0 || fnEnd < fnStart) {
    throw new Error("v52 controlled readiness snapshot function boundaries are missing.");
  }
  const runtimeFunction = source.slice(fnStart, fnEnd);
  if (runtimeFunction.includes("release_runtime_contract_snapshot()")) {
    throw new Error("Public controlled readiness must not recompute static release contracts per request.");
  }
  if (!runtimeFunction.includes("controlled_readiness_release_authority")) {
    throw new Error("Public controlled readiness must consume the immutable release authority.");
  }
}
requireText("supabase/migrations/0053_compact_reward_snapshot.sql", [
  "create or replace function public.current_user_reward_snapshot()",
  "security invoker",
  "auth.uid()",
  "grant execute on function public.current_user_reward_snapshot()",
  "to authenticated",
  "create or replace function public.current_pulse_runtime_state()",
  "grant execute on function public.current_pulse_runtime_state()",
  "to service_role",
  "create or replace function public.release_reward_snapshot_contract()",
  "not has_function_privilege(",
  "'reward_snapshot', public.release_reward_snapshot_contract()",
  "v53 release authority refused",
  "schema_version = 53",
  "0053_compact_reward_snapshot.sql",
  "version', 53"
]);
forbidText("supabase/migrations/0053_compact_reward_snapshot.sql", [
  "security definer",
  "grant execute on function public.current_user_reward_snapshot()\n  to anon",
  "grant execute on function public.current_pulse_runtime_state()\n  to authenticated"
]);
requireText("lib/reward-state.ts", [
  'supabase.rpc("current_user_reward_snapshot")',
  'admin.rpc("current_pulse_runtime_state")',
  "Promise.all([",
  "rawUserSnapshot.user_id",
  "userSnapshot.streak_days",
  "runtime.hourly_pulse",
  "runtime.treasury"
]);
forbidText("lib/reward-state.ts", [
  '.from("user_balances")',
  '.from("pulse_claims")',
  '.from("profiles").select("handle,trust_level")',
  '.select("risk_score")',
  '.from("app_config")',
  '.from("reward_treasuries")'
]);
requireText("scripts/verify-production-schema-gate.mjs", ["readExpectedSchema", "readBaseExpectedSchema", "verifySchemaResponse", "actualVersion !== expected.version", "actualMigration !== expected.migration", "Production schema gate self-test PASS"]);
{
  const source = read(".github/workflows/vercel-prebuilt.yml");
  const mainHeadGate = source.indexOf("Require current main HEAD");
  const schemaGate = source.indexOf("Require production database schema authority");
  const buildStep = source.indexOf("Build prebuilt Vercel output");
  const predeployHeadGate = source.indexOf("Reconfirm current main HEAD before deploy");
  const deployStep = source.indexOf("Deploy prebuilt output");
  const mainHeadChecks = source.match(/verify-current-main-head\.mjs "\$GITHUB_SHA"/g) ?? [];
  if (
    mainHeadGate < 0
    || schemaGate < 0
    || buildStep < 0
    || predeployHeadGate < 0
    || deployStep < 0
    || mainHeadChecks.length < 2
    || mainHeadGate > buildStep
    || schemaGate > buildStep
    || buildStep > predeployHeadGate
    || predeployHeadGate > deployStep
  ) {
    throw new Error("Current main HEAD must be proven both before the build path and again immediately before Vercel deploy.");
  }
}
forbidText("scripts/audit-production-dependencies.mjs", ["process.exit(0); //", "audit-level=moderate"]);
forbidText("scripts/report-safe-payout-profile.mjs", ["FAUCETPAY_SCOPED_KEY", "FAUCETPAY_READ_KEY", "VERCEL_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"]);
requireText("lib/current-user-context.ts", ['import { cache } from "react"', "CurrentUserIdentity", "getCurrentUserContext", "createSupabaseServerClient", "supabase.auth.getClaims", "claims?.sub", "claims?.email"]);
requireText("lib/retention-summary.ts", ["getCurrentUserContext", '.from("pulse_claims")', '.gte("created_at", fourteenDaysAgo)']);
forbidText("lib/retention-summary.ts", ["supabase.auth.getUser", "createSupabaseServerClient"]);
forbidText("lib/current-user-context.ts", ["supabase.auth.getUser"]);
requireText("proxy.ts", ["supabase.auth.getClaims", "hasValidIdentity", "claims?.sub", "isProtected && !hasValidIdentity"]);
forbidText("proxy.ts", ["supabase.auth.getUser"]);
requireText("lib/experience-presentation.ts", ["getUserNextAction", "getWalletPresentation", "getOperatorNextAction", "payoutPilotAllowed", '"Withdrawals are limited during the payout pilot."', '"Withdrawals are temporarily unavailable."', '"Complete FaucetPay connection."']);
requireText("app/dashboard/page.tsx", ["getUserNextAction", "nextAction", "Waiting for next Pulse", "getCurrentUserContext"]);
requireText("app/admin/page.tsx", ["getOperatorNextAction", "One blocker at a time.", "Growth systems", "getProductLaunchReadiness"]);
requireText("app/admin/advanced/page.tsx", ["/admin/product", "/admin/retention", "/admin/leads", "/admin/prospects"]);
requireText("app/wallet/page.tsx", ["getWalletPresentation", "hasCurrentFaucetPaySendScopeProof", "hasWithdrawalPilotAccess", "withdrawalPilotAllowed", '"pilot-restricted"', "sendScopeProofReady", "canWithdraw", "TurnstileField", "This continues the same protected payment request. It cannot create a second payout."]);
requireText("app/api/return-reminder/route.ts", ["export async function POST", "isTrustedSameOriginMutation(request)", "getCanonicalSiteUrl", "new URL(reminderId ? \"/return\" : \"/dashboard\", getCanonicalSiteUrl())"]);
forbidText("app/api/return-reminder/route.ts", ["export async function GET"]);
requireText("app/api/direct/start/route.ts", ["isTrustedSameOriginMutation(request)", 'admin.rpc("start_direct_campaign_session"', 'target.protocol !== "https:"']);
forbidText("app/api/direct/start/route.ts", ['request.headers.get("origin")']);
requireText("app/api/direct/callback/route.ts", ["invalid_occurred_at", 'admin.rpc("settle_direct_campaign_completion"', 'p_occurred_at: occurredAt.toISOString()']);
requireText("components/next-circuit-panel.tsx", ['action="/api/return-reminder"', 'method="post"', 'type="submit"']);
requireText("app/api/business/leads/route.ts", ["POSITIVE_INTEGER_RE", "url.username || url.password"]);
requireText("app/auth/page.tsx", ["safeAuthNext(params.next)", 'params.mode === "signup"', "authModeHref", '<TurnstileField action="signin" />', '<TurnstileField action="signup" />', 'params.message === "password-updated"', "Sign in with your new password to finish account recovery."]);
requireText("components/circuit-share-studio.tsx", ["copyTextToClipboard", "isNativeShareAbort"]);
requireText("app/admin/prospects/actions.ts", ["normalizeProspectUrl", "UUID_RE", "LOCAL_DATETIME_RE", "new Date(`${value}:00Z`)"]);
requireText("app/admin/support/actions.ts", ["UUID_RE.test(id)"]);
requireText("components/app-shell.tsx", ['label: "Invite"', '/admin/faucetpay', 'label: "Payments"', '/admin/support', '/admin/advanced']);
requireText("app/styles/current/compatibility-hardening.css", [".pc-v6-ranks article:nth-child(3):before{display:none!important}"]);
requireText("app/styles/home/cinematic.css", ['content:"PULSECIRCUIT / 01"']);

const manifest = JSON.parse(read("public/manifest.webmanifest"));
if (manifest.id !== "/" || manifest.scope !== "/" || !Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  throw new Error("PWA manifest must keep stable id/scope and at least one application icon.");
}
for (const icon of manifest.icons) {
  if (typeof icon?.src !== "string" || !icon.src.startsWith("/") || !existsSync(`public${icon.src}`)) {
    throw new Error(`PWA manifest references a missing or invalid icon: ${icon?.src ?? "unknown"}`);
  }
}

console.log("Release safety contracts PASS");