# Pulsercuit

Pulsercuit is a mobile-first recurring reward network built around a treasury-backed Pulse, optional Turbo earning, factual progress and public proof.

## Product thesis

Pulsercuit is not an offerwall with a faucet attached. The **Pulse** is the recurring product loop: return when the rolling window opens, claim only when the reward treasury is genuinely funded, build real history, and use **Turbo** only when extra earning is worth it.

The product keeps financial truth separate from engagement mechanics:

- **Pulse** — deterministic recurring reward governed by eligibility, verification and treasury authority.
- **Turbo** — optional provider-backed earning.
- **Trust** — server-side reputation and risk history.
- **Circuit Signal** — display-only, non-financial progress derived from real product history.
- **Proof** — public production facts with credited rewards separated from provider-completed payouts.
- **Wallet** — authoritative balance and withdrawal state.
- **Invite** — quality-oriented referrals that require verified activity rather than raw registrations.

## Current product surfaces

- Pulsercuit marketing landing and PWA metadata
- Account creation and sign-in with Cloudflare Turnstile
- Pulse dashboard with rolling eligibility and treasury-safe standby states
- Circuit Signal, factual missions, rhythm milestones and Progress hub
- Seven-day authenticated retention recap
- Factual achievements and community context
- Optional Turbo route
- Wallet and append-only ledger UX
- Quality-gated referrals and native sharing
- Pulsercuit Proof public evidence surface
- Support protocols, privacy, rewards policy and terms
- Admin readiness and operational surfaces

## Architecture

```text
Next.js App Router
  ├─ marketing + PWA UI
  ├─ Pulse experience
  │   ├─ rolling eligibility
  │   ├─ treasury authority
  │   ├─ factual progress
  │   └─ sharing / retention
  ├─ Reward Core
  │   ├─ append-only ledger
  │   ├─ idempotent claims
  │   ├─ withdrawal reservation/finalization
  │   └─ trust / risk controls
  ├─ provider adapters
  │   ├─ monetization
  │   └─ payout
  └─ PostgreSQL / Supabase with RLS
```

One application, one authoritative database and an incremental deployment model. Avoid introducing distributed complexity before it is justified by real scale.

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

See `.env.example`. Never expose service-role, payout, callback or anti-bot secrets to the browser. Public `NEXT_PUBLIC_*` configuration is intentionally separate from server authority.

## Financial invariants

- Ledger entries are the source of truth.
- Browser/profile balances are not financial authority.
- Provider events and claims are idempotent.
- Sensitive writes run server-side only.
- Unfunded Pulse rewards remain closed.
- Withdrawals reserve credits before provider submission.
- Ambiguous payout outcomes remain recoverable instead of being falsely finalized.
- Credited rewards and completed payouts remain separate facts.
- Circuit Signal, streaks, badges and achievements never create financial value.

## Launch discipline

Production readiness requires real external evidence. Treasury funding, payout activation and provider credentials are not inferred from polished UI or successful builds. The product remains in safe standby until each financial gate is explicitly validated.
