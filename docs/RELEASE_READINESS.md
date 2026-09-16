# Release readiness gate

Pulsercuit must not be promoted to a real-money production state merely because the application builds. The release gate separates static configuration, database/runtime contracts and external evidence bound to the current configuration.

## States

- `SETUP_REQUIRED`: at least one blocking configuration, schema or runtime contract is missing.
- `READY_FOR_EXTERNAL_PROOF`: automated setup/contracts pass, but one or more required external proofs are incomplete.
- `READY`: every blocking automated check and every required external proof passes for the current configuration.

The public endpoint `/api/readiness` exposes only the aggregate state and returns HTTP 200 only for `READY`. It never exposes secret names, secret values, database errors or provider details. Detailed release checks remain in the authenticated admin surfaces.

## Required schema

Apply migrations in order through `0038_withdrawal_settlement_integrity.sql` and require the live `release_schema` marker to be at least v38.

Schema version alone is not sufficient. The runtime verifies the security, authenticated read-scope, Wallet recovery, withdrawal settlement, Reward Exchange, Opportunity Intelligence, Pulse Direct, business-intake and advertiser-outbound contracts against the live database. The Hourly Pulse pilot gate separately requires `release_hourly_pulse_pilot_contract()` to pass under schema v36 or later before aggregate readiness can advance beyond `SETUP_REQUIRED`. The security contract must inspect the current `claim_hourly_pulse(uuid)` RPC, prove that `anon`/`authenticated` cannot execute it, prove that `service_role` can execute it, and require that the RPC remains `SECURITY INVOKER`.

The authenticated read-scope contract separately proves that own-row policies for profiles, ledger, claims, Hourly Pulse history, referrals, support and withdrawals have not widened; `user_balances` remains a `security_invoker` view; sensitive `risk_score` and financial ledger metadata are not client-readable; and no direct public-table write privilege has leaked to `anon` or `authenticated`.

The withdrawal settlement contract separately proves that withdrawal idempotency remains unique, only one active withdrawal can exist per user, settlement RPC authority remains restricted to `service_role`, and no row may be promoted to `paid` without a non-empty provider `external_id`. A paid withdrawal is terminal, its provider reference is immutable, and the same `(payout_provider, external_id)` cannot back two paid withdrawals. The FaucetPay v2 retry path therefore reuses the original persisted idempotency key instead of creating a second withdrawal authority.

The Reward Exchange contract also requires authoritative Treasury reservation accounting. Reservation TTL is not advisory: overdue `reserved` rows are transitioned to `expired`, their amount is released from `reserved_credits` before new capacity is evaluated, late finalize/consume is rejected as expired, and repeated idempotent requests reconcile their original reservation before reporting state. The contract fails if the Treasury's aggregate `reserved_credits` no longer equals the sum of authoritative `reserved` reservations.

Pulse Direct provider timestamps are evidence rather than independent financial authority. A settlement timestamp must be causally compatible with the live reserved session: it cannot predate the session beyond the bounded clock-skew allowance, cannot be materially future-dated, and cannot sit beyond the session expiry window. The same validated effective timestamp is written to both Direct and monetization event records, and the Pulse Direct runtime contract verifies that these guards remain present.

Hosted password-recovery evidence is also staged. A server-side proof challenge begins only after an authoritative PKCE/OTP recovery callback, a later password update must advance that exact source-matched unexpired challenge, and only a subsequent successful sign-in may finalize `password_recovery` evidence.

## Required external evidence

Evidence is fingerprint-bound to the configuration it proves. Changing an evidence-bound key, asset, payout pack, legal/operator identity or other governed setting invalidates the old proof automatically.

Blocking external evidence currently includes:

1. **Turnstile** — a successful protected production verification records current `turnstile` evidence.
2. **Supabase Auth hardening** — leaked-password protection must be enabled and the managed security warning cleared before `supabase_auth_hardening` evidence is recorded.
3. **Hosted password recovery** — a real recovery email, password change and later sign-in with the new password must complete for current `password_recovery` evidence.
4. **Legal policy review** — qualified review must match the current governed policy bundle and configured operator identity.
5. **International-transfer review** — evidence must match the current operator, governed policy bundle and configured external-provider set.
6. **FaucetPay read proof** — the read-only rail must prove the live asset, exact economic pack and provider unit scale before `faucetpay_read` is recorded.
7. **FaucetPay payout proof** — one controlled withdrawal must reach authoritative provider-side paid status under the current proven payout authority.
8. **Actual receipt proof** — destination receipt is a separate authority and must be explicitly bound to the exact paid FaucetPay withdrawal.

Optional Turbo-provider evidence is tracked separately when a provider is configured. It does not gate the provider-independent base Pulse product.

The formal legal-operator identity is currently deferred from the technical-readiness scope. `DEFERRED` is not equivalent to completed legal review or public-launch approval.

## Financial authority separation

A green external provider response is never enough by itself to create `PRODUCT_READY`.

The relevant authorities are intentionally separate:

```text
configuration
→ database/runtime contracts
→ read-only FaucetPay unit proof
→ real funded/open Treasury
→ current Hourly Pulse claim
→ authoritative Wallet ledger
→ provider-side FaucetPay payout
→ exact destination receipt
→ same-account causal continuity
```

Provider payout evidence and actual destination-receipt evidence are distinct. A recovered historical payout may be reconciled with its original idempotency key, but it cannot mint proof for a different current payout pack.

## Promotion rule

Production promotion requires, at minimum:

```text
CI = PASS
exact canonical release SHA = PASS
/api/readiness = READY / HTTP 200
live schema marker >= 38
release_withdrawal_settlement_contract() = PASS
release_hourly_pulse_pilot_contract() = PASS
all required runtime contracts = PASS
all blocking configuration checks = PASS
all required current-configuration external proofs = PASS
PRODUCT_READY = true
```

A successful build, deployment or provider call without those authorities is not production authorization.