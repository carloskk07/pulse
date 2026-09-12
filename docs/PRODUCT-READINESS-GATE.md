# Pulse Product Readiness Gate

Commercial outreach remains frozen until the consumer product is proven end-to-end.

## PRODUCT_READY requires all of the following

1. Public HTTPS application is healthy.
2. Authentication works with production Supabase configuration.
3. Turnstile is configured and has current controlled smoke evidence.
4. At least one real earning route is configured.
5. At least one earning callback has current controlled smoke evidence.
6. Reward settlement reaches the authoritative ledger without manual repair.
7. FaucetPay payout pack is fully configured, including exact provider units.
8. At least one controlled FaucetPay payout has current evidence.
9. Wallet/withdrawal recovery contracts remain green.
10. No fabricated offers, balances, payouts, users or activity are needed to make the product appear functional.

## Frozen until PRODUCT_READY

- advertiser outreach
- prospecting expansion
- public promotion of Pulse for Business
- paid acquisition
- creator acquisition
- additional marketplace features not required by the core earning loop

Business and outbound code may remain in the repository as dormant future capability. It must not become a blocking dependency for consumer product readiness.

## Core loop under test

account -> earn -> authoritative callback -> ledger credit -> wallet -> withdrawal -> payout

The next engineering campaign must attack the first failing step in that loop, not add a new commercial surface.
