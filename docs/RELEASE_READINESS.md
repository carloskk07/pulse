# Release readiness gate

Reward Pulse must not be promoted to a real-money production state merely because the application builds. The release gate separates configuration, database contracts and external provider evidence.

## States

- `SETUP_REQUIRED`: at least one blocking configuration or database contract is missing.
- `READY_FOR_EXTERNAL_PROOF`: all automated checks pass, but controlled external smoke evidence is incomplete.
- `READY`: automated checks pass and all required external smoke evidence has been recorded.

The public endpoint `/api/readiness` exposes only the aggregate state and returns HTTP 200 only for `READY`. It never exposes secret names, secret values, database errors or provider details. The detailed checklist is available only in the authenticated `/admin` cockpit.

## Required migration

Apply migrations in order through:

```text
0007_release_readiness.sql
```

Migration 0007 writes an explicit schema marker and creates the external-proof record without overwriting evidence if the migration is re-applied.

## Controlled external proof

Do not mark a proof true until the corresponding real flow has completed successfully and its ledger/provider evidence has been inspected:

1. Turnstile: complete a protected signup, claim or withdrawal flow and confirm server verification.
2. ayeT: send one valid signed conversion callback and verify exactly one monetization event plus one ledger credit.
3. FaucetPay: complete one controlled payout and verify one withdrawal, one provider payout id and a persistent withdrawn ledger debit.

After all three are independently proven, update the proof record:

```sql
update public.app_config
set value = '{"turnstile":true,"ayet_callback":true,"faucetpay_payout":true}'::jsonb,
    version = version + 1,
    reason = 'Controlled external smoke evidence completed',
    updated_at = now()
where key = 'release_external_proof';
```

If any provider is rotated, materially reconfigured or fails reconciliation, set the corresponding proof back to `false` until a new controlled smoke test passes.

## Promotion rule

Production promotion requires all of the following:

```text
CI = PASS
/api/readiness = READY / HTTP 200
admin economics RPC = callable
latest schema marker >= 7
external proof = all true
```

A green build without these release checks is not a production authorization.
