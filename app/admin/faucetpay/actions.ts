"use server";

import { redirect } from "next/navigation";
import { getFaucetPayReceiptProofState, recordFaucetPayReceiptProof } from "@/lib/faucetpay-receipt-proof";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

export async function confirmFaucetPayReceipt(formData: FormData) {
  await requireAdmin();
  if (String(formData.get("receipt_confirmation") ?? "") !== "RECEIVED") {
    redirect(resultUrl("receipt-confirmation-required"));
  }

  const admin = createSupabaseAdminClient();
  if (!admin) redirect(resultUrl("auth-unavailable"));

  const state = await getFaucetPayReceiptProofState(admin);
  if (!state.withdrawal) redirect(resultUrl("receipt-no-paid-withdrawal"));
  if (!state.payoutProofCurrent) redirect(resultUrl("receipt-payout-proof-required"));
  if (state.receiptProofCurrent) redirect(resultUrl("receipt-recorded"));

  const recorded = await recordFaucetPayReceiptProof(admin, state.withdrawal);
  redirect(resultUrl(recorded ? "receipt-recorded" : "receipt-record-failed"));
}
