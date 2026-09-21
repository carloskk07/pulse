import { getFaucetPayReceiptProofState } from "@/lib/faucetpay-receipt-proof";
import { releaseEvidenceMatches } from "@/lib/release-evidence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deriveTreasuryDailyFundingState } from "@/lib/treasury";
import { getCanonicalFaucetPayPackAuthority, getTreasuryBackingGuard } from "@/lib/treasury-backing";
import { getFaucetPayPackConfig, getFaucetPaySendAuthorityConfig } from "@/providers/faucetpay";

export type ProductReadinessCheck = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

export type ProductReadiness = {
  ready: boolean;
  publicReady: boolean;
  checks: ProductReadinessCheck[];
  blockers: string[];
  publicBlockers: string[];
  confirmedMonetizationEvents: number;
  paidWithdrawals: number;
};

const PRODUCT_SETUP_CHECK_IDS = new Set([
  "auth",
  "turnstile-config",
  "payout-pack",
  "payout-pack-authority",
  "send-authority-config",
  "database",
  "hourly-pulse-config",
  "treasury",
]);

export function hasProductSetupBlocker(readiness: ProductReadiness) {
  return readiness.checks.some((item) => PRODUCT_SETUP_CHECK_IDS.has(item.id) && !item.pass);
}

function configured(...keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function validTimestampOrder(first: unknown, second: unknown) {
  if (typeof first !== "string" || typeof second !== "string") return false;
  const left = Date.parse(first);
  const right = Date.parse(second);
  return Number.isFinite(left) && Number.isFinite(right) && left <= right;
}

export async function getProductReadiness(): Promise<ProductReadiness> {
  const checks: ProductReadinessCheck[] = [];
  const payout = getFaucetPayPackConfig();
  const sendAuthority = getFaucetPaySendAuthorityConfig();

  checks.push({
    id: "auth",
    label: "Production authentication",
    pass: configured("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
    detail: "Supabase public auth and trusted server authority must be configured.",
  });
  checks.push({
    id: "turnstile-config",
    label: "Human verification configuration",
    pass: configured("TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
    detail: "Turnstile must be configured for production claims and sensitive actions.",
  });
  checks.push({
    id: "payout-pack",
    label: "Real payout route",
    pass: payout.ready,
    detail: payout.ready ? `${payout.asset} payout pack is fully configured.` : "FaucetPay key, exact payout units and display pack must all be configured.",
  });
  checks.push({
    id: "send-authority-config",
    label: "FaucetPay send authority configuration",
    pass: sendAuthority.ready,
    detail: sendAuthority.ready
      ? `Read/send credentials are separated and the expected provider daily cap is ${sendAuthority.dailyLimitUsd?.toLocaleString("en-US")} USD (${sendAuthority.dailyLimitSource === "configured_override" ? "explicit override" : "one payout pack/day safety policy"}).`
      : "Configure distinct read/send credentials and a valid payout pack before any payout authority can be attested.",
  });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    checks.push({ id: "database", label: "Production database", pass: false, detail: "Trusted database authority is unavailable." });
    checks.push({ id: "payout-pack-authority", label: "Canonical payout-pack authority", pass: false, detail: "Database-owned payout-pack authority cannot be verified without trusted database access." });
    checks.push({ id: "auth-hardening-proof", label: "Compromised-password protection", pass: false, detail: "Managed Auth hardening evidence cannot be verified without trusted database authority." });
    checks.push({ id: "password-recovery-proof", label: "Hosted password recovery proof", pass: false, detail: "Real recovery evidence cannot be verified without trusted database authority." });
    checks.push({ id: "faucetpay-send-scope-proof", label: "FaucetPay send-key least privilege", pass: false, detail: "Send-key scope evidence cannot be verified without trusted database authority." });
    checks.push({ id: "base-loop-continuity", label: "Same-account base loop", pass: false, detail: "The authoritative same-account Pulse → Wallet → payout chain cannot be verified without trusted database authority." });
    checks.push({ id: "payout-receipt-proof", label: "Actual payout receipt", pass: false, detail: "Destination receipt cannot be verified without trusted database authority." });
    checks.push({ id: "public-backing", label: "Fresh FaucetPay backing for public launch", pass: false, detail: "Fresh public-launch backing cannot be verified without trusted database authority." });
    return {
      ready: false,
      publicReady: false,
      checks,
      blockers: checks.filter((item) => !item.pass).map((item) => item.label),
      publicBlockers: checks.filter((item) => !item.pass).map((item) => item.label),
      confirmedMonetizationEvents: 0,
      paidWithdrawals: 0,
    };
  }

  const [proofResult, pulseConfigResult, latestPulseClaimResult, monetizationResult, withdrawalResult, payoutPackAuthority] = await Promise.all([
    admin.from("app_config").select("value").eq("key", "release_external_proof").maybeSingle(),
    admin.from("app_config").select("value").eq("key", "hourly_pulse").maybeSingle(),
    admin.from("pulse_claims").select("id,treasury_id,reward_credits,metadata,created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("monetization_events").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
    admin.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "paid"),
    getCanonicalFaucetPayPackAuthority(admin),
  ]);

  const payoutPackAuthorityReady = Boolean(
    payout.ready
    && payoutPackAuthority
    && payout.asset === payoutPackAuthority.asset
    && payout.amountCredits === payoutPackAuthority.amountCredits
    && payout.amountSmallestUnits === payoutPackAuthority.amountSmallestUnits
  );

  checks.push({
    id: "payout-pack-authority",
    label: "Canonical payout-pack authority",
    pass: payoutPackAuthorityReady,
    detail: payoutPackAuthorityReady
      ? `Database authority matches the live ${payout.asset} payout pack: ${payout.amountCredits} P = ${payout.amountSmallestUnits} provider units.`
      : "The live payout asset/credits/provider-units must exactly match the database-owned payout-pack authority before claims or payouts can be considered release-ready.",
  });

  const config = pulseConfigResult.data?.value as {
    credits?: number | string;
    interval_minutes?: number | string;
    treasury_code?: string;
    pilot_mode?: boolean;
  } | null | undefined;
  const rewardCredits = Number(config?.credits ?? 0);
  const intervalMinutes = Number(config?.interval_minutes ?? 0);
  const treasuryCode = String(config?.treasury_code ?? "").trim();
  const pulseConfigured = !pulseConfigResult.error && rewardCredits > 0 && intervalMinutes >= 15 && Boolean(treasuryCode);

  const treasuryResult = treasuryCode
    ? await admin.from("reward_treasuries").select("id,code,funded_credits,reserved_credits,spent_credits,daily_budget_credits,max_user_daily_credits,enabled,kill_switch").eq("code", treasuryCode).maybeSingle()
    : { data: null, error: null };
  const treasury = treasuryResult.data;
  const availableTreasury = Number(treasury?.funded_credits ?? 0) - Number(treasury?.reserved_credits ?? 0) - Number(treasury?.spent_credits ?? 0);
  const dailyBudgetCredits = Number(treasury?.daily_budget_credits ?? 0);
  const maxUserDailyCredits = Number(treasury?.max_user_daily_credits ?? 0);

  const utcTodayStart = new Date();
  utcTodayStart.setUTCHours(0, 0, 0, 0);
  const utcTodayStartIso = utcTodayStart.toISOString();
  let dailyClaimCredits = 0;
  let dailyReservationCredits = 0;
  let dailyBudgetStateKnown = false;

  if (treasury?.id) {
    const [dailyClaimsResult, dailyReservationsResult] = await Promise.all([
      admin
        .from("pulse_claims")
        .select("reward_credits")
        .eq("treasury_id", treasury.id)
        .gte("created_at", utcTodayStartIso),
      admin
        .from("treasury_reservations")
        .select("amount_credits")
        .eq("treasury_id", treasury.id)
        .gte("created_at", utcTodayStartIso)
        .in("status", ["reserved", "consumed"]),
    ]);

    if (!dailyClaimsResult.error && !dailyReservationsResult.error) {
      dailyClaimCredits = (dailyClaimsResult.data ?? []).reduce(
        (total, row) => total + Number(row.reward_credits ?? 0),
        0,
      );
      dailyReservationCredits = (dailyReservationsResult.data ?? []).reduce(
        (total, row) => total + Number(row.amount_credits ?? 0),
        0,
      );
      dailyBudgetStateKnown = true;
    }
  }

  const dailyFundingState = deriveTreasuryDailyFundingState({
    availableCredits: availableTreasury,
    dailyBudgetCredits,
    dailyClaimCredits,
    dailyReservationCredits,
  });
  const dailyBudgetUsed = dailyFundingState.dailyCommittedCredits;
  const remainingDailyBudget = dailyFundingState.remainingDailyBudgetCredits;
  const treasuryReady = !treasuryResult.error && dailyBudgetStateKnown && Boolean(
    treasury &&
    treasury.enabled === true &&
    treasury.kill_switch === false &&
    rewardCredits > 0 &&
    dailyBudgetCredits >= rewardCredits &&
    maxUserDailyCredits >= rewardCredits &&
    dailyFundingState.availableCredits >= remainingDailyBudget
  );
  const publicBackingStatus = treasuryCode
    ? await getTreasuryBackingGuard(treasuryCode, admin)
    : "backing_unavailable";
  const publicBackingReady = publicBackingStatus === "backing_ready";

  const latestClaim = latestPulseClaimResult.data;
  const claimMetadata = objectValue(latestClaim?.metadata);
  const currentPulseProof = !latestPulseClaimResult.error && Boolean(
    latestClaim &&
    treasury &&
    latestClaim.treasury_id === treasury.id &&
    Number(latestClaim.reward_credits) === rewardCredits &&
    Number(claimMetadata.interval_minutes) === intervalMinutes
  );

  const proof = proofResult.data?.value;
  const authHardeningProof = !proofResult.error && releaseEvidenceMatches(proof, "supabase_auth_hardening");
  const passwordRecoveryProof = !proofResult.error && releaseEvidenceMatches(proof, "password_recovery");
  const turnstileProof = !proofResult.error && releaseEvidenceMatches(proof, "turnstile");
  const faucetPayReadProof = !proofResult.error && releaseEvidenceMatches(proof, "faucetpay_read");
  const faucetPaySendScopeProof = !proofResult.error && releaseEvidenceMatches(proof, "faucetpay_send_scope");
  const receiptState = await getFaucetPayReceiptProofState(admin, proof);
  const confirmedMonetizationEvents = monetizationResult.error ? 0 : Number(monetizationResult.count ?? 0);
  const paidWithdrawals = withdrawalResult.error ? 0 : Number(withdrawalResult.count ?? 0);

  let baseLoopContinuity = false;
  let baseLoopContinuityDetail = "Complete one controlled same-account Hourly Pulse → Wallet → FaucetPay payout → destination receipt chain.";

  if (receiptState.withdrawal && receiptState.receiptProofCurrent && treasury) {
    const chainWithdrawalResult = await admin
      .from("withdrawals")
      .select("id,user_id,ledger_entry_id,payout_provider,asset,amount_credits,status,external_id,created_at")
      .eq("id", receiptState.withdrawal.id)
      .maybeSingle();
    const chainWithdrawal = chainWithdrawalResult.data;

    if (!chainWithdrawalResult.error && chainWithdrawal?.user_id && chainWithdrawal.ledger_entry_id && chainWithdrawal.status === "paid") {
      const chainClaimResult = await admin
        .from("pulse_claims")
        .select("id,user_id,treasury_id,reward_credits,ledger_entry_id,metadata,created_at")
        .eq("user_id", chainWithdrawal.user_id)
        .eq("treasury_id", treasury.id)
        .eq("reward_credits", rewardCredits)
        .contains("metadata", { interval_minutes: intervalMinutes })
        .lte("created_at", chainWithdrawal.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const chainClaim = chainClaimResult.data;

      if (!chainClaimResult.error && chainClaim?.ledger_entry_id) {
        const ledgerResult = await admin
          .from("ledger_entries")
          .select("id,user_id,event_key,entry_type,state,credits,metadata,created_at")
          .in("id", [chainClaim.ledger_entry_id, chainWithdrawal.ledger_entry_id]);
        const claimLedger = ledgerResult.data?.find((row) => row.id === chainClaim.ledger_entry_id);
        const withdrawalLedger = ledgerResult.data?.find((row) => row.id === chainWithdrawal.ledger_entry_id);
        const chainClaimMetadata = objectValue(chainClaim.metadata);
        const claimLedgerMetadata = objectValue(claimLedger?.metadata);
        const withdrawalLedgerMetadata = objectValue(withdrawalLedger?.metadata);
        const sameUser = chainClaim.user_id === chainWithdrawal.user_id;
        const claimContractMatches = Boolean(
          chainClaim.treasury_id === treasury.id &&
          Number(chainClaim.reward_credits) === rewardCredits &&
          Number(chainClaimMetadata.interval_minutes) === intervalMinutes
        );
        const claimLedgerMatches = Boolean(
          claimLedger &&
          claimLedger.user_id === chainWithdrawal.user_id &&
          claimLedger.event_key === `hourly_pulse:${chainClaim.id}` &&
          claimLedger.entry_type === "pulse_reward" &&
          claimLedger.state === "available" &&
          Number(claimLedger.credits) === rewardCredits &&
          String(claimLedgerMetadata.claim_id ?? "") === chainClaim.id &&
          claimLedgerMetadata.funding_source === "pulse" &&
          claimLedgerMetadata.treasury_code === treasuryCode &&
          Number(claimLedgerMetadata.interval_minutes) === intervalMinutes
        );
        const withdrawalMatchesReceipt = Boolean(
          chainWithdrawal.id === receiptState.withdrawal.id &&
          chainWithdrawal.payout_provider === "faucetpay" &&
          chainWithdrawal.asset === receiptState.withdrawal.asset &&
          Number(chainWithdrawal.amount_credits) === receiptState.withdrawal.amount_credits &&
          chainWithdrawal.external_id === receiptState.withdrawal.external_id
        );
        const withdrawalLedgerMatches = Boolean(
          withdrawalLedger &&
          withdrawalLedger.user_id === chainWithdrawal.user_id &&
          withdrawalLedger.event_key === `withdrawal:reserve:${chainWithdrawal.id}` &&
          withdrawalLedger.entry_type === "withdrawal" &&
          withdrawalLedger.state === "withdrawn" &&
          Number(withdrawalLedger.credits) === -Number(chainWithdrawal.amount_credits) &&
          withdrawalLedgerMetadata.provider === "faucetpay" &&
          withdrawalLedgerMetadata.asset === chainWithdrawal.asset &&
          String(withdrawalLedgerMetadata.withdrawal_id ?? "") === chainWithdrawal.id
        );
        const chronologyMatches = validTimestampOrder(chainClaim.created_at, chainWithdrawal.created_at)
          && validTimestampOrder(claimLedger?.created_at, withdrawalLedger?.created_at);

        baseLoopContinuity = Boolean(
          !ledgerResult.error &&
          sameUser &&
          claimContractMatches &&
          claimLedgerMatches &&
          withdrawalMatchesReceipt &&
          withdrawalLedgerMatches &&
          chronologyMatches
        );
        baseLoopContinuityDetail = baseLoopContinuity
          ? "One account has a current-contract Hourly Pulse claim, its authoritative Wallet ledger credit, the later FaucetPay withdrawal ledger debit, provider-paid status and matching destination-receipt proof in causal order."
          : "The same-account claim and paid withdrawal exist, but their authoritative ledger links, current contract, receipt binding or causal order do not all agree.";
      } else {
        baseLoopContinuityDetail = "The receipt-bound payout account has no earlier Hourly Pulse claim matching the current reward, interval and Treasury contract.";
      }
    } else {
      baseLoopContinuityDetail = "The receipt-bound paid withdrawal could not be linked to a valid account and authoritative withdrawal ledger entry.";
    }
  } else if (receiptState.withdrawal && receiptState.payoutProofCurrent) {
    baseLoopContinuityDetail = "Provider-side payout exists, but actual destination receipt must be proven before the same-account base loop can close.";
  }

  checks.push({
    id: "auth-hardening-proof",
    label: "Compromised-password protection",
    pass: authHardeningProof,
    detail: authHardeningProof
      ? "Current 12+ character password policy and free HIBP Pwned Passwords k-anonymity screening have matching live evidence."
      : "Verify the built-in HIBP Pwned Passwords screening. This replaces the paid Supabase leaked-password feature without weakening the password-set gate.",
  });
  checks.push({
    id: "password-recovery-proof",
    label: "Hosted password recovery proof",
    pass: passwordRecoveryProof,
    detail: passwordRecoveryProof
      ? "A current hosted recovery flow completed password update and a later successful new-password sign-in for the same user."
      : "Complete a real hosted recovery email, change the password through the recovery session, then sign in with the new password. The proof is recorded automatically.",
  });
  checks.push({
    id: "hourly-pulse-config",
    label: "Hourly Pulse contract",
    pass: pulseConfigured,
    detail: pulseConfigured ? `${rewardCredits} credit(s) every ${intervalMinutes} rolling minutes from Treasury ${treasuryCode}.` : "Hourly Pulse needs a positive deterministic reward, rolling interval and treasury binding.",
  });
  const publicPulseAccess = config?.pilot_mode === false;
  checks.push({
    id: "public-access",
    label: "Public Hourly Pulse access",
    pass: publicPulseAccess,
    detail: publicPulseAccess
      ? "Hourly Pulse and the shared withdrawal authority are intentionally open beyond the controlled pilot allowlist."
      : "Controlled pilot mode is intentionally active. It does not block technical readiness; public expansion remains blocked until pilot mode is deliberately disabled after funding and launch gates are closed.",
  });
  const publicFairShareReady = Boolean(
    dailyBudgetCredits > 0
    && maxUserDailyCredits > 0
    && maxUserDailyCredits * 2 <= dailyBudgetCredits
  );
  checks.push({
    id: "public-fair-share",
    label: "Public daily fair-share limit",
    pass: publicFairShareReady,
    detail: publicFairShareReady
      ? `One account can consume at most ${maxUserDailyCredits}/${dailyBudgetCredits} P of the UTC-day budget (50% or less).`
      : `Public expansion requires max_user_daily_credits to be no more than 50% of the daily budget so one account cannot monopolize the faucet (current ${maxUserDailyCredits}/${dailyBudgetCredits} P).`,
  });
  checks.push({
    id: "public-backing",
    label: "Fresh FaucetPay backing for public launch",
    pass: publicBackingReady,
    detail: publicBackingReady
      ? "Current FaucetPay backing evidence is fresh and sufficient for the live Treasury exposure."
      : `Public expansion requires fresh FaucetPay backing authority; current state is ${publicBackingStatus.replaceAll("_", " ")}.`,
  });
  checks.push({
    id: "treasury",
    label: "Funded reward treasury",
    pass: treasuryReady,
    detail: treasuryReady
      ? `${availableTreasury} funded credit(s) remain behind Treasury ${treasuryCode}, covering the current UTC day's remaining ${remainingDailyBudget}-credit budget after ${dailyBudgetUsed}/${dailyBudgetCredits} credit(s) were already committed.`
      : `Treasury ${treasuryCode || "(unconfigured)"} must be enabled with kill switch open, daily/user limits large enough for one reward, and available real funding covering the current UTC day's remaining budget (available ${availableTreasury}, remaining ${remainingDailyBudget}, used ${dailyBudgetUsed}/${dailyBudgetCredits}).`,
  });
  checks.push({
    id: "turnstile-proof",
    label: "Turnstile production proof",
    pass: turnstileProof,
    detail: turnstileProof ? "Current Turnstile configuration has controlled evidence." : "Current Turnstile configuration still needs controlled proof.",
  });
  checks.push({
    id: "faucetpay-read-proof",
    label: "FaucetPay read-only unit proof",
    pass: faucetPayReadProof,
    detail: faucetPayReadProof
      ? "Current FaucetPay asset and payout pack have fingerprint-bound live read-only unit evidence."
      : "The live FaucetPay read-only preflight must prove and record the exact unit scale before payout authority can be considered ready.",
  });
  checks.push({
    id: "faucetpay-send-scope-proof",
    label: "FaucetPay send-key least privilege",
    pass: faucetPaySendScopeProof,
    detail: faucetPaySendScopeProof
      ? "The current send credential and payout pack have fingerprint-bound operator evidence for send-only scope and a provider-side daily payout cap."
      : "Confirm the current send key is send-only with a daily cap in FaucetPay, then record the attestation in the private cockpit.",
  });
  checks.push({
    id: "pulse-proof",
    label: "Current Hourly Pulse proof",
    pass: currentPulseProof,
    detail: currentPulseProof
      ? `The latest production claim matches the current contract: ${rewardCredits} credit(s), ${intervalMinutes} minutes and Treasury ${treasuryCode}.`
      : latestClaim
        ? "A historical Pulse claim exists, but it does not match the current reward, interval or Treasury contract. Complete one real claim under the current configuration."
        : "At least one real Treasury-backed Hourly Pulse claim must complete under the current reward, interval and Treasury contract.",
  });
  checks.push({
    id: "base-loop-continuity",
    label: "Same-account base loop",
    pass: baseLoopContinuity,
    detail: baseLoopContinuityDetail,
  });
  checks.push({
    id: "payout-proof",
    label: "Provider-side payout proof",
    pass: receiptState.payoutProofCurrent && paidWithdrawals > 0,
    detail: receiptState.payoutProofCurrent && paidWithdrawals > 0
      ? `${paidWithdrawals} paid withdrawal(s) exist and the current payout authority is fingerprint-bound to the exact paid FaucetPay withdrawal.`
      : "At least one controlled withdrawal must reach authoritative provider-side paid status with current exact-withdrawal FaucetPay payout evidence.",
  });
  checks.push({
    id: "payout-receipt-proof",
    label: "Actual payout receipt",
    pass: receiptState.receiptProofCurrent,
    detail: receiptState.receiptProofCurrent
      ? "The current controlled FaucetPay payout was explicitly observed as received at its destination and fingerprint-bound to that exact paid withdrawal."
      : receiptState.withdrawal && receiptState.payoutProofCurrent
        ? "A paid FaucetPay withdrawal exists, but actual spendable receipt at the destination still requires explicit external verification in the private FaucetPay cockpit."
        : "Complete and prove one controlled FaucetPay payout before destination receipt can be verified.",
  });

  const publicOnlyCheckIds = new Set(["public-access", "public-fair-share", "public-backing"]);
  const blockers = checks
    .filter((item) => !publicOnlyCheckIds.has(item.id) && !item.pass)
    .map((item) => item.label);
  const publicBlockers = checks.filter((item) => !item.pass).map((item) => item.label);

  return {
    ready: blockers.length === 0,
    publicReady: publicBlockers.length === 0,
    checks,
    blockers,
    publicBlockers,
    confirmedMonetizationEvents,
    paidWithdrawals,
  };
}
