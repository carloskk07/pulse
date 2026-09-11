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
https://YOUR_DOMAIN/api/providers/ayet/callback?callback_type={callback_type}&transaction_id={transaction_id}&external_identifier={external_identifier}&payout_usd={payout_usd}&currency_amount={currency_amount}&is_chargeback={is_chargeback}&callback_ts={callback_ts}&event_name={event_name}&task_uuid={task_uuid}
```

The endpoint validates `X-Ayetstudios-Security-Hash` with HMAC-SHA256 using the publisher API key. Do not place the API key in the callback URL.

## Authority rules

- `external_identifier` must be the authenticated Supabase user UUID.
- Browser activity never changes a balance.
- The signed provider callback is the conversion authority.
- `transaction_id` is the idempotency identity.
- Chargebacks reverse the exact original Reward Pulse credit rather than recalculating today's reward share.
- Invalid signatures never write financial state.
- Orphan chargebacks return a retryable error so an out-of-order conversion can arrive first.

## Database

Apply migrations in order through `0003_monetization_callbacks.sql` before enabling the callback in ayeT.
