# Reward Exchange architecture

Reward Pulse is evolving from a single-provider reward site into a reward exchange: a server-authoritative intermediary that can normalize inventory, rank opportunities, selectively subsidize rewards, and settle verified user value through one ledger.

## Invariants

1. The existing ledger remains the only user-balance authority.
2. Provider callbacks remain server-verified and idempotent.
3. Treasury subsidy is never presented unless budget is actually reserved.
4. Provider inventory is normalized before ranking; provider brands are implementation details, not the user experience.
5. Reward ranking must consider expected user value, time, completion probability, tracking reliability, payout reliability and reversal risk.
6. No synthetic users, earnings, payouts, scarcity or social proof.
7. New providers are adapters, not rewrites.

## Target flow

```text
provider/direct campaign
        ↓
provider adapter
        ↓
normalized opportunity catalog
        ↓
reward score / router
        ↓
optional treasury boost reservation
        ↓
user action
        ↓
verified provider/direct event
        ↓
authoritative ledger
        ↓
withdrawal provider
```

## Treasury

The treasury is a controlled acquisition/retention budget, not a replacement for provider revenue. It has funded, reserved and spent accounting, daily and per-user limits, and a kill switch. A boost may only be advertised after an atomic reservation succeeds.

## Rollout

Phase 1: treasury foundation, normalized contracts, provider registry, reward score.
Phase 2: ingest API-capable providers into the normalized catalog.
Phase 3: personalized routing and reward passport.
Phase 4: creator distribution and direct campaign marketplace.
