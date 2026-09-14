# Pulsercuit

Pulsercuit is a mobile-first recurring reward network built around a transparent financial core, factual progress and incremental evolution.

## Product thesis

Pulsercuit is not a banner-funded faucet and it is not an offerwall with a new skin. The recurring Pulse is the product rhythm. It opens only when the server-authoritative treasury can support it. Turbo is optional monetization, Trust reflects legitimate product history, and Proof separates credited activity from completed payouts.

The core promise is simple:

> Return. Pulse. Build your rhythm. Turbo only when you choose.

## Product rails

- **Pulse** — recurring treasury-backed reward rail.
- **Turbo** — optional external monetization opportunities.
- **Trust** — progressive legitimate-user reputation.
- **Proof** — public factual product evidence.
- **Wallet** — balance, settlement and withdrawal surface.
- **Invite** — quality-based referral growth.
- **Circuit Signal** — non-financial progress derived from real product history.
- **Progress** — factual recap, achievements and community context.

## Current build

- Pulsercuit V4 visual and brand system.
- Responsive marketing, authentication and app surfaces.
- Hourly Pulse with rolling eligibility and treasury gating.
- Circuit Signal, rhythm milestones and deterministic achievements.
- Optional Turbo provider integration.
- Public Proof with real reward and withdrawal aggregates.
- Transparent wallet and append-only ledger UX.
- Quality-gated referrals tied to verified activity.
- Supabase Auth/Postgres/RLS with idempotent financial writes.
- Cloudflare Turnstile verification.
- Vercel production hosting with Cloudflare DNS/security in front.
- Netlify retained as a temporary fallback/preview path.

## Architecture

```text
Next.js App Router
  ├─ Pulsercuit product UI
  │   ├─ Pulse
  │   ├─ Circuit Signal / Progress
  │   ├─ Turbo
  │   ├─ Trust / Proof
  │   └─ Wallet / Invite
  ├─ Reward Core
  │   ├─ ledger
  │   ├─ treasury + eligibility
  │   ├─ economy rules
  │   └─ risk rules
  ├─ provider adapters
  │   ├─ monetization
  │   └─ payout
  └─ PostgreSQL / Supabase
```

One application, one authoritative database and a deliberately small operational surface. No microservice split is required for the current product stage.

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

## Deployment strategy

Production is intentionally moving away from Vercel's automatic Git build path. `vercel.json` disables automatic Git deployments so that a validated external CI pipeline can build the Vercel output on GitHub Actions and upload the prebuilt artifact to production. This avoids consuming Vercel build capacity for every repository push while preserving the Vercel runtime and `pulsercuit.pro` domain.

The repository deployment credential is configured in GitHub Actions. The checked-in `vercel-prebuilt.yml` now remains gated on one successful controlled production deployment and canonical health check before this path is considered proven.

## Environment variables

See `.env.example`. Never expose service-role, payout, callback, anti-bot or deployment credentials to the browser or repository.

## Financial invariants

- Ledger entries remain the source of truth.
- Provider events are idempotent.
- Callback writes run server-side only.
- Browser/profile balances are non-authoritative.
- Withdrawals use idempotency keys.
- Pending / confirmed / available / withdrawn / reversed states remain explicit.
- Unfunded Pulse rewards stay closed.
- Circuit Signal, achievements and sharing never create monetary value.

## Launch discipline

Pulsercuit is not `PRODUCT_READY` until real external earning and payout evidence exists. Treasury funding/opening, FaucetPay activation and real payout tests are separate controlled gates and are not implied by visual or retention work.
