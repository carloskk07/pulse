"use server";

import { redirect } from "next/navigation";
import {
  getFaucetPayReceiptProofState,
  recordFaucetPayPayoutProof,
  recordFaucetPayReceiptProof,
} from "@/lib/faucetpay-receipt-proof";
import { recordReleaseEvidence, releaseEvidenceMatches } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFaucetPayPackConfig, getFaucetPaySendAuthorityConfig } from "@/providers/faucetpay";
import { getFaucetPayReadOnlyPreflight } from "@/providers/faucetpay-readonly";

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function resultUrl(code: string) {
  return `/admin/faucetpay?proof=${encodeURIComponent(code)}`;
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(resultUrl("auth-unavailable"));

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/faucetpay");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) redirect("/dashboard");
  return user;
}

export async function verifyAndRecordFaucetPayReadProof() {
  await requireAdmin();

  const probe = await getFaucetPayReadOnlyPreflight();
  if (probe.state !== "READ_ONLY_VERIFIED") {
    redirect(resultUrl(probe.state.toLowerCase()));
  }

  const recorded = await recordReleaseEvidence("faucetpay_read");
  redirect(resultUrl(recorded ? "recorded" : "record-failed"));
}

export async function completeFaucetPayConnection(formData: FormData) {
  await requireAdmin();

  if (String(formData.get("setup_confirmation") ?? "") !== "FAUCETPAY_SEND_SETUP_CONFIRMED") {
    redirect(resultUrl("connection-confirmation-required"));
  }

  const probe = await getFaucetPayReadOnlyPreflight();
  if (probe.state !== "READ_ONLY_VERIFIED") {
    redirect(resultUrl(probe.state.toLowerCase()));
  }

  const sendAuthority = getFaucetPaySendAuthorityConfig();
  if (!sendAuthority.credentialsSeparated) {
    redirect(resultUrl("send-scope-key-separation-failed"));
  }
  if (!sendAuthority.dailyLimitUsd) {
    redirect(resultUrl("send-scope-daily-limit-required"));
  }

  const confirmedDailyLimit = Number(formData.get("expected_daily_limit_usd"));
  if (!Number.isFinite(confirmedDailyLimit) || confirmedDailyLimit !== sendAuthority.dailyLimitUsd) {
    redirect(resultUrl("send-scope-daily-limit-changed"));
  }

  const payout = getFaucetPayPackConfig();
  if (!payout.ready) redirect(resultUrl("send-scope-pack-not-ready"));

  const admin = createSupabaseAdminClient();
  if (!admin) redirect(resultUrl("auth-unavailable"));

  const { data: proofRow, error } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "release_external_proof")
    .maybeSingle();

  if (error) redirect(resultUrl("record-failed"));

  if (!releaseEvidenceMatches(proofRow?.value, "faucetpay_read")) {
    const readRecorded = await recordReleaseEvidence("faucetpay_read");
    if (!readRecorded) redirect(resultUrl("record-failed"));
  }

  const sendRecorded = await recordReleaseEvidence("faucetpay_send_scope");
  redirect(resultUrl(sendRecorded ? "connection-complete" : "send-scope-record-failed"));
}

export async function confirmFaucetPaySendScope(formData: FormData) {
  await requireAdmin();

  if (
    String(formData.get("scope_confirmation") ?? "") !== "SEND_ONLY_CONFIRMED"
    || String(formData.get("daily_cap_confirmation") ?? "") !== "DAILY_CAP_CONFIRMED"
  ) {
    redirect(resultUrl("send-scope-confirmation-required"));
  }

  const sendAuthority = getFaucetPaySendAuthorityConfig();
  if (!sendAuthority.credentialsSeparated) {
    redirect(resultUrl("send-scope-key-separation-failed"));
  }
  if (!sendAuthority.dailyLimitUsd) {
    redirect(resultUrl("send-scope-daily-limit-required"));
  }
  const confirmedDailyLimit = Number(formData.get("expected_daily_limit_usd"));
  if (!Number.isFinite(confirmedDailyLimit) || confirmedDailyLimit !== sendAuthority.dailyLimitUsd) {
    redirect(resultUrl("send-scope-daily-limit-changed"));
  }

  const payout = getFaucetPayPackConfig();
  if (!payout.ready) redirect(resultUrl("send-scope-pack-not-ready"));

  const admin = createSupabaseAdminClient();
  if (!admin) redirect(resultUrl("auth-unavailable"));

  const { data: proofRow, error } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "release_external_proof")
    .maybeSingle();

  if (error || !releaseEvidenceMatches(proofRow?.value, "faucetpay_read")) {
    redirect(resultUrl("send-scope-read-proof-required"));
  }

  const recorded = await recordReleaseEvidence("faucetpay_send_scope");
  redirect(resultUrl(recorded ? "send-scope-recorded" : "send-scope-record-failed"));
}

export async function reconcileFaucetPayPayoutProof(formData: FormData) {
  await requireAdmin();

  const expectedWithdrawalId = String(formData.get("withdrawal_id") ?? "").trim();
  if (!expectedWithdrawalId) redirect(resultUrl("payout-proof-changed"));

  const admin = createSupabaseAdminClient();
  if (!admin) redirect(resultUrl("auth-unavailable"));

  const state = await getFaucetPayReceiptProofState(admin);
  const paidWithdrawal = state.withdrawal;
  if (!paidWithdrawal) redirect(resultUrl("payout-proof-no-paid-withdrawal"));
  if (paidWithdrawal.id !== expectedWithdrawalId) redirect(resultUrl("payout-proof-changed"));
  if (state.payoutProofCurrent && state.payoutWithdrawal?.id === expectedWithdrawalId) {
    redirect(resultUrl("payout-proof-reconciled"));
  }

  const recorded = await recordFaucetPayPayoutProof(admin, paidWithdrawal);
  redirect(resultUrl(recorded ? "payout-proof-reconciled" : "payout-proof-reconcile-failed"));
}

export async function confirmFaucetPayReceipt(formData: FormData) {
  await requireAdmin();
  if (String(formData.get("receipt_confirmation") ?? "") !== "RECEIVED") {
    redirect(resultUrl("receipt-confirmation-required"));
  }

  const expectedWithdrawalId = String(formData.get("withdrawal_id") ?? "").trim();
  if (!expectedWithdrawalId) redirect(resultUrl("receipt-payout-changed"));

  const admin = createSupabaseAdminClient();
  if (!admin) redirect(resultUrl("auth-unavailable"));

  const state = await getFaucetPayReceiptProofState(admin);
  if (!state.payoutWithdrawal) redirect(resultUrl("receipt-no-paid-withdrawal"));
  if (!state.payoutProofCurrent) redirect(resultUrl("receipt-payout-proof-required"));
  if (state.payoutWithdrawal.id !== expectedWithdrawalId) redirect(resultUrl("receipt-payout-changed"));
  if (state.receiptProofCurrent) redirect(resultUrl("receipt-recorded"));

  const recorded = await recordFaucetPayReceiptProof(admin, state.payoutWithdrawal);
  redirect(resultUrl(recorded ? "receipt-recorded" : "receipt-record-failed"));
}
