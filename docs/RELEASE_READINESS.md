# Release readiness gate

Reward Pulse must not be promoted to a real-money production state merely because the application builds. The release gate separates configuration, database contracts and external provider evidence.

## States

- `SETUP_REQUIRED`: at least one blocking configuration or database contract is missing.
- `READY_FOR_EXTERNAL_PROOF`: all automated checks pass, but controlled external smoke evidence is incomplete.
- `READY`: automated checks pass and all required external smoke evidence matches the current configuration.

The public endpoint `/api/readiness` exposes only the aggregate state and returns HTTP 200 only for `READY`. It never exposes secret names, secret values, database errors or provider details. The detailed checklist is available only in the authenticated `/admin` cockpit.

## Required migration

Apply migrations in order through `0007_release_readiness.sql`. Migration 0007 writes an explicit schema marker and creates the server-only evidence recorder.

## Automatic external proof

Evidence is created by the real server flows, not by a manual checkbox:

1. A successful Turnstile verification in a protected Daily Pulse or withdrawal flow records `turnstile` evidence.
2. A valid signed ayeT conversion callback that is credited or safely deduplicated records `ayet_callback` evidence.
3. A FaucetPay payout that reaches the local `paid` finalization records `faucetpay_payout` evidence.

Each evidence row stores only a SHA-256 fingerprint of the configuration that was proven. Secret values are never written to the database. If a key, adslot, payout amount, currency or other evidence-bound setting changes, the runtime fingerprint changes and the old proof becomes invalid automatically. The gate then returns to `READY_FOR_EXTERNAL_PROOF` until that flow is proven again.

## Promotion rule

Production promotion requires all of the following:

```text
CI = PASS
/api/readiness = READY / HTTP 200
admin economics RPC = callable
latest schema marker >= 7
current Turnstile fingerprint = proven
current ayeT callback fingerprint = proven
current FaucetPay payout fingerprint = proven
```

A green build without these release checks is not a production authorization.
