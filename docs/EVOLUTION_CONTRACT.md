# Reward Pulse Evolution Contract

The product must evolve without recurring rewrites.

## Non-negotiable invariants

1. The ledger is authoritative. Balances are derived, never hand-edited as the source of truth.
2. Financial/provider callbacks are idempotent.
3. Provider-specific behavior is isolated behind adapters.
4. Economic thresholds and reward shares are configuration, not scattered constants.
5. Database changes are additive by default. Destructive migrations require explicit justification and rollback notes.
6. New product behavior ships behind a reversible flag when it can affect rewards, risk or payouts.
7. Client code never holds service-role or payout-provider secrets.
8. A UI success state never outruns server-side financial truth.
9. Existing working flows must be regression-tested before promotion.
10. Complexity is admitted only after a measured bottleneck proves the need.

## Evolution order

Evidence → bottleneck → smallest durable change → test → compare → keep/revise/revert.
