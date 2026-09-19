# Release readiness gate

Pulsercuit must not be promoted to a real-money production state merely because the application builds. The release gate separates static configuration, database/runtime contracts and external evidence bound to the current configuration.

## States

- `SETUP_REQUIRED`: at least one blocking configuration, schema or runtime contract is missing.
- `READY_FOR_EXTERNAL_PROOF`: automated setup/contracts pass, but one or more required external proofs are incomplete.
- `READY`: every blocking automated check and every required external proof passes for the current configuration.

The public endpoint `/api/readiness` exposes only the aggregate state and returns HTTP 200 only for `READY`. It never exposes secret names, secret values, database errors or provider details. Detailed release checks remain in the authenticated admin surfaces.

## Required schema

Apply migrations in order through `0047_faucetpay_payout_pack_authority.sql` and require the live `release_schema` marker to be at least v47.

Schema version alone is not sufficient. The runtime verifies the security, authenticated read-scope, Wallet recovery, withdrawal settlement, exact FaucetPay payout→receipt proof chain, Reward Exchange, Opportunity Intelligence, Pulse Direct, business-intake and advertiser-outbound contracts against the live database. The Hourly Pulse pilot gate separately requires `release_hourly_pulse_pilot_contract()` to pass under schema v36 or later before aggregate readiness can advance beyond `SETUP_REQUIRED`. The security contract must inspect the current `claim_hourly_pulse(uuid)` RPC, prove that `anon`/`authenticated` cannot execute it, prove that `service_role` can execute it, and require that the RPC remains `SECURITY INVOKER`.

The authenticated read-scope contract separately proves that own-row policies for profiles, ledger, claims, Hourly Pulse history, referrals, support and withdrawals have not widened; `user_balances` remains a `security_invoker` view; sensitive `risk_score` and financial ledger metadata are not client-readable; and no direct public-table write privilege has leaked to `anon` or `authenticated`.

The withdrawal settlement contract separately proves that withdrawal idempotency remains unique, only one active withdrawal can exist per user, settlement RPC authority remains restricted to `service_role`, and no row may be promoted to `paid` without a non-empty provider `external_id`. A paid withdrawal is terminal, its provider reference is immutable, and the same `(payout_provider, external_id)` cannot back two paid withdrawals.

Schema v40 adds a second local authority before any external send: `claim_withdrawal_dispatch()` obtains a row lock and grants a time-bounded dispatch lease to only one execution at a time. The lease persists `dispatch_claimed_at` and increments `dispatch_attempts`; concurrent or too-early retries receive `dispatch=false` and cannot call FaucetPay. After the lease window a recovery attempt may acquire a new lease, but it must reuse the withdrawal's original persisted idempotency key. Provider-side idempotency therefore remains a second line of defense rather than the sole duplicate-send control.

The FaucetPay proof-chain contract adds another authority boundary. Generic release evidence cannot create `faucetpay_payout`. Provider-side payout evidence is recorded only after the runtime re-reads one exact `paid` FaucetPay withdrawal, and its fingerprint binds the current payout configuration, withdrawal id, provider payout id, asset, credits, provider units and a hash of the destination. Actual-receipt evidence must then reference the same exact withdrawal id and derives from that exact payout fingerprint. A stale cockpit form also carries the displayed withdrawal id and is rejected if the current payout authority changed before confirmation.

Schema v43 adds a separate backed Treasury funding authority. Schema v44 hardens that authority by recomputing internal liabilities under the Treasury row lock: positive available/pending user balances, active withdrawals and active Treasury reservations. Schema v45 removes overfunding and backing undercount: funding is only the exact uncovered portion of the current UTC-day budget, and the live FaucetPay balance must cover **all current liabilities plus all Treasury capacity remaining spendable after the top-up**. Stale liability and funding-gap snapshots are rejected before funding. Schema v46 adds a 15-minute on-demand external-backing observation. Eligible claims use the cached observation while it is current; when it expires, the server refreshes FaucetPay through the read-only key before crediting again. The database independently recomputes current exposure and a `BEFORE INSERT` guard on `pulse_claims` rejects stale, mismatched or insufficient observations even if a caller bypasses the normal route. Schema v47 moves payout-pack conversion authority fully into the database: the observation RPC accepts only Treasury code + observed balance units, and asset/credits/provider-units are loaded from the canonical `faucetpay_payout_pack_authority`. Changing the payout pack therefore requires an intentional governed schema change instead of an environment-only edit. A funding event remains immutable and idempotent, and the backing/claim guard remains service-role only and `SECURITY INVOKER`.

