import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireFragments(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(`${path} is missing critical value-path authority: ${fragment}`);
    }
  }
  return source;
}

function forbidFragments(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (source.includes(fragment)) {
      throw new Error(`${path} restored forbidden value-path behavior: ${fragment}`);
    }
  }
}

function requireOrder(path, first, second) {
  const source = read(path);
  const a = source.indexOf(first);
  const b = source.indexOf(second);
  if (a < 0 || b < 0 || a >= b) {
    throw new Error(`${path} must keep ${first} before ${second}`);
  }
}

function requireOrderBeforeLast(path, first, second) {
  const source = read(path);
  const a = source.indexOf(first);
  const b = source.lastIndexOf(second);
  if (a < 0 || b < 0 || a >= b) {
    throw new Error(`${path} must persist new authority before first-attempt settlement`);
  }
}

const claim = requireFragments("app/api/pulse/claim/route.ts", [
  "isTrustedSameOriginMutation(request)",
  "supabase.auth.getClaims()",
  "readUrlEncodedFormWithLimit(request, 8_192)",
  "verifyTurnstile(",
  'expectedAction: "hourly_pulse"',
  'admin.rpc("claim_hourly_pulse"',
  'ensureFreshTreasuryBacking("launch", admin)',
  "One bounded retry",
]);
if (claim.includes("export async function GET")) {
  throw new Error("Pulse claim authority must remain POST-only.");
}
forbidFragments("app/api/pulse/claim/route.ts", ["request.formData()"]);

const withdrawals = requireFragments("app/api/withdrawals/route.ts", [
  "isTrustedSameOriginMutation(request)",
  "supabase.auth.getUser()",
  "readUrlEncodedFormWithLimit(request, 8_192)",
  "verifyTurnstile(",
  'expectedAction: ["withdrawal", "withdrawal-retry"]',
  "hasWithdrawalPilotAccess",
  'admin.rpc("reserve_withdrawal"',
  'admin.rpc("claim_withdrawal_dispatch"',
  'admin.rpc("finalize_withdrawal"',
  "reservedHasStoredPayoutAuthority",
  "hasCanonicalFaucetPayPackAuthority",
  "hasCurrentFaucetPayReadProof",
  "hasCurrentFaucetPaySendScopeProof",
  "hasLivePayoutPreflight",
  "validateDestination",
  "idempotencyKey: reserved.idempotency_key",
]);
if (withdrawals.includes("export async function GET")) {
  throw new Error("Withdrawal authority must remain POST-only.");
}
forbidFragments("app/api/withdrawals/route.ts", ["request.formData()"]);

requireFragments("app/api/faucetpay/webhook/route.ts", [
  "readRequestBytesWithLimit(request, MAX_BODY_BYTES)",
  'request.headers.get("x-faucetpay-signature")',
  "createHmac",
  "timingSafeEqual",
  "verifySignature(rawBody, signature, secret)",
  'admin.rpc(\n    "reconcile_faucetpay_payout_webhook"',
  "p_payload_sha256: payloadHash",
  'status === "event_id_payload_mismatch"',
]);
requireOrder(
  "app/api/faucetpay/webhook/route.ts",
  "verifySignature(rawBody, signature, secret)",
  "JSON.parse(rawText)",
);

requireFragments("app/api/cashback/callback/route.ts", [
  "CASHBACK_CALLBACK_SECRET",
  'request.headers.get("authorization")',
  "timingSafeEqual",
  "readRequestTextWithLimit(request, MAX_BODY_BYTES)",
  'admin.rpc("apply_cashback_attributed_event"',
  '"provider_mismatch"',
  '"economics_mismatch"',
  '"invalid_transition"',
]);

requireFragments("app/api/cashback/admitad/route.ts", [
  "CASHBACK_ADMITAD_POSTBACK_SECRET",
  "secureEqual(expected, suppliedSecret)",
  "UUID_RE.test(trackingId)",
  'currency !== "USD"',
  'admin.rpc("apply_cashback_attributed_event"',
]);

requireFragments("app/api/providers/ayet/callback/route.ts", [
  "provider.verifyCallback(request)",
  "callbackAdslot !== configuredAdslot",
  "isAyetRewardRateAligned",
  "isAyetRewardEconomicallyAligned",
  'admin.rpc("apply_monetization_callback"',
]);

requireFragments("app/api/ads/merchant/callback/route.ts", [
  "verifyPulseAdsCheckoutCustom",
  "MERCHANT_VERIFY_TIMEOUT_MS",
  "verified.valid === true",
  "verifiedMerchant === merchantUsername",
  "callbackTransactionId === verifiedTransactionId",
  '.from("pulse_ads_merchant_callbacks")',
  ".upsert({",
  "settlePersistedAuthority(admin, hash",
]);
requireOrderBeforeLast(
  "app/api/ads/merchant/callback/route.ts",
  'const { error: proofError } = await admin',
  "return settlePersistedAuthority(admin, hash",
);

requireFragments("app/api/ads/campaigns/route.ts", [
  "isTrustedSameOriginMutation(request)",
  "supabase.auth.getClaims()",
  "verifyTurnstile(",
  'expectedAction: "pulse_ads_create"',
  "createPulseAdCampaign",
]);

requireFragments("app/api/ads/click/route.ts", [
  "isTrustedSameOriginMutation(request)",
  "supabase.auth.getClaims()",
  "clickPulseAd(campaignId, userId)",
]);

requireFragments("supabase/migrations/0076_pulse_ads_claim_bound_delivery.sql", [
  "pulse_claim_id uuid references public.pulse_claims(id)",
  "pulse_ads_events_claim_type_unique",
  "p_pulse_claim_id uuid",
  "pc.user_id = p_user_id",
  "e.pulse_claim_id = p_pulse_claim_id",
]);

requireFragments("app/api/direct/start/route.ts", [
  "isTrustedSameOriginMutation(request)",
  "supabase.auth.getUser()",
]);

requireFragments("app/api/direct/callback/route.ts", [
  'request.headers.get("authorization")',
  "p_secret: secret",
  'admin.rpc("settle_direct_campaign_completion"',
]);

requireFragments("app/api/daily-pulse/route.ts", [
  "isTrustedSameOriginMutation(request)",
  '"origin-rejected"',
  '"Cache-Control", "no-store"',
  '"X-Pulse-Legacy-Route", "daily-pulse"',
]);

requireFragments("lib/turnstile.ts", [
  'const hostnames = allowedHostnames();',
  "if (hostnames.length === 0)",
  'errorCodes: ["hostname-policy-not-configured"]',
  'errorCodes: ["hostname-mismatch"]',
]);

const pkg = JSON.parse(read("package.json"));
for (const [name, version] of Object.entries({
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {}),
})) {
  if (
    typeof version !== "string"
    || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)
  ) {
    throw new Error(`Direct dependency ${name} must be pinned exactly; received ${String(version)}`);
  }
}

console.log("Critical money and value-path contract PASS");
