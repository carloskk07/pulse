# FaucetPay v2 payout setup

Reward Pulse uses the modern FaucetPay v2 scoped-key API. The first payout model is intentionally a fixed pack: internal credits are USD-denominated, so a fixed pack avoids introducing a price oracle, hidden FX spread, or volatile conversion logic into the MVP.

## Scoped key

Create a scoped API key in FaucetPay with only the permissions needed for this integration:

- `read` — used to verify a FaucetPay destination.
- `send` — used to execute payouts.

Set a conservative daily USD cap on the key. Store the key only in server-side environment variables.

## Environment

```text
FAUCETPAY_SCOPED_KEY=<scoped read+send key>
FAUCETPAY_PAYOUT_CURRENCY=USDT
FAUCETPAY_PAYOUT_CREDITS=5000
FAUCETPAY_PAYOUT_UNITS=<exact FaucetPay smallest-unit integer for the pack>
FAUCETPAY_PAYOUT_LABEL=5.00 USDT
```

The payout integration remains disabled until every required value is present. `FAUCETPAY_PAYOUT_UNITS` is intentionally not guessed by the code: confirm the exact smallest-unit semantics for the selected FaucetPay currency before enabling live withdrawals. The label is presentation only and must describe the same configured payout.

## Safety model

1. User is authenticated and Turnstile is verified server-side.
2. Before creating anything new, the server checks for an existing `requested`, `submitted` or `held` withdrawal.
3. If a recoverable withdrawal exists, the browser cannot change its destination, asset, credits or provider amount; the server reloads those values from PostgreSQL.
4. Recovery calls FaucetPay `/send` with the exact original idempotency key. A retry with that key must not create a second payout.
5. If no withdrawal is active, FaucetPay verifies the new destination and PostgreSQL atomically checks the ledger balance and reserves one fixed pack.
6. A single active withdrawal per user prevents double-submit races.
7. Success changes the reserve entry to `withdrawn` but it still counts against the balance.
8. A definitive failure on the initial provider attempt changes the reserve entry to `reversed`, restoring credits.
9. A transient or unknown initial failure keeps the reserve in `submitted` for recovery.
10. Once a withdrawal is already in an unknown/submitted recovery state, later retry failures never auto-refund it. Only a provider success using the original idempotency key closes it automatically; otherwise the reserve remains for safe operator investigation.
11. Users over the configured risk threshold are held before any external send.

The database, not the browser, is the financial authority. This recovery rule intentionally favors preventing double payment over prematurely returning an amount whose provider outcome is still unknown.
