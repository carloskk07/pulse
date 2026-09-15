# Hourly Pulse Core

## Product thesis

Pulse is the provider-independent, treasury-backed recurring reward rail. Turbo providers are optional inventory and do not determine whether the base product exists.

The core proof chain is:

`FUNDED PULSE → CLAIM → AUTHORITATIVE LEDGER → WALLET → PAYOUT → RECEIPT → PROOF`

## Claim authority

A claim can settle only when authentication and Turnstile pass, the rolling interval has elapsed, risk policy allows the account, and the configured Treasury is enabled, open, funded and inside both global and per-user limits.

`claim_hourly_pulse()` commits the Treasury spend, `pulse_claims` evidence and `pulse_reward` ledger entry atomically. The legacy `/api/daily-pulse` financial path is retired.

The default contract remains conservative: 1 credit, 60-minute rolling interval, Treasury `launch`, maximum claim risk score 59. Migrations do not fund or open that Treasury.

## Trust, Turbo and referrals

Trust is derived from real product history and private risk inputs. The UI exposes the trust result, not the anti-abuse inputs.

Turbo is optional extra earning. Browser activity alone never creates a Turbo reward; authoritative provider/direct settlement remains required.

Referral rewards are quality-gated. Signup alone creates no financial reward, and linked rewards remain reversible when their qualifying economic evidence is reversed.

## PRODUCT_READY

A specific offerwall provider is not a base-product dependency. Current `PRODUCT_READY` requires:

1. production auth and trusted server authority;
2. current Turnstile proof;
3. current Supabase Auth hardening and hosted password-recovery proofs;
4. valid Hourly Pulse contract;
5. real funded/open Treasury with positive safety limits;
6. a real claim matching the current reward, interval and Treasury;
7. a complete FaucetPay pack with current read-only unit proof;
8. a controlled provider-side paid withdrawal with current payout evidence;
9. actual destination receipt bound to that exact paid withdrawal;
10. same-account causal continuity from claim and claim-ledger credit through withdrawal-ledger debit, provider-paid state and receipt.

## Payout recovery

A `submitted` payout may already have reached the provider, so reconciliation preserves the original database values and idempotency key. A historical recovery may complete that original withdrawal, but current release evidence is recorded only when the recovered asset, credits and provider units still match the current read-proven payout configuration.

## Proof discipline

`/proof` reports factual production aggregates. Zero is valid. No demo user, fabricated balance, synthetic payout or fake activity may be inserted to improve proof metrics.

Future sponsored rewards, community boosts, publisher integrations, advertiser self-service and additional providers remain outside the base launch dependency graph.
