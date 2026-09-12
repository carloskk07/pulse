# Pulse Direct v1

Pulse Direct is the owned-inventory path for advertiser-funded, verified actions. It is intentionally operator-controlled in v1: no advertiser can self-publish or create spend authority from the public client.

## Economic contract

A campaign has four monetary values:

- `funded_usd_micros`: advertiser funding attested by a trusted operator.
- `reserved_usd_micros`: budget temporarily protected for users who started a Drop.
- `spent_usd_micros`: advertiser spend consumed by verified completions.
- `reward_credits`: user reward. 1,000 credits represent USD 1.00 inside the Pulse ledger model.

The database rejects campaigns where `price_per_action_usd_micros < reward_credits * 1000`. This protects against a negative gross contribution being configured accidentally. It does not claim to include taxes, payout fees, support, infrastructure, acquisition cost or other operating costs.

A campaign cannot activate unless available advertiser funding can cover at least one full action.

## Protected start

The user never goes directly from a public card to the advertiser.

```text
Pulse Drop
   ↓
GET /api/direct/start?campaign=<campaign-id>
   ↓
authenticated Pulse user
   ↓
atomic campaign budget reservation
   ↓
pseudonymous pulse_session_id created
   ↓
HTTPS redirect to advertiser
```

The advertiser receives only:

- `pulse_session_id`
- `pulse_campaign_id`

The Pulse user id, email, balance and internal financial identity are not appended to the destination URL.

The default session reservation lasts 60 minutes. Expired reservations return to campaign availability.

## Advertiser callback

Endpoint:

```text
POST /api/direct/callback
Authorization: Bearer <campaign callback secret>
Content-Type: application/json
```

Body:

```json
{
  "campaignId": "uuid",
  "sessionId": "uuid",
  "externalEventId": "advertiser-unique-event-id",
  "occurredAt": "2026-09-12T20:00:00Z",
  "metadata": {
    "optional": "non-secret advertiser context"
  }
}
```

The callback secret is generated when the campaign is created and is returned once to trusted server-side operator tooling. Only its SHA-256 digest is stored in `direct_campaigns`.

Do not put the callback secret in browser code, campaign URLs, screenshots, analytics, support tickets or client-side storage.

## Atomic settlement

A valid callback runs `settle_direct_campaign_completion(...)` as a single database transaction.

It verifies:

1. campaign exists;
2. callback secret matches;
3. session belongs to the campaign;
4. session is still reserved and unexpired;
5. event id was not already used;
6. reserved campaign budget exists.

Then, atomically:

```text
campaign reserved budget ↓
campaign spent budget ↑
completion count ↑
monetization event created
ledger reward created
session confirmed
direct event audit row created
```

If one write fails, the transaction fails as a unit.

Repeating the same callback for the same confirmed session/event returns `idempotent` and does not credit the user twice.

## Campaign lifecycle

```text
DRAFT
  ↓ operator verifies advertiser money
FUNDED
  ↓ operator activates
ACTIVE
  ↓
RESERVED USER SESSIONS
  ↓ verified callbacks
SETTLED COMPLETIONS
  ↓
EXHAUSTED / COMPLETED / PAUSED
```

Funding is recorded separately in `direct_campaign_funding` with an operator-supplied funding reference for auditability.

Campaigns automatically stop exposing their normalized opportunity when the completion cap or available funding can no longer cover another complete action.

## Reversal authority

`reverse_direct_campaign_completion(...)` exists only under service-role authority for operator-confirmed fraud or invalid completion. It creates the corresponding negative monetization and ledger entries and pauses the opportunity for review.

Advertisers do not receive a public reversal endpoint in v1. A direct campaign is prefunded and should confirm only after its own action criteria are satisfied.

## Referral isolation

Pulse Direct conversions do not automatically trigger the legacy referral subsidy. This is deliberate: referral bonuses remain outside direct campaign economics until Pulse has a unified liability authority that can fund them explicitly.

## Security model

All Pulse Direct campaign, funding, session and event tables have RLS enabled and no `anon` or `authenticated` read/write grants. Campaign mutation and settlement RPCs are service-role only.

The public surface contains only:

- authenticated protected-start route;
- secret-authenticated callback route;
- normalized opportunity presentation.

## v1 boundary

Pulse Direct v1 does **not** include:

- public advertiser self-service;
- automatic card/bank collection;
- advertiser-accessible dashboards;
- arbitrary JavaScript conversion pixels;
- client-side completion claims;
- automatic KYC/AML decisions;
- random rewards or prize mechanics.

Those should be added only when real advertiser demand proves which capabilities are necessary.
