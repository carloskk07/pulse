# ayeT setup — minimal live monetization

Reward Pulse starts with one website Web Offerwall adslot. This keeps implementation and operations small while preserving server-authoritative rewards.

## Environment

Set:

```text
AYET_API_KEY=<publisher API key>
AYET_ADSLOT_ID=<website web-offerwall adslot id>
AYET_REWARD_SHARE_BPS=7000
```

`7000` means 70% of the provider USD payout is converted to user credits. Reward Pulse uses 1,000 credits = US$1 internally. Change the share only after measuring conversion and contribution margin.

## Callback URL

Configure a conversion callback in the ayeT publisher dashboard using your real public domain and these macros:

```text
https://YOUR_DOMAIN/api/providers/ayet/callback?callback_type={callback_type}&transaction_id={transaction_id}&external_identifier={external_identifier}&payout_usd={payout_usd}&currency_amount={currency_amount}&is_chargeback={is_chargeback}&callback_ts={callback_ts}&adslot_id={adslot_id}&event_name={event_name}&task_uuid={task_uuid}
```

The endpoint validates `X-Ayetstudios-Security-Hash` with HMAC-SHA256 using the publisher API key. Do not place the API key in the callback URL.

`adslot_id` is mandatory for Pulse even though ayeT exposes many callback macros. A valid HMAC proves that ayeT sent the callback, while the adslot match proves that the callback belongs to the exact earning route configured by `AYET_ADSLOT_ID`.

## Authority rules

- `external_identifier` must be the authenticated Supabase user UUID.
- Browser activity never changes a balance.
- The signed provider callback is the conversion authority.
- The callback `adslot_id` must exactly match `AYET_ADSLOT_ID`.
- `transaction_id` is the idempotency identity.
- Chargebacks reverse the exact original Reward Pulse credit rather than recalculating today's reward share.
- Invalid signatures or wrong/missing adslots never write financial state.
- Orphan chargebacks return a retryable error so an out-of-order conversion can arrive first.
- ayeT sandbox callbacks may prove transport, HMAC and adslot wiring, but they never create ledger state and never record `PRODUCT_READY` earning evidence.
- Duplicate production callbacks remain idempotent and do not refresh earning evidence. Current provider evidence is created only when a fresh production conversion is actually credited.

## Database

Apply migrations in order through `0003_monetization_callbacks.sql` before enabling the callback in ayeT.