The Reward Exchange contract also requires authoritative Treasury reservation accounting. Reservation TTL is not advisory: overdue `reserved` rows are transitioned to `expired`, their amount is released from `reserved_credits` before new capacity is evaluated, late finalize/consume is rejected as expired, and repeated idempotent requests reconcile their original reservation before reporting state. The contract fails if the Treasury's aggregate `reserved_credits` no longer equals the sum of authoritative `reserved` reservations.

Pulse Direct provider timestamps are evidence rather than independent financial authority. A settlement timestamp must be causally compatible with the live reserved session: it cannot predate the session beyond the bounded clock-skew allowance, cannot be materially future-dated, and cannot sit beyond the session expiry window. The same validated effective timestamp is written to both Direct and monetization event records, and the Pulse Direct runtime contract verifies that these guards remain present.

Hosted password-recovery evidence is also staged. A server-side proof challenge begins only after an authoritative PKCE/OTP recovery callback, a later password update must advance that exact source-matched unexpired challenge, and only a subsequent successful sign-in may finalize `password_recovery` evidence.

## Required external evidence

Evidence is fingerprint-bound to the configuration and causal object it proves. Changing an evidence-bound key, asset, payout pack, paid withdrawal, provider payout reference, legal/operator identity or other governed setting invalidates the corresponding proof automatically.

Blocking external evidence currently includes:

1. **Turnstile** — a successful protected production verification records current `turnstile` evidence.
2. **Supabase Auth hardening** — leaked-password protection must be enabled and the managed security warning cleared before `supabase_auth_hardening` evidence is recorded.
3. **Hosted password recovery** — a real recovery email, password change and later sign-in with the new password must complete for current `password_recovery` evidence.
4. **Legal policy review** — qualified review must match the current governed policy bundle and configured operator identity.
5. **International-transfer review** — evidence must match the current operator, governed policy bundle and configured external-provider set.
6. **FaucetPay read proof** — the read-only rail must prove the live asset, exact economic pack and provider unit scale before `faucetpay_read` is recorded.
7. **Exact FaucetPay payout proof** — one controlled withdrawal must reach authoritative provider-side paid status under the current proven payout authority, and the proof must bind that exact paid withdrawal.
8. **Same-withdrawal receipt proof** — destination receipt is a separate authority and must explicitly reference the same exact paid withdrawal already bound by the payout proof.

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
→ atomic withdrawal dispatch lease
→ exact paid FaucetPay withdrawal
→ payout proof bound to that withdrawal
→ actual destination receipt bound to that same withdrawal
→ same-account causal continuity
```

Provider payout evidence and actual destination-receipt evidence are distinct but causally chained. A recovered payout may be reconciled only with its original idempotency key and exact paid withdrawal; it cannot mint proof for another withdrawal or a different current payout pack.

## Promotion rule

Production promotion requires, at minimum:

```text
CI = PASS
exact canonical release SHA = PASS
/api/readiness = READY / HTTP 200
live schema marker >= 47
release_withdrawal_settlement_contract() = PASS
release_faucetpay_proof_chain_contract() = PASS
release_hourly_pulse_pilot_contract() = PASS
release_treasury_funding_contract() = PASS
release_treasury_backing_guard_contract() = PASS
all required runtime contracts = PASS
all blocking configuration checks = PASS
all required current-configuration external proofs = PASS
PRODUCT_READY = true
```

A successful build, deployment or provider call without those authorities is not production authorization.