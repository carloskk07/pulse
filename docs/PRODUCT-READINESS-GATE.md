# Pulse Product Readiness Gate

Commercial scale remains frozen until the consumer product is proven end-to-end by the same authorities used by production.

## PRODUCT_READY requires all of the following

1. Production Supabase auth and trusted server authority are configured.
2. Turnstile is configured and has current controlled production evidence.
3. The application-level HIBP Pwned Passwords control has current fingerprint-bound hardening evidence.
4. Hosted password recovery has completed a real recovery → password update → later new-password sign-in proof.
5. The Hourly Pulse contract has a positive deterministic reward, rolling interval and Treasury binding.
6. The bound Treasury contains real funded credits, is explicitly enabled, has the kill switch open and has positive safety limits. New funding must be recorded through the idempotent funding authority after a read-only FaucetPay balance check proves current user liabilities plus the new daily budget are externally backed. Runtime readiness must cover the **remaining UTC-day budget**, using the same daily claim + reserved/consumed reservation accounting as `claim_hourly_pulse`; as today's budget is legitimately consumed, the funding requirement decreases with it and resets to the full daily budget at 00:00 UTC. Funding may add only the exact uncovered gap. The backing check must cover current user/withdrawal/reservation liabilities **plus every Treasury credit that remains spendable after the top-up**. The database recomputes both liability and funding-gap state under the Treasury lock and rejects stale snapshots. Claims additionally require a current external-backing observation: every claim first verifies that the stored FaucetPay read proof still matches the live application asset/pack/key fingerprint, then the normal route may reuse the observation for up to 15 minutes. It refreshes FaucetPay read-only only after expiry, and a database trigger refuses the financial insert if the observation is stale, bound to an old stored read proof, or below current internal exposure.
7. At least one real Treasury-backed Hourly Pulse claim matches the current reward, interval and Treasury contract.
8. FaucetPay has a fully configured fixed payout pack and current fingerprint-bound read-only unit proof.
9. At least one controlled withdrawal reaches authoritative provider-side `paid` status with current exact-withdrawal FaucetPay payout evidence; product readiness must use the same v3 payout authority as release readiness.
10. Actual spendable receipt at the destination is explicitly proven and bound to that exact paid withdrawal.
11. One same account has a causally consistent chain from current Hourly Pulse claim → authoritative claim ledger entry → later withdrawal ledger debit → paid FaucetPay withdrawal → matching destination receipt.
12. No fabricated offers, balances, payouts, users, claims or activity are needed to make the product appear functional.

A successful provider response alone is insufficient. Provider-side payout and destination receipt are separate authorities, and historical evidence is invalid when its fingerprint no longer matches the current configuration.

## Turbo is optional

Turbo monetization is economically useful but is not a prerequisite for the provider-independent base product. If a Turbo provider is configured, its callback evidence is tracked independently and must remain authoritative for any Turbo reward it creates, but a missing optional provider must not block the base Hourly Pulse → Wallet → FaucetPay loop.

## Frozen until PRODUCT_READY

- paid acquisition;
- creator acquisition;
- broad consumer promotion that implies proven payouts;
- advertiser scaling that depends on proven consumer liquidity;
- additional marketplace features not required to close the core loop.

Business and outbound code may remain in the repository as dormant capability. It must not fabricate consumer readiness or become a substitute for the core proof chain.

## Core loop under test

```text
account
→ funded Hourly Pulse
→ real claim
→ authoritative ledger credit
→ Wallet
→ withdrawal ledger debit
→ FaucetPay provider-paid state
→ actual destination receipt
```

The next engineering campaign must attack the first failing authority in that chain rather than add unrelated commercial surface area.
