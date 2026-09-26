"use server";

import { redirect } from "next/navigation";
import { probePwnedPasswordProtection } from "@/lib/pwned-passwords";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin-authorization";
import { getProductRouteHref } from "@/lib/route-semantics";
import { getPublicLaunchSwitchState } from "@/lib/public-launch-switch";
import { getTreasuryDailyFundingState } from "@/lib/treasury";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";
import { getFaucetPayBalanceReadOnly } from "@/providers/faucetpay-read";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const access = await getAdminAccess();
  if (access.status === "unauthenticated") redirect("/auth?next=/admin/product");
  if (access.status === "unavailable") redirect("/auth?next=/admin/product");
  if (access.status !== "authorized") redirect(getProductRouteHref("home"));
  return access.user;
}


const AFFILIATE_PROVIDER_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const AFFILIATE_TRACKING_PARAM_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function requiredText(formData: FormData, key: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  return value && value.length <= maxLength ? value : null;
}

function optionalPositiveInt(formData: FormData, key: string, max: number) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 && value <= max ? value : null;
}

function parseUsdMicros(rawValue: string) {
  const raw = rawValue.trim();
  const match = raw.match(/^(\d{1,7})(?:\.(\d{1,6}))?$/);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(6, "0"));
  const micros = whole * 1_000_000 + fraction;
  return Number.isSafeInteger(micros) && micros > 0 ? micros : null;
}

function safeAffiliateDestination(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || !hostname
      || hostname === "localhost"
      || hostname.endsWith(".local")
    ) return null;
    return url;
  } catch {
    return null;
  }
}

