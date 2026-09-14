# FaucetPay v2 payout setup

Pulsercuit uses a fixed payout pack, but no payout amount is implied by the application. The pack is enabled only after its settlement asset, internal-credit amount, provider smallest-unit amount and display label are explicitly configured and proven against the live FaucetPay read rail.

## Least-privilege keys

Use two separate FaucetPay v2 scoped keys:

- `FAUCETPAY_READ_KEY` — **read only**. It is used for live `/currencies`, `/balance` and `/check-address` calls.
- `FAUCETPAY_SCOPED_KEY` — **send only**. It is used only for `/send` after the read-only contract has already been proven.

Do not combine read and send permissions merely for convenience. Put a conservative daily USD limit on the send-scoped key and keep both keys server-side only.

## Environment

```text
FAUCETPAY_READ_KEY=<read-only scoped key>
FAUCETPAY_SCOPED_KEY=<send-only scoped key; leave unset until read proof is closed>
FAUCETPAY_PAYOUT_CURRENCY=USDT
FAUCETPAY_PAYOUT_CREDITS=<explicit internal-credit amount>
FAUCETPAY_PAYOUT_UNITS=<exact FaucetPay smallest-unit integer for the same pack>
FAUCETPAY_PAYOUT_LABEL=<explicit human-readable amount and asset>
```

`FAUCETPAY_PAYOUT_CREDITS`, `FAUCETPAY_PAYOUT_UNITS` and `FAUCETPAY_PAYOUT_LABEL` have no production default. A missing value keeps the payout pack disabled and prevents a matching release-evidence fingerprint from existing.

## Economic parity before provider units

Pulsercuit internal credits are USD-denominated at `1000 credits = USD 1`. No crypto price oracle is authorized in the base product. Therefore the fixed payout pack currently accepts only nominal USD settlement assets:

- `USDT`
- `USDC`

A volatile asset such as BTC, ETH or SOL remains blocked even if FaucetPay supports it, because converting USD-denominated credits into that asset would require a separately designed and proven price-oracle contract.

For USDT/USDC, the human-readable label is part of the financial contract. The preflight requires:

`label amount × 1000 credits/USD = FAUCETPAY_PAYOUT_CREDITS`

Only after that equality is exact does it prove:

`label amount × live FaucetPay unit scale = FAUCETPAY_PAYOUT_UNITS`

Example: if an operator eventually chooses `0.010 USDT`, the credit side must be exactly `10` credits. The provider-unit integer must still come from live read evidence; this example does **not** assert a USDT unit multiplier or approve that pack for production.

## Read-only proof first

1. Create only the read-scoped key and configure the intended nominal USD stablecoin and candidate fixed pack.
2. Open `/admin/faucetpay` as an allowlisted operator.
3. The server calls only FaucetPay read-scope endpoints and must prove, in order: asset is live → asset is economically supported → label maps exactly to internal credits → provider smallest-unit scale is observable → provider units match the same label.
4. The preflight must reach `READ_ONLY_VERIFIED`.
5. Explicitly record the current `faucetpay_read` evidence from the private cockpit.
6. The evidence fingerprint is bound to a verifier-schema version, the read key, payout currency, credits, smallest-unit amount and label. Changing any of them makes the proof stale automatically.
7. Only after that proof is current should a separately scoped send key be configured for the controlled payout test.

No unit multiplier is guessed. If the live read response cannot authoritatively establish the asset scale, the preflight remains blocked.

## Withdrawal authority firewall

For a **new** withdrawal, the server requires all of the following before any balance reserve or `/send` attempt:

- authenticated user and successful Turnstile verification;
- explicit complete payout pack;
- current fingerprint-bound `faucetpay_read` evidence;
- destination validated through `/check-address` using the read-only key;
- sufficient authoritative ledger balance;
- withdrawal risk gate not placing the request on hold;
- send-scoped key available for the final provider call.

A `requested` withdrawal that has not yet reached an uncertain provider state must still match the current asset, credits and smallest-unit pack and still have current read evidence before it can be sent.

A `submitted` withdrawal is different: it may already have reached FaucetPay. Recovery must therefore preserve the original database values and original provider idempotency key even if the current pack or read-proof configuration later changes. Blocking reconciliation in that state could create a double-payment risk.

## Financial launch sequence

The read proof does not fund rewards, mint credits or authorize PRODUCT_READY. Keep the launch Treasury closed until an explicit bounded test budget is approved. The controlled sequence is:

`economic parity → live unit proof → fingerprinted read proof → explicit micro-Treasury budget → real Hourly Pulse claim → authoritative Wallet balance → send-scoped key → one controlled withdrawal → provider payout proof → actual receipt`

The database remains the financial authority. Configuration alone is never evidence that money moved.
