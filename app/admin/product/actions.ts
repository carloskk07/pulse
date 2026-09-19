"use server";

import { redirect } from "next/navigation";
import { probePwnedPasswordProtection } from "@/lib/pwned-passwords";
import { recordReleaseEvidence } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";
import { getFaucetPayBalanceReadOnly } from "@/providers/faucetpay-read";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/auth?next=/admin/product");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/product");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) redirect("/dashboard");
  return user;
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

  const [
    { data: treasury, error: treasuryError },
    { data: balances, error: balancesError },
    { data: activeWithdrawals, error: withdrawalsError },
    { data: activeReservations, error: reservationsError },
  ] = await Promise.all([
    admin
      .from("reward_treasuries")
      .select("code,daily_budget_credits")
      .eq("code", "launch")
      .maybeSingle(),
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

  const dailyBudgetCredits = Number(treasury?.daily_budget_credits ?? 0);
  if (treasuryError || !treasury || dailyBudgetCredits <= 0) {
    redirect("/admin/product?funding=treasury-unavailable");
  }
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

  const totalCreditsToBack = liabilityCredits + dailyBudgetCredits;
  const requiredNumerator = totalCreditsToBack * payout.amountSmallestUnits;
  if (!Number.isSafeInteger(requiredNumerator)) {
    redirect("/admin/product?funding=backing-check-unavailable");
  }
  const requiredUnits = Math.ceil(requiredNumerator / payout.amountCredits);
  if (balance.balanceSmallestUnits < requiredUnits) {
    redirect("/admin/product?funding=insufficient-backing");
  }

  const { data, error } = await admin.rpc("fund_reward_treasury", {
    p_treasury_code: "launch",
    p_amount_credits: dailyBudgetCredits,
    p_idempotency_key: idempotencyKey,
    p_backing_asset: payout.asset,
    p_backing_balance_units: balance.balanceSmallestUnits,
    p_liability_credits: liabilityCredits,
    p_payout_pack_credits: payout.amountCredits,
    p_payout_pack_units: payout.amountSmallestUnits,
    p_actor_user_id: user.id,
    p_reason: "Operator-confirmed one daily budget backed by live FaucetPay read balance",
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
  redirect("/admin/product?funding=record-failed");
}
