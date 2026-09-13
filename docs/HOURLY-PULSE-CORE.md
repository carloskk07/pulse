# Hourly Pulse Core

## Product thesis

Pulse is not an offerwall. The base product is a recurring, treasury-backed reward rhythm. External CPA supply is optional Turbo inventory and must never control whether the core product exists.

The launch loop is:

`FUNDED PULSE → CLAIM → RETURN → TRUST → OPTIONAL TURBO → WALLET → PAYOUT → PUBLIC PROOF`

Future sponsored rewards and Pulse Direct may add supply, but they are not launch prerequisites.

## Financial contract

A base Hourly Pulse may be credited only when all of the following are true:

- the user is authenticated;
- Turnstile succeeds for the `hourly_pulse` action;
- the rolling interval from the previous successful claim has elapsed;
- the account risk score is within the configured claim policy;
- the configured treasury exists, is enabled and its kill switch is open;
- the treasury has real unspent credits available;
- the daily treasury budget remains within limit;
- the per-user daily budget remains within limit.

Claim settlement is atomic in `claim_hourly_pulse()`: treasury spending, `pulse_claims` evidence and the `pulse_reward` ledger entry commit together or none of them commit.

The legacy `/api/daily-pulse` financial path is retired so it cannot bypass treasury controls.

## Rolling interval

Eligibility is measured from the timestamp of the previous successful Hourly Pulse claim. It is not based on the wall-clock hour. This prevents a user from claiming at 10:59 and again at 11:00.

Initial config is intentionally conservative and does not fund the treasury:

- reward: 1 credit;
- interval: 60 minutes;
- treasury: `launch`;
- maximum claim risk score: 59.

The migration does **not** add funded credits, enable the treasury or open the kill switch. Real budget must be explicitly authorized before the first production claim.

## Pulse Trust

Pulse Trust is derived from real behavior rather than profile claims. Current evidence inputs include:

- valid Hourly Pulse history;
- active days;
- confirmed monetization conversions;
- completed paid withdrawals;
- chargebacks/reversals;
- current risk score.

The public UI exposes the resulting trust level, not the exact anti-abuse thresholds.

## Turbo

Turbo is optional extra earning. Partner CPA, direct campaigns and future supply can live behind the same interface. A browser click or redirect is never sufficient authority to create a Turbo reward. Provider or direct settlement evidence remains mandatory.

## Referrals

Referral rewards are quality-gated. A signup alone creates no reward. The current rule qualifies after the invitee's first confirmed monetization conversion and reverses linked referral rewards if that qualifying conversion is charged back.

## Pulse Proof

`/proof` reads only aggregate production facts through a server-only RPC. It deliberately distinguishes:

- Hourly Pulse rewards credited to the ledger;
- confirmed Turbo conversions;
- withdrawals actually marked paid by the payout flow.

Zero is a valid value. No demo user, fake payout or synthetic event may be inserted to make proof metrics appear stronger.

## PRODUCT_READY

A specific offerwall provider is no longer a core release dependency. PRODUCT_READY requires:

1. production auth configured;
2. production Turnstile configured and proven;
3. valid Hourly Pulse config;
4. real funded/open treasury;
5. at least one real treasury-backed Hourly Pulse claim;
6. fully configured payout pack;
7. at least one controlled real paid withdrawal with current FaucetPay evidence.

Turbo monetization is economically important but is not allowed to redefine whether the base Pulse product functions.

## Future layers, not current launch scope

- Sponsored Pulse / Boost Hours;
- Community Boosts;
- publisher embed/SDK;
- advertiser self-service;
- Pulse Network auctioning;
- multiple CPA providers.

These layers should be activated only after the base loop proves retention, fraud control and real payout settlement.