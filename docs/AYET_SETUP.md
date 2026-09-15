# ayeT setup — optional Turbo monetization

ayeT is an optional Turbo monetization adapter. It is not a prerequisite for the provider-independent Hourly Pulse → Wallet → FaucetPay base loop and it does not determine `PRODUCT_READY` by itself.

When ayeT is enabled, rewards remain fully server-authoritative: browser activity never creates credit, and only a valid provider conversion callback may settle a Turbo reward.

## Environment

Set:

```text
AYET_API_KEY=<publisher API key>
AYET_ADSLOT_ID=<website web-offerwall adslot id>
AYET_REWARD_SHARE_BPS=7000
```

`7000` means 70% of the provider USD payout is converted to user credits. Pulsercuit uses 1,000 credits = USD 1 internally.

The ayeT adslot must advertise the same effective exchange rate that Pulsercuit settles on the server:

```text
AYET_CURRENCY_CONVERSION_RATE = 1000 * AYET_REWARD_SHARE_BPS / 10000
```

With `AYET_REWARD_SHARE_BPS=7000`, configure:

```text
Currency Conversion Rate: 1 USD = 700 credits
Currency Decimal Places:  0
```

The 0-decimal setting is part of this provider contract. Pulsercuit accepts only whole signed credits so the ledger can credit exactly what the Offerwall promised without inventing a separate rounding rule.

Do not configure `1 USD = 1000 credits` while the server settles a 70% share. Keep provider-side currency sales or temporary multipliers disabled unless a new economic contract is explicitly designed and proven.

## Callback URL

Configure the conversion callback with the real public domain and these macros:

```text
https://YOUR_DOMAIN/api/providers/ayet/callback?callback_type={callback_type}&transaction_id={transaction_id}&external_identifier={external_identifier}&payout_usd={payout_usd}&currency_amount={currency_amount}&currency_conversion_rate={currency_conversion_rate}&is_chargeback={is_chargeback}&callback_ts={callback_ts}&adslot_id={adslot_id}&event_name={event_name}&task_uuid={task_uuid}
```

The endpoint validates `X-Ayetstudios-Security-Hash` with HMAC-SHA256 using the publisher API key. Never place the API key in the callback URL.

`adslot_id`, `currency_conversion_rate` and `currency_amount` are mandatory for conversion authority:

- `adslot_id` must match `AYET_ADSLOT_ID` exactly;
- `currency_conversion_rate` must match the server reward contract;
- `currency_amount` must be a positive whole number;
- Pulsercuit credits that signed whole amount directly;
- the signed amount must remain within the provider's allowed whole-unit rounding of `payout_usd × configured rate`; larger economic drift is rejected.

The provider is authoritative for the reward value signed in its callback, while Pulsercuit remains authoritative for whether that reward may enter the ledger.

## Which ayeT test proves what

Use **Sandbox Identifier** for the provider transport/reward-contract preflight. Sandbox callbacks are explicitly non-financial and cannot satisfy `PRODUCT_READY`.

Do not use the standalone **Callback Tester** as `ayet_transport` authority. It is only a transport diagnostic and may populate synthetic economic fields that do not represent the live Offerwall contract.

```text
Callback Tester    = diagnostic only
Sandbox Identifier = ayet_transport authority
Real conversion    = ayet_callback authority for optional Turbo
```

## Authority rules

- Production `external_identifier` must be the authenticated Supabase user UUID.
- Browser activity never changes balance.
- The signed provider callback is the conversion authority.
- `adslot_id` must match `AYET_ADSLOT_ID`.
- `currency_conversion_rate` must match the current server contract.
- `currency_amount` must be a positive whole credit amount and becomes the exact ledger reward.
- `transaction_id` is the idempotency identity.
- Chargebacks reverse the original credited amount rather than recalculating today's reward share.
- Invalid signatures, missing/wrong adslots or economic mismatches never write financial state.
- Orphan chargebacks remain retryable so an out-of-order original conversion can arrive later.
- Sandbox callbacks remain non-financial even after transport validation.
- Duplicate production callbacks are idempotent and do not refresh current earning evidence.
- Current `ayet_callback` evidence is created only from a fresh production conversion that is actually credited under the current provider configuration.

## Recommended optional-provider proof sequence

1. Configure the adslot exchange rate to match `AYET_REWARD_SHARE_BPS` and set Currency Decimal Places to 0.
2. Add the callback URL with the required economic and placement macros.
3. Keep provider-side multipliers disabled unless explicitly modeled.
4. Enable reversal/chargeback callbacks.
5. Run one Sandbox Identifier flow and confirm `ayet_transport` preflight evidence without financial writes.
6. If Turbo is being activated, open the live offerwall as a signed-in user so `external_identifier` is that user's UUID.
7. Complete one real payable action.
8. Confirm the callback creates one authoritative confirmed monetization event, one matching available ledger entry and current `ayet_callback` evidence.

This optional provider proof must never be used as a substitute for the base-product Hourly Pulse/Treasury/Wallet/FaucetPay proof chain.

## Database

The ayeT-specific transport-evidence contract was introduced by migration `0019_ayet_transport_evidence.sql`. A current production database must still apply the **entire** Pulsercuit migration chain, currently through `0030_wallet_withdrawal_read_contract.sql`; stopping at 0019 is not a valid production schema.