function normalizeCountryCodes(rawValue: FormDataEntryValue | null, maxItems = 40) {
  const items = String(rawValue ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  if (items.length > maxItems || items.some((item) => !/^[A-Z]{2}$/.test(item))) return null;
  return [...new Set(items)];
}

function normalizeDevicePlatforms(rawValue: FormDataEntryValue | null, maxItems = 10) {
  const allowed = new Set(["web", "desktop", "mobile", "android", "ios"]);
  const items = String(rawValue ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (items.length > maxItems || items.some((item) => !allowed.has(item))) return null;
  return [...new Set(items)];
}

export async function verifyPasswordBreachProtection() {
  await requireAdmin();

  const live = await probePwnedPasswordProtection();
  if (!live) redirect("/admin/product?security=breach-probe-unavailable");

  const recorded = await recordReleaseEvidence("supabase_auth_hardening");
  redirect(`/admin/product?security=${recorded ? "breach-protection-proven" : "breach-proof-record-failed"}`);
}


export async function fundLaunchTreasury(formData: FormData) {
  const user = await requireAdmin();
  const confirmed = formData.get("confirm") === "real-funding";
  const idempotencyKey = String(formData.get("idempotency_key") ?? "").trim();

  if (!confirmed) redirect("/admin/product?funding=confirmation-required");
  if (!UUID_RE.test(idempotencyKey)) redirect("/admin/product?funding=invalid-intent");

  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/product?funding=database-unavailable");

  const { data: existingEvent, error: existingError } = await admin
    .from("treasury_funding_events")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingError) redirect("/admin/product?funding=database-unavailable");
  if (existingEvent) redirect("/admin/product?funding=already-funded");

  const treasuryState = await getTreasuryDailyFundingState("launch");
  if (!treasuryState || treasuryState.dailyBudgetCredits <= 0) {
    redirect("/admin/product?funding=treasury-unavailable");
  }
  if (treasuryState.fundingGapCredits <= 0) {
    redirect("/admin/product?funding=already-covered");
  }

  const [
    { data: balances, error: balancesError },
    { data: activeWithdrawals, error: withdrawalsError },
    { data: activeReservations, error: reservationsError },
  ] = await Promise.all([
    admin
      .from("user_balances")
      .select("available_credits,pending_credits"),
    admin
      .from("withdrawals")
      .select("amount_credits")
      .in("status", ["requested", "held", "submitted"]),
    admin
      .from("treasury_reservations")
      .select("amount_credits")
      .eq("status", "reserved"),
  ]);

  if (
    balancesError || !Array.isArray(balances)
    || withdrawalsError || !Array.isArray(activeWithdrawals)
    || reservationsError || !Array.isArray(activeReservations)
  ) {
    redirect("/admin/product?funding=liability-unavailable");
  }

  const userBalanceLiability = balances.reduce((sum, row) => {
    const available = Math.max(0, Number(row.available_credits ?? 0));
    const pending = Math.max(0, Number(row.pending_credits ?? 0));
    return sum + available + pending;
  }, 0);
  const activeWithdrawalLiability = activeWithdrawals.reduce(
    (sum, row) => sum + Math.max(0, Number(row.amount_credits ?? 0)),
    0,
  );
  const activeReservationLiability = activeReservations.reduce(
    (sum, row) => sum + Math.max(0, Number(row.amount_credits ?? 0)),
    0,
  );
  const liabilityCredits = userBalanceLiability + activeWithdrawalLiability + activeReservationLiability;
  if (
    !Number.isSafeInteger(userBalanceLiability)
    || !Number.isSafeInteger(activeWithdrawalLiability)
    || !Number.isSafeInteger(activeReservationLiability)
    || !Number.isSafeInteger(liabilityCredits)
  ) {
    redirect("/admin/product?funding=liability-unavailable");
  }

  const payout = getFaucetPayPackConfig();
  if (!payout.ready || !payout.amountCredits || !payout.amountSmallestUnits) {
    redirect("/admin/product?funding=payout-pack-unavailable");
  }

  const balance = await getFaucetPayBalanceReadOnly(payout.asset);
  if (!balance.ok || balance.balanceSmallestUnits === null) {
    redirect("/admin/product?funding=backing-check-unavailable");
  }

  const totalCapacityAfterTopUp = treasuryState.availableCredits + treasuryState.fundingGapCredits;
  const totalCreditsToBack = liabilityCredits + totalCapacityAfterTopUp;
  const requiredNumerator = totalCreditsToBack * payout.amountSmallestUnits;
  if (
    !Number.isSafeInteger(totalCapacityAfterTopUp)
    || !Number.isSafeInteger(totalCreditsToBack)
    || !Number.isSafeInteger(requiredNumerator)
  ) {
    redirect("/admin/product?funding=backing-check-unavailable");
  }
  const requiredUnits = Math.ceil(requiredNumerator / payout.amountCredits);
  if (balance.balanceSmallestUnits < requiredUnits) {
    redirect("/admin/product?funding=insufficient-backing");
  }

  const { data, error } = await admin.rpc("fund_reward_treasury", {
    p_treasury_code: "launch",
    p_amount_credits: treasuryState.fundingGapCredits,
    p_idempotency_key: idempotencyKey,
    p_backing_asset: payout.asset,
    p_backing_balance_units: balance.balanceSmallestUnits,
    p_liability_credits: liabilityCredits,
    p_payout_pack_credits: payout.amountCredits,
    p_payout_pack_units: payout.amountSmallestUnits,
    p_actor_user_id: user.id,
    p_reason: "Operator-confirmed exact UTC-day Treasury gap backed by live FaucetPay read balance",
  });

  if (error) redirect("/admin/product?funding=record-failed");
  const result = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  const status = String(result.status ?? "");
  if (status === "funded") redirect("/admin/product?funding=funded");
  if (status === "already_funded") redirect("/admin/product?funding=already-funded");
  if (status === "insufficient_backing") redirect("/admin/product?funding=insufficient-backing");
  if (status === "liability_changed") redirect("/admin/product?funding=liability-changed");
  if (status === "funding_gap_changed") redirect("/admin/product?funding=funding-gap-changed");
  if (status === "already_sufficient") redirect("/admin/product?funding=already-covered");
  redirect("/admin/product?funding=record-failed");
}

export async function upsertAffiliateOffer(formData: FormData) {
  await requireAdmin();

  const providerRaw = requiredText(formData, "provider", 64);
  const externalId = requiredText(formData, "external_id", 160);
  const title = requiredText(formData, "title", 180);
  const category = requiredText(formData, "category", 80) ?? "cashback";
  const destinationRaw = requiredText(formData, "destination_url", 2_000);
  const requestedTrackingParam = requiredText(formData, "tracking_param", 64) ?? "subid";
  const estimatedCommissionRaw = requiredText(formData, "estimated_commission_usd", 32);
  const publicRewardLabel = requiredText(formData, "public_reward_label", 80);
  const freshnessHours = optionalPositiveInt(formData, "freshness_hours", 168) ?? 24;
  const estimatedMinutes = optionalPositiveInt(formData, "estimated_minutes", 10_080);
  const countryCodes = normalizeCountryCodes(formData.get("country_codes"));
  const devicePlatforms = normalizeDevicePlatforms(formData.get("device_platforms"));

  const provider = providerRaw?.toLowerCase() ?? "";
  const trackingParam = provider === "admitad" ? "subid4" : requestedTrackingParam;
  const destination = destinationRaw ? safeAffiliateDestination(destinationRaw) : null;
  const commissionMicros = estimatedCommissionRaw ? parseUsdMicros(estimatedCommissionRaw) : null;

  if (
    !AFFILIATE_PROVIDER_RE.test(provider)
    || !externalId
    || !title
    || !destination
    || !AFFILIATE_TRACKING_PARAM_RE.test(trackingParam)
    || !commissionMicros
    || !countryCodes
    || !devicePlatforms
  ) {
    redirect("/admin/product?affiliate=invalid");
  }

  const expiresRaw = String(formData.get("expires_at") ?? "").trim();
  let expiresAt: string | null = null;
  if (expiresRaw) {
    const date = new Date(expiresRaw);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      redirect("/admin/product?affiliate=invalid-expiry");
    }
    expiresAt = date.toISOString();
  }

  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/product?affiliate=database-unavailable");

  const { data: configRow, error: configError } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "pulse_economy_v13")
    .maybeSingle();

  if (configError || !configRow?.value || typeof configRow.value !== "object") {
    redirect("/admin/product?affiliate=economy-unavailable");
  }

  const economy = configRow.value as Record<string, unknown>;
  const shareBps = Math.max(0, Math.min(7_500, Number(economy.cashback_user_share_bps ?? 0)));
  if (!Number.isFinite(shareBps) || shareBps <= 0) {
    redirect("/admin/product?affiliate=economy-unavailable");
  }

  const estimatedRewardCredits = Math.floor((commissionMicros * shareBps) / 10_000_000);
  if (!Number.isSafeInteger(estimatedRewardCredits) || estimatedRewardCredits <= 0) {
    redirect("/admin/product?affiliate=reward-too-small");
  }

  const now = new Date().toISOString();
  const metadata = {
    destination_url: destination.toString(),
    tracking_param: trackingParam,
    estimated_commission_usd_micros: commissionMicros,
    cashback_user_share_bps: shareBps,
    estimate_only: true,
    ...(publicRewardLabel ? { public_reward_label: publicRewardLabel } : {}),
  };

  const { error } = await admin
    .from("reward_opportunities")
    .upsert({
      provider,
      external_id: externalId,
      title,
      category,
      payout_usd_micros: commissionMicros,
      base_reward_credits: estimatedRewardCredits,
      estimated_minutes: estimatedMinutes,
      completion_probability: null,
      tracking_reliability: null,
      payout_reliability: null,
      reversal_rate: null,
      country_codes: countryCodes,
      device_platforms: devicePlatforms,
      status: "active",
      source_type: "affiliate",
      evidence_tier: "new",
      health_state: "good",
      freshness_ttl_minutes: freshnessHours * 60,
      metadata,
      refreshed_at: now,
      updated_at: now,
      expires_at: expiresAt,
    }, { onConflict: "provider,external_id" });

  if (error) redirect("/admin/product?affiliate=save-failed");
  redirect("/admin/product?affiliate=saved");
}

export async function pauseAffiliateOffer(formData: FormData) {
  await requireAdmin();
  const opportunityId = String(formData.get("opportunity_id") ?? "").trim();
  if (!UUID_RE.test(opportunityId)) redirect("/admin/product?affiliate=invalid");

  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/product?affiliate=database-unavailable");

  const { error } = await admin
    .from("reward_opportunities")
    .update({ status: "paused", updated_at: new Date().toISOString() })
    .eq("id", opportunityId)
    .eq("source_type", "affiliate");

  if (error) redirect("/admin/product?affiliate=pause-failed");
  redirect("/admin/product?affiliate=paused");
}

export async function enableCashbackForLaunch(formData: FormData) {
  await requireAdmin();
  if (formData.get("confirm") !== "enable-cashback") {
    redirect("/admin/product?cashback=confirmation-required");
  }
  if (!process.env.CASHBACK_CALLBACK_SECRET?.trim()) {
    redirect("/admin/product?cashback=callback-secret-missing");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/product?cashback=database-unavailable");

  const { data: configRow, error: configError } = await admin
    .from("app_config")
    .select("value,version")
    .eq("key", "pulse_economy_v13")
    .maybeSingle();

  if (configError || !configRow?.value || typeof configRow.value !== "object") {
    redirect("/admin/product?cashback=economy-unavailable");
  }

  const currentValue = configRow.value as Record<string, unknown>;
  const nextValue = { ...currentValue, cashback_enabled: true };

  const { data: ready, error: readyError } = await admin.rpc("cashback_public_launch_requirements_ready", {
    p_economy: nextValue,
  });
  if (readyError || ready !== true) {
    redirect("/admin/product?cashback=requirements-not-ready");
  }

  const { error: updateError } = await admin
    .from("app_config")
    .update({
      value: nextValue,
      version: Math.max(14, Number(configRow.version ?? 0)),
      reason: "Operator enabled launch cashback after canonical offer onboarding",
      updated_at: new Date().toISOString(),
    })
    .eq("key", "pulse_economy_v13");

  if (updateError) redirect("/admin/product?cashback=enable-failed");
  redirect("/admin/product?cashback=enabled");
}



export async function openPublicAccess(formData: FormData) {
  await requireAdmin();

  if (
    formData.get("confirm") !== "open-public"
    || String(formData.get("confirmation") ?? "").trim() !== "OPEN PUBLIC"
  ) {
    redirect("/admin/product?launch=confirmation-required");
  }

  const switchState = await getPublicLaunchSwitchState();
  if (!switchState.readyToOpen) {
    redirect("/admin/product?launch=blocked");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/product?launch=database-unavailable");

  const { data, error } = await admin.rpc("open_public_launch");
  if (error || !data || typeof data !== "object") {
    redirect("/admin/product?launch=failed");
  }

  const status = String((data as Record<string, unknown>).status ?? "");
  if (status === "opened") redirect("/admin/product?launch=opened");
  if (status === "already_public") redirect("/admin/product?launch=already-public");
  if (status === "blocked") redirect("/admin/product?launch=blocked");
  redirect("/admin/product?launch=failed");
}

export async function closePublicAccess(formData: FormData) {
  await requireAdmin();

  if (
    formData.get("confirm") !== "close-public"
    || String(formData.get("confirmation") ?? "").trim() !== "CLOSE PUBLIC"
  ) {
    redirect("/admin/product?launch=close-confirmation-required");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/product?launch=database-unavailable");

  const { data, error } = await admin.rpc("close_public_launch");
  if (error || !data || typeof data !== "object") {
    redirect("/admin/product?launch=close-failed");
  }

  const status = String((data as Record<string, unknown>).status ?? "");
  if (status === "closed") redirect("/admin/product?launch=closed");
  if (status === "already_pilot") redirect("/admin/product?launch=already-pilot");
  redirect("/admin/product?launch=close-failed");
}
