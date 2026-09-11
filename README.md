# Reward Pulse

A premium, mobile-first rewards platform designed around transparent value, a ledger-first financial core, and incremental evolution.

## Product thesis

Reward Pulse is not a banner-funded faucet. The daily reward is a retention mechanism. Revenue comes from explicitly incentivizable rewarded actions such as surveys, offers and direct sponsor quests. The product ranks opportunities by expected contribution rather than headline payout.

## Current build

- Premium marketing landing page
- Responsive product preview
- App shell with Home / Earn / Wallet / Invite
- Daily Pulse + streak concept
- Offer quality/match surfaces
- Transparent wallet/ledger UX
- Referral milestones based on active referrals
- Economy helpers for contribution and payout ceilings
- Risk-band helper
- Provider adapter contracts
- Supabase core schema with RLS and idempotency constraints
- Health endpoint
- Evolution contract

## Architecture

```text
Next.js App Router
  ├─ marketing + PWA-ready UI
  ├─ Reward Core
  │   ├─ ledger
  │   ├─ economy rules
  │   └─ risk rules
  ├─ provider adapters
  │   ├─ monetization
  │   └─ payout
  └─ PostgreSQL / Supabase
```

One app, one database, one deployment. No microservices in V1.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Then visit `http://localhost:3000`.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```

## Environment variables

See `.env.example`. Never expose service-role, payout, callback, or anti-bot secrets to the browser.

## Financial invariants

- Ledger entries are the source of truth.
- Provider events are idempotent.
- Callback writes run server-side only.
- User balances are derived.
- Withdrawals use idempotency keys.
- Pending / confirmed / available / withdrawn / reversed states remain explicit.

## Next implementation slice

1. Supabase auth + profile bootstrap.
2. Server-side Turnstile verification.
3. First monetization adapter and signed callback verification.
4. Ledger posting transaction for confirmed conversions.
5. Daily Pulse transaction with one-claim-per-day guarantee.
6. Payout adapter + withdrawal state machine.
7. Admin economics dashboard fed by real events.
