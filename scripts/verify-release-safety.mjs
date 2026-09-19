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
requireText("lib/release-readiness.ts", ['admin.rpc("release_authenticated_read_scope_contract")', 'admin.rpc("release_withdrawal_read_contract")', 'admin.rpc("release_withdrawal_settlement_contract")', 'admin.rpc("release_withdrawal_pilot_contract")', 'admin.rpc("release_faucetpay_proof_chain_contract")', 'admin.rpc("release_reward_exchange_contract")', 'admin.rpc("release_treasury_funding_contract")', 'admin.rpc("release_pulse_direct_contract")', 'admin.rpc("release_hourly_pulse_pilot_contract")', "getFaucetPaySendAuthorityConfig", '"faucetpay-send-authority-config"', '"faucetpay-send-scope-proof"', 'releaseEvidenceMatches(proofValue, "faucetpay_send_scope")', '"faucetpay-payout-proof"', 'receiptState.payoutProofCurrent', '"legal-operator"', 'legalIdentity ? "pass" : "pending"', 'Not required for controlled technical readiness', 'Public/global governance advisory', '"Compromised-password protection"', 'HIBP Pwned Passwords', 'false,']);
requireText("lib/current-release-readiness.ts", ["CURRENT_RELEASE_SCHEMA_VERSION = 43", 'CURRENT_RELEASE_SCHEMA_MIGRATION = "0043_treasury_funding_authority.sql"', "getCurrentReleaseReadiness", "schemaMigration === CURRENT_RELEASE_SCHEMA_MIGRATION", 'item.id === "schema" ? schemaCheck : item', 'state === "READY"']);
requireText("lib/product-launch-readiness.ts", ["getCurrentReleaseReadiness", "releaseBlockers", "governanceAdvisories", "publicAccessBlockers", "publicExpansionBlockers", "technicalReady", "publicLaunchReady", "product.publicReady"]);
requireText("lib/product-readiness.ts", ["PRODUCT_SETUP_CHECK_IDS", '"send-authority-config"', '"hourly-pulse-config"', '"public-access"', '"treasury"', "getFaucetPaySendAuthorityConfig", '"faucetpay-send-scope-proof"', 'releaseEvidenceMatches(proof, "faucetpay_send_scope")', "hasProductSetupBlocker", "!item.pass", "dailyBudgetCredits >= rewardCredits", "maxUserDailyCredits >= rewardCredits", "availableTreasury >= dailyBudgetCredits", "covering at least one full", "config?.pilot_mode === false", "does not block technical readiness", "publicReady", "publicBlockers", 'item.id !== "public-access"']);
forbidText("lib/product-readiness.ts", ["availableTreasury >= rewardCredits"]);
requireText("lib/hourly-pilot-readiness.ts", ["HOURLY_PILOT_SCHEMA_VERSION = 36", 'admin.rpc("release_hourly_pulse_pilot_contract")', "schemaVersion >= HOURLY_PILOT_SCHEMA_VERSION"]);
requireText("app/api/readiness/route.ts", ["getCurrentReleaseReadiness", "getHourlyPilotReadiness", "hasProductSetupBlocker", "productSetupBlocked", "hourlyPilot.ok", 'service: "pulsercuit"', 'scope: "controlled-technical"']);
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
requireText("lib/release-evidence.ts", ["FAUCETPAY_SEND_SCOPE_PROOF_SCHEMA", '"faucetpay_send_scope"', "getFaucetPaySendAuthorityConfig", "sendAuthority.dailyLimitUsd", "sendAuthority.dailyLimitSource", '"scope:send-only"', '"daily-cap:exact-value-operator-verified"', "GenericRecordableReleaseEvidenceKind", 'Exclude<ReleaseEvidenceKind, "faucetpay_payout">', "recordReleaseEvidence(kind: GenericRecordableReleaseEvidenceKind)", 'PASSWORD_RECOVERY_PROOF_SCHEMA = "password-recovery-proof-v2"', "PASSWORD_RECOVERY_MAX_AGE_SECONDS", '"hosted-email:pkce-or-otp"', '"password-update:bounded-recovery-context"', '"fresh-password-signin-required"', 'SUPABASE_AUTH_HARDENING_PROOF_SCHEMA = "auth-breach-protection-proof-v2"', "getPwnedPasswordProtectionContract"]);
requireText("lib/faucetpay-authority.ts", ["hasCurrentFaucetPayEvidence", '"faucetpay_send_scope"', "hasCurrentFaucetPaySendScopeProof"]);
requireText("lib/faucetpay-receipt-proof.ts", ["FAUCETPAY_PAYOUT_PROOF_SCHEMA", "FAUCETPAY_RECEIPT_PROOF_SCHEMA", "getFaucetPayPayoutFingerprint", "faucetPayPayoutEvidenceMatches", "recordFaucetPayPayoutProofById", "payoutWithdrawal", "payoutWithdrawal.id === receiptWithdrawal.id"]);
requireText("app/api/withdrawals/route.ts", ["isTrustedSameOriginMutation(request)", "hasCurrentFaucetPayReadProof", "hasCurrentFaucetPaySendScopeProof", "getFaucetPayReadOnlyPreflight", "hasLivePayoutPreflight", 'live.state === "READ_ONLY_VERIFIED"', "live.balanceSmallestUnits >= config.amountSmallestUnits", "validateDestination(active.destination, active.asset)", "idempotency_key", "matchesCurrentPayoutAuthority", "readProof && sendScopeProof", "recordFaucetPayPayoutProofById", "reserved.withdrawal_id", "FinalizeWithdrawalResult", "authoritativePaidSettlement", 'settlement.status === "paid"', "settledExternalId === expectedExternalId", "finalized.error || !authoritativePaidSettlement(finalized.data, payout.externalId)", "PAYOUT_DISPATCH_RETRY_SECONDS", "claimDispatch", 'admin.rpc("claim_withdrawal_dispatch"', "hasWithdrawalPilotAccess", '"pilot-restricted"', 'dispatch.status !== "submitted" || dispatch.dispatch !== true']);
forbidText("app/api/withdrawals/route.ts", ['recordReleaseEvidence("faucetpay_payout")']);
requireText("providers/faucetpay-read.ts", ["getFaucetPayBalanceReadOnly", 'fetch(`${BASE_URL}/balance`', "FAUCETPAY_READ_KEY", "balanceSmallestUnits", 'body: JSON.stringify({ currency: normalizedAsset })']);
requireText("providers/faucetpay.ts", ["getFaucetPaySendAuthorityConfig", "CREDITS_PER_USD", "FAUCETPAY_SEND_DAILY_LIMIT_USD", "onePackDailyLimitUsd", '"one_pack_default"', '"configured_override"', "credentialsSeparated", "dailyLimitUsd", "const externalId =", "String(payoutId).trim()", "if (!externalId)", "without a usable payout id"]);
requireText("app/admin/faucetpay/actions.ts", ["completeFaucetPayConnection", "FAUCETPAY_SEND_SETUP_CONFIRMED", 'recordReleaseEvidence("faucetpay_read")', "getFaucetPaySendAuthorityConfig", "credentialsSeparated", "expected_daily_limit_usd", "sendAuthority.dailyLimitUsd", 'releaseEvidenceMatches(proofRow?.value, "faucetpay_read")', 'recordReleaseEvidence("faucetpay_send_scope")', "reconcileFaucetPayPayoutProof", "recordFaucetPayPayoutProof", "expectedWithdrawalId", "state.withdrawal", "paidWithdrawal.id !== expectedWithdrawalId", "payout-proof-reconciled", "state.payoutWithdrawal", "state.payoutWithdrawal.id !== expectedWithdrawalId", "recordFaucetPayReceiptProof(admin, state.payoutWithdrawal)"]);
requireText("app/admin/faucetpay/page.tsx", ["completeFaucetPayConnection", '"faucetpay_send_scope"', "getFaucetPaySendAuthorityConfig", "sendAuthority.credentialsSeparated", "sendAuthority.dailyLimitUsd", "sendAuthority.dailyLimitSource", "Automatic: one payout pack/day", 'name="expected_daily_limit_usd"', 'name="setup_confirmation"', "FAUCETPAY_SEND_SETUP_CONFIRMED", "It never calls the FaucetPay payout endpoint", "reconcileFaucetPayPayoutProof", 'action={reconcileFaucetPayPayoutProof}', 'name="withdrawal_id"', "settlementWithdrawal.id", "does not call FaucetPay and cannot resend funds", "receiptState.payoutWithdrawal.id", "receipt-payout-changed", "EXACT WITHDRAWAL"]);
requireText("lib/request-security.ts", ["isTrustedSameOriginMutation", 'request.headers.get("origin")', 'request.headers.get("sec-fetch-site")', 'fetchSite !== "same-origin"']);
requireText("lib/auth-security.ts", ["PASSWORD_RECOVERY_CONTEXT_LEGACY", "PASSWORD_RECOVERY_CONTEXT_PKCE", "PASSWORD_RECOVERY_CONTEXT_OTP", "isPasswordRecoveryContext", "PASSWORD_RECOVERY_CONTEXTS.has(value)"]);
requireText("lib/pwned-passwords.ts", ['createHash("sha1")', '"https://api.pwnedpasswords.com/range/"', '"User-Agent"', '"Add-Padding": "true"', 'cache: "no-store"', '"new-password:fail-closed-on-unavailable"', '"existing-signin:fail-open-on-unavailable"', "probePwnedPasswordProtection"]);
requireText("app/admin/product/actions.ts", ["verifyPasswordBreachProtection", "probePwnedPasswordProtection", 'recordReleaseEvidence("supabase_auth_hardening")', "fundLaunchTreasury", "getFaucetPayBalanceReadOnly", 'admin.rpc("fund_reward_treasury"', "user_balances", 'formData.get("confirm") === "real-funding"', "liabilityCredits", "requiredUnits"]);
forbidText("app/admin/product/actions.ts", ["FAUCETPAY_SCOPED_KEY", '"/send"']);
requireText("app/admin/product/page.tsx", ["Password security without Pro", "Verify free breach protection", "Backed Treasury funding", "Fund one daily budget", 'name="confirm"', "publicExpansionBlockers", "publicLaunchReady"]);
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
forbidText("scripts/report-safe-payout-profile.mjs", ["FAUCETPAY_SCOPED_KEY", "FAUCETPAY_READ_KEY", "VERCEL_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"]);
requireText("lib/current-user-context.ts", ['import { cache } from "react"', "getCurrentUserContext", "createSupabaseServerClient", "supabase.auth.getUser"]);
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