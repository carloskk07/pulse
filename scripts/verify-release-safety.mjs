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
requireText(".github/workflows/vercel-prebuilt.yml", ["Stamp exact release identity", "public/release.json", "process.env.GITHUB_SHA", "Verify exact canonical production release", "release.git_sha !== expectedSha"]);
requireText("lib/release-readiness.ts", ['admin.rpc("release_authenticated_read_scope_contract")', 'admin.rpc("release_withdrawal_read_contract")', 'admin.rpc("release_withdrawal_settlement_contract")', 'admin.rpc("release_faucetpay_proof_chain_contract")', 'admin.rpc("release_reward_exchange_contract")', 'admin.rpc("release_pulse_direct_contract")', 'admin.rpc("release_hourly_pulse_pilot_contract")', '"faucetpay-send-scope-proof"', 'releaseEvidenceMatches(proofValue, "faucetpay_send_scope")', '"faucetpay-payout-proof"', 'receiptState.payoutProofCurrent', '"legal-operator"', 'legalIdentity ? "pass" : "pending"', 'Deferred from the current technical-readiness scope', 'false,']);
requireText("lib/current-release-readiness.ts", ["CURRENT_RELEASE_SCHEMA_VERSION = 41", 'CURRENT_RELEASE_SCHEMA_MIGRATION = "0041_faucetpay_send_scope_evidence.sql"', "getCurrentReleaseReadiness", "schemaMigration === CURRENT_RELEASE_SCHEMA_MIGRATION", 'item.id === "schema" ? schemaCheck : item', 'state === "READY"']);
requireText("lib/product-launch-readiness.ts", ["getCurrentReleaseReadiness", "releaseBlockers", "ready: product.ready && release.ready"]);
requireText("lib/product-readiness.ts", ["PRODUCT_SETUP_CHECK_IDS", '"hourly-pulse-config"', '"treasury"', '"faucetpay-send-scope-proof"', 'releaseEvidenceMatches(proof, "faucetpay_send_scope")', "hasProductSetupBlocker", "!item.pass"]);
requireText("lib/hourly-pilot-readiness.ts", ["HOURLY_PILOT_SCHEMA_VERSION = 36", 'admin.rpc("release_hourly_pulse_pilot_contract")', "schemaVersion >= HOURLY_PILOT_SCHEMA_VERSION"]);
requireText("app/api/readiness/route.ts", ["getCurrentReleaseReadiness", "getHourlyPilotReadiness", "hasProductSetupBlocker", "productSetupBlocked", "hourlyPilot.ok", 'service: "pulsercuit"']);
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
requireText("lib/release-evidence.ts", ["FAUCETPAY_SEND_SCOPE_PROOF_SCHEMA", '"faucetpay_send_scope"', '"scope:send-only"', '"daily-cap:operator-verified"', "GenericRecordableReleaseEvidenceKind", 'Exclude<ReleaseEvidenceKind, "faucetpay_payout">', "recordReleaseEvidence(kind: GenericRecordableReleaseEvidenceKind)"]);
requireText("lib/faucetpay-receipt-proof.ts", ["FAUCETPAY_PAYOUT_PROOF_SCHEMA", "FAUCETPAY_RECEIPT_PROOF_SCHEMA", "getFaucetPayPayoutFingerprint", "faucetPayPayoutEvidenceMatches", "recordFaucetPayPayoutProofById", "payoutWithdrawal", "payoutWithdrawal.id === receiptWithdrawal.id"]);
requireText("app/api/withdrawals/route.ts", ["isTrustedSameOriginMutation(request)", "hasCurrentFaucetPayReadProof", "getFaucetPayReadOnlyPreflight", "hasLivePayoutPreflight", 'live.state === "READ_ONLY_VERIFIED"', "live.balanceSmallestUnits >= config.amountSmallestUnits", "validateDestination(active.destination, active.asset)", "idempotency_key", "matchesCurrentPayoutAuthority", "recordFaucetPayPayoutProofById", "reserved.withdrawal_id", "FinalizeWithdrawalResult", "authoritativePaidSettlement", 'settlement.status === "paid"', "settledExternalId === expectedExternalId", "finalized.error || !authoritativePaidSettlement(finalized.data, payout.externalId)", "PAYOUT_DISPATCH_RETRY_SECONDS", "claimDispatch", 'admin.rpc("claim_withdrawal_dispatch"', 'dispatch.status !== "submitted" || dispatch.dispatch !== true']);
forbidText("app/api/withdrawals/route.ts", ['recordReleaseEvidence("faucetpay_payout")']);
requireText("providers/faucetpay.ts", ["const externalId =", "String(payoutId).trim()", "if (!externalId)", "without a usable payout id"]);
requireText("app/admin/faucetpay/actions.ts", ["confirmFaucetPaySendScope", "SEND_ONLY_CONFIRMED", "DAILY_CAP_CONFIRMED", "readKey === sendKey", 'releaseEvidenceMatches(proofRow?.value, "faucetpay_read")', 'recordReleaseEvidence("faucetpay_send_scope")', "reconcileFaucetPayPayoutProof", "recordFaucetPayPayoutProof", "expectedWithdrawalId", "state.withdrawal", "paidWithdrawal.id !== expectedWithdrawalId", "payout-proof-reconciled", "state.payoutWithdrawal", "state.payoutWithdrawal.id !== expectedWithdrawalId", "recordFaucetPayReceiptProof(admin, state.payoutWithdrawal)"]);
requireText("app/admin/faucetpay/page.tsx", ["confirmFaucetPaySendScope", '"faucetpay_send_scope"', "sendKeySeparated", 'name="scope_confirmation"', 'name="daily_cap_confirmation"', "No payout call is made by this proof", "reconcileFaucetPayPayoutProof", 'action={reconcileFaucetPayPayoutProof}', 'name="withdrawal_id"', "settlementWithdrawal.id", "does not call FaucetPay and cannot resend funds", "receiptState.payoutWithdrawal.id", "receipt-payout-changed", "EXACT WITHDRAWAL"]);
requireText("lib/request-security.ts", ["isTrustedSameOriginMutation", 'request.headers.get("origin")', 'request.headers.get("sec-fetch-site")', 'fetchSite !== "same-origin"']);
requireText("lib/auth-security.ts", ["PASSWORD_RECOVERY_CONTEXT_LEGACY", "PASSWORD_RECOVERY_CONTEXT_PKCE", "PASSWORD_RECOVERY_CONTEXT_OTP", "isPasswordRecoveryContext", "PASSWORD_RECOVERY_CONTEXTS.has(value)"]);
requireText("lib/auth-recovery-proof.ts", ["beginPasswordRecoveryProofChallenge", "markPasswordRecoveryPasswordUpdated", "password_updated_at: null", '.is("password_updated_at", null)', '.select("user_id,password_updated_at,expires_at")', "!data.password_updated_at"]);
requireText("app/auth/callback/route.ts", ["beginPasswordRecoveryProofChallenge", "hasRecentRecoverySend", 'beginPasswordRecoveryProofChallenge(user.id, "pkce")']);
requireText("app/auth/confirm/route.ts", ["beginPasswordRecoveryProofChallenge", 'type === "recovery"', 'beginPasswordRecoveryProofChallenge(user.id, "otp")']);
requireText("app/auth/actions.ts", ["isPasswordRecoveryContext(recoveryContext)", "PASSWORD_RECOVERY_CONTEXT_OTP", "PASSWORD_RECOVERY_CONTEXT_PKCE", "markPasswordRecoveryPasswordUpdated", 'markPasswordRecoveryPasswordUpdated(user.id, "otp")', 'markPasswordRecoveryPasswordUpdated(user.id, "pkce")', "finalizePasswordRecoveryProof"]);
requireText("app/auth/update-password/page.tsx", ["isPasswordRecoveryContext", "const recoveryContext = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value", "isPasswordRecoveryContext(recoveryContext)"]);
requireText("app/api/pulse/claim/route.ts", ["isTrustedSameOriginMutation(request)", "claim_hourly_pulse", "pilot_restricted", "revalidateRewardViews", '["/dashboard", "/dashboard/claimed", "/wallet", "/progress"]', "revalidatePath(path)"]);
requireText("lib/reward-state.ts", ["maximumFractionDigits: 3", "minimumFractionDigits: 2"]);
requireText("app/api/return-reminder/route.ts", ["export async function POST", "isTrustedSameOriginMutation(request)", "getCanonicalSiteUrl", "new URL(reminderId ? \"/return\" : \"/dashboard\", getCanonicalSiteUrl())"]);
forbidText("app/api/return-reminder/route.ts", ["export async function GET"]);
requireText("app/api/direct/start/route.ts", ["isTrustedSameOriginMutation(request)", 'admin.rpc("start_direct_campaign_session"', 'target.protocol !== "https:"']);
forbidText("app/api/direct/start/route.ts", ['request.headers.get("origin")']);
requireText("app/api/direct/callback/route.ts", ["invalid_occurred_at", 'admin.rpc("settle_direct_campaign_completion"', 'p_occurred_at: occurredAt.toISOString()']);
requireText("components/next-circuit-panel.tsx", ['action="/api/return-reminder"', 'method="post"', 'type="submit"']);
requireText("app/api/business/leads/route.ts", ["POSITIVE_INTEGER_RE", "url.username || url.password"]);
requireText("app/auth/page.tsx", ["safeAuthNext(params.next)"]);
requireText("components/circuit-share-studio.tsx", ["copyTextToClipboard", "isNativeShareAbort"]);
requireText("app/admin/prospects/actions.ts", ["normalizeProspectUrl", "UUID_RE", "LOCAL_DATETIME_RE", "new Date(`${value}:00Z`)"]);
requireText("app/admin/support/actions.ts", ["UUID_RE.test(id)"]);
requireText("components/app-shell.tsx", ["/admin/leads", "/admin/prospects", "/admin/retention"]);
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