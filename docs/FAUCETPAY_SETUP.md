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

1. User is authenticated.
2. Turnstile is verified server-side.
3. FaucetPay verifies the destination.
4. PostgreSQL atomically checks the available ledger balance and reserves one fixed pack.
5. A single active withdrawal per user prevents double-submit races.
6. FaucetPay v2 `/send` receives the database idempotency key.
7. Success changes the reserve entry to `withdrawn` but it still counts against the balance.
8. A definitive provider failure changes the reserve entry to `reversed`, restoring the credits.
9. A transient/unknown failure keeps the reserve and same idempotency key for a safe retry.
10. Users over the configured risk threshold are held before any external send.

The database, not the browser, is the financial authority.
