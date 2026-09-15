# Pulsercuit

Pulsercuit is a mobile-first recurring reward network built around a transparent financial core, factual progress and incremental evolution.

## Product thesis

Pulsercuit is not a banner-funded faucet and it is not an offerwall with a new skin. The recurring Pulse is the product rhythm. It opens only when the server-authoritative Treasury can support it. Turbo is optional monetization, Trust reflects legitimate product history, and Proof separates credited activity from completed payouts and external receipt evidence.

The core promise is simple:

> Return. Pulse. Build your rhythm. Turbo only when you choose.

## Product rails

- **Pulse** — recurring Treasury-backed reward rail.
- **Turbo** — optional external/direct monetization opportunities.
- **Trust** — progressive reputation derived from real product history.
- **Proof** — public factual product evidence.
- **Wallet** — authoritative balance, settlement and withdrawal surface.
- **Invite** — quality-gated referral growth.
- **Circuit Signal** — non-financial progress derived from real product history.
- **Progress** — factual recap, achievements and community context.

## Current architecture

- Next.js App Router with the Pulsercuit V7 visual system.
- Hourly Pulse with rolling eligibility and Treasury gating.
- Append-only authoritative ledger and Wallet recovery contracts.
- Optional Turbo provider and Pulse Direct settlement rails.
- Public Proof backed by real production aggregates.
- Quality-gated referrals and deterministic achievements.
- Supabase Auth/Postgres/RLS with service-role-only trusted financial writes.
- Hosted password recovery with separate real-world proof authority.
- Cloudflare Turnstile for protected user actions.
- FaucetPay v2 split into read-only proof and separately scoped send authority.
- Provider-side payout evidence separated from actual destination-receipt evidence.
- Vercel production hosting through GitHub Actions prebuilt deployment.

One application, one authoritative database and a deliberately small operational surface. No microservice split is required for the current product stage.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Then visit `http://localhost:3000`.

`.env.example` is the configuration contract. Never expose service-role, payout, callback, anti-bot or deployment credentials to the browser or repository.

## Validation

```bash
npm run verify:legal
npm run verify:safety
npm run typecheck
npm run lint
npm run build
```

CI additionally audits the production dependency surface.

## Deployment strategy

`vercel.json` disables the automatic Vercel Git build path. GitHub Actions validates the repository, stamps the exact GitHub commit identity into the prebuilt artifact, pulls the production Vercel configuration, builds and deploys the artifact, aliases `pulsercuit.pro`, then requires the canonical domain to serve that exact commit before validating `/api/readiness`.

A successful build or deploy is not financial authorization. The release gate separately verifies live schema/runtime contracts and current external evidence.

## Financial invariants

- Ledger entries remain the monetary source of truth.
- Provider/direct settlement is idempotent.
- Trusted financial writes run server-side only.
- Browser/profile balances are non-authoritative.
- Withdrawals preserve idempotency through uncertain provider states.
- Pending / confirmed / available / withdrawn / reversed states remain explicit.
- Unfunded Pulse rewards stay closed.
- Treasury funding, enablement and safety limits require explicit authorization.
- FaucetPay read proof, provider payout and actual destination receipt are separate authorities.
- Historical payout recovery cannot prove a different current payout configuration.
- Circuit Signal, achievements and sharing never create monetary value.

## Launch discipline

Pulsercuit is not `PRODUCT_READY` until the provider-independent same-account chain is proven under the current contracts:

`funded Hourly Pulse → claim → ledger credit → Wallet → withdrawal debit → provider-paid FaucetPay withdrawal → actual destination receipt`.

Optional Turbo monetization can add economics, but it cannot substitute for or fabricate that base-product proof chain.

Treasury opening, FaucetPay send authority and controlled real-money testing remain explicit gates. See `docs/RELEASE_READINESS.md`, `docs/PRODUCT-READINESS-GATE.md` and `docs/FAUCETPAY_SETUP.md`.
