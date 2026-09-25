import assert from "node:assert/strict";
import {
  deriveEarningEvent,
  deriveEarningPhase,
  deriveEarningResidue,
  deriveNetworkEvent,
  deriveNetworkResidue,
  deriveProgressResidue,
  deriveWalletCore,
  deriveWalletResidue,
  isRecentAuthoritativeEvent,
  payoutProgressPercent,
} from "../lib/product-experience-core.ts";

assert.equal(payoutProgressPercent(0, 1000), 0);
assert.equal(payoutProgressPercent(500, 1000), 50);
assert.equal(payoutProgressPercent(1000, 1000), 100);
assert.equal(payoutProgressPercent(4000, 1000), 100);
assert.equal(payoutProgressPercent(-500, 1000), 0);
assert.equal(payoutProgressPercent(500, null), 0);

assert.equal(deriveEarningPhase({ preview: true, pulseFundingReady: true, claimReady: true }), "preview");
assert.equal(deriveEarningPhase({ preview: false, pulseFundingReady: false, claimReady: true }), "paused");
assert.equal(deriveEarningPhase({ preview: false, pulseFundingReady: true, claimReady: true }), "ready");
assert.equal(deriveEarningPhase({ preview: false, pulseFundingReady: true, claimReady: false }), "charging");

assert.equal(deriveEarningEvent({ claimSettled: false }), "none");
assert.equal(deriveEarningEvent({ claimSettled: true }), "reward-settled");

assert.equal(deriveEarningResidue({ preview: true, availableCredits: 100, claimCount: 4 }), "none");
assert.equal(deriveEarningResidue({ preview: false, availableCredits: 100, claimCount: 4 }), "balance-funded");
assert.equal(deriveEarningResidue({ preview: false, availableCredits: 0, claimCount: 4 }), "reward-history");
assert.equal(deriveEarningResidue({ preview: false, availableCredits: 0, claimCount: 0 }), "none");

const now = Date.parse("2026-09-24T22:00:00.000Z");
assert.equal(isRecentAuthoritativeEvent("2026-09-24T21:59:00.000Z", now), true);
assert.equal(isRecentAuthoritativeEvent("2026-09-24T21:54:59.000Z", now), false);
assert.equal(isRecentAuthoritativeEvent("2026-09-24T22:00:01.000Z", now), false);
assert.equal(isRecentAuthoritativeEvent("not-a-date", now), false);
assert.equal(isRecentAuthoritativeEvent(null, now), false);

assert.deepEqual(
  deriveWalletCore({
    preview: false,
    payoutConfigured: false,
    canWithdraw: false,
    hasActiveWithdrawal: false,
    paid: false,
  }),
  {
    payoutState: "paused",
    stage: "balance",
    surface: "balance",
    phase: "paused",
    event: "none",
  },
);

assert.deepEqual(
  deriveWalletCore({
    preview: false,
    payoutConfigured: true,
    canWithdraw: false,
    hasActiveWithdrawal: false,
    paid: false,
  }),
  {
    payoutState: "building",
    stage: "balance",
    surface: "balance",
    phase: "building",
    event: "none",
  },
);

assert.deepEqual(
  deriveWalletCore({
    preview: false,
    payoutConfigured: true,
    canWithdraw: true,
    hasActiveWithdrawal: false,
    paid: false,
  }),
  {
    payoutState: "ready",
    stage: "payout",
    surface: "payout",
    phase: "ready",
    event: "payout-ready",
  },
);

assert.deepEqual(
  deriveWalletCore({
    preview: false,
    payoutConfigured: true,
    canWithdraw: true,
    hasActiveWithdrawal: true,
    paid: false,
  }),
  {
    payoutState: "processing",
    stage: "payout",
    surface: "payout",
    phase: "processing",
    event: "payout-processing",
  },
);

assert.deepEqual(
  deriveWalletCore({
    preview: false,
    payoutConfigured: true,
    canWithdraw: false,
    hasActiveWithdrawal: true,
    paid: true,
  }),
  {
    payoutState: "paid",
    stage: "payout",
    surface: "payout",
    phase: "complete",
    event: "payout-complete",
  },
);

assert.deepEqual(
  deriveWalletCore({
    preview: true,
    payoutConfigured: true,
    canWithdraw: false,
    hasActiveWithdrawal: false,
    paid: false,
  }),
  {
    payoutState: "building",
    stage: "balance",
    surface: "balance",
    phase: "preview",
    event: "none",
  },
);

assert.equal(deriveNetworkEvent({ signedIn: false, active: 4 }), "none");
assert.equal(deriveNetworkEvent({ signedIn: true, active: 0 }), "none");
assert.equal(deriveNetworkEvent({ signedIn: true, active: 1 }), "network-live");

assert.equal(deriveWalletResidue({ preview: true, payoutState: "ready", availableCredits: 500 }), "none");
assert.equal(deriveWalletResidue({ preview: false, payoutState: "building", availableCredits: 500 }), "balance-funded");
assert.equal(deriveWalletResidue({ preview: false, payoutState: "ready", availableCredits: 500 }), "payout-ready");
assert.equal(deriveWalletResidue({ preview: false, payoutState: "processing", availableCredits: 500 }), "payout-processing");
assert.equal(deriveWalletResidue({ preview: false, payoutState: "paid", availableCredits: 0 }), "payout-paid");

assert.equal(deriveProgressResidue({ preview: true, signedIn: true, stage: "Circuit" }), "none");
assert.equal(deriveProgressResidue({ preview: false, signedIn: false, stage: "Circuit" }), "none");
assert.equal(deriveProgressResidue({ preview: false, signedIn: true, stage: "Spark" }), "rank-spark");
assert.equal(deriveProgressResidue({ preview: false, signedIn: true, stage: "Circuit" }), "rank-circuit");
assert.equal(deriveProgressResidue({ preview: false, signedIn: true, stage: "Resonance" }), "rank-resonance");

assert.equal(deriveNetworkResidue({ signedIn: false, active: 2, waiting: 3 }), "none");
assert.equal(deriveNetworkResidue({ signedIn: true, active: 0, waiting: 3 }), "network-waiting");
assert.equal(deriveNetworkResidue({ signedIn: true, active: 2, waiting: 3 }), "network-active");
assert.equal(deriveNetworkResidue({ signedIn: true, active: 0, waiting: 0 }), "none");

console.log("Product experience state matrix PASS");
