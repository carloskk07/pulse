# ayeT setup — minimal live monetization

Reward Pulse starts with one website Web Offerwall adslot. This keeps implementation and operations small while preserving server-authoritative rewards.

## Environment

Set:

```text
AYET_API_KEY=<publisher API key>
AYET_ADSLOT_ID=<website web-offerwall adslot id>
AYET_REWARD_SHARE_BPS=7000
```

`7000` means 70% of the provider USD payout is converted to user credits. Reward Pulse uses 1,000 credits = US$1 internally.

The ayeT adslot must advertise the same effective exchange rate that Pulse settles on the server:

```text
AYET_CURRENCY_CONVERSION_RATE = 1000 * AYET_REWARD_SHARE_BPS / 10000
```

With the current default `AYET_REWARD_SHARE_BPS=7000`, configure the ayeT currency conversion rate as:

```text
1 USD = 700 credits
```

Do not configure `1 USD = 1000 credits` while Pulse settles only 70% to the user. That would make the offerwall promise a larger reward than the authoritative ledger credits.

For the MVP, keep ayeT currency sales / temporary currency multipliers disabled unless Pulse explicitly adds support for that mode. Any provider-side rate that no longer matches the server contract is rejected before it can create financial state.

## Callback URL

Configure a conversion callback in the ayeT publisher dashboard using your real public domain and these macros:

```text
https://YOUR_DOMAIN/api/providers/ayet/callback?callback_type={callback_type}&transaction_id={transaction_id}&external_identifier={external_identifier}&payout_usd={payout_usd}&currency_amount={currency_amount}&currency_conversion_rate={currency_conversion_rate}&is_chargeback={is_chargeback}&callback_ts={callback_ts}&adslot_id={adslot_id}&event_name={event_name}&task_uuid={task_uuid}
```

The endpoint validates `X-Ayetstudios-Security-Hash` with HMAC-SHA256 using the publisher API key. Do not place the API key in the callback URL.

`adslot_id` is mandatory for Pulse even though ayeT exposes many callback macros. A valid HMAC proves that ayeT sent the callback, while the adslot match proves that the callback belongs to the exact earning route configured by `AYET_ADSLOT_ID`.

`currency_conversion_rate` is also mandatory. Pulse compares it with the rate derived from `AYET_REWARD_SHARE_BPS`. Missing or mismatched rates are rejected as `reward-rate-mismatch` before sandbox transport evidence or production ledger settlement can occur.

## Authority rules

- For production conversions, `external_identifier` must be the authenticated Supabase user UUID.
- Browser activity never changes a balance.
- The signed provider callback is the conversion authority.
- The callback `adslot_id` must exactly match `AYET_ADSLOT_ID`.
- The callback `currency_conversion_rate` must match the current server reward contract.
- `transaction_id` is the idempotency identity.
- Chargebacks reverse the exact original Reward Pulse credit rather than recalculating today's reward share. They are not blocked by a later reward-rate change.
- Invalid signatures, wrong/missing adslots, or reward-rate mismatches never write financial state.
- Orphan chargebacks return a retryable error so an out-of-order conversion can arrive first.
- ayeT sandbox callbacks are non-financial. After valid HMAC, adslot binding, reward-rate alignment and parsing, Pulse records a separate `ayet_transport` fingerprint so `/admin/product` can show that callback transport is wired correctly.
- A sandbox identifier does not need to be a real Supabase user UUID because sandbox callbacks can never touch the ledger or satisfy `PRODUCT_READY`.
- Duplicate production callbacks remain idempotent and do not refresh earning evidence. Current financial provider evidence is created only when a fresh production conversion is actually credited.

## Recommended proof sequence

1. Configure the ayeT adslot currency conversion rate to the server-derived value. With the current default, use `700` credits per US$1.
2. Add the callback URL above, including `{currency_conversion_rate}` and `{adslot_id}`.
3. Enable reversal/chargeback callbacks for the same placement before treating the integration as launch-ready.
4. Configure a sandbox identifier in ayeT and trigger one sandbox offer.
5. Confirm `/admin/product` reports that ayeT HMAC, adslot and reward-rate preflight are proven while **Real earning proof** remains blocked.
6. Open the live offerwall as a signed-in Pulse user so `externalIdentifier` is that user's Supabase UUID.
7. Complete one real payable action.
8. Confirm the callback created a confirmed monetization event, an available ledger entry and current `ayet_callback` evidence.

## Database

Apply migrations in order through `0019_ayet_transport_evidence.sql` before running the provider preflight.
