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

With the current default `AYET_REWARD_SHARE_BPS=7000`, configure:

```text
Currency Conversion Rate: 1 USD = 700 credits
Currency Decimal Places:  0
```

The 0-decimal setting is part of the financial contract. ayeT documents that `currency_amount` is a float and that decimal-place configuration determines whether rewards such as 4.2 virtual units are shown. Pulse intentionally accepts only whole signed credits so the ledger can credit exactly what the Offerwall promised without silently inventing its own rounding rule.

Do not configure `1 USD = 1000 credits` while Pulse settles a 70% share. Keep ayeT currency sales / temporary currency multipliers disabled for this MVP contract.

## Callback URL

Configure a conversion callback in the ayeT publisher dashboard using your real public domain and these macros:

```text
https://YOUR_DOMAIN/api/providers/ayet/callback?callback_type={callback_type}&transaction_id={transaction_id}&external_identifier={external_identifier}&payout_usd={payout_usd}&currency_amount={currency_amount}&currency_conversion_rate={currency_conversion_rate}&is_chargeback={is_chargeback}&callback_ts={callback_ts}&adslot_id={adslot_id}&event_name={event_name}&task_uuid={task_uuid}
```

The endpoint validates `X-Ayetstudios-Security-Hash` with HMAC-SHA256 using the publisher API key. Do not place the API key in the callback URL.

`adslot_id`, `currency_conversion_rate` and `currency_amount` are mandatory for conversion authority:

- `adslot_id` must match `AYET_ADSLOT_ID` exactly;
- `currency_conversion_rate` must match the rate derived from `AYET_REWARD_SHARE_BPS`;
- `currency_amount` must be a positive whole number because the adslot is configured with 0 decimal places;
- Pulse credits that signed whole `currency_amount` directly;
- Pulse independently verifies that the signed amount stays within less than one credit of `payout_usd × configured rate`, allowing only the provider's whole-unit rounding and rejecting larger economic drift.

This means the provider is authoritative for the reward the user saw, while Pulse remains authoritative for whether that reward is allowed to enter the ledger.

## Which ayeT test proves what

Use **Sandbox Identifier** for the Pulse provider preflight. ayeT documents that this mode opens predefined sandbox offers, generates regular callbacks with fake payout/user currency, and appends `is_sandbox=1`. That exercises the actual Offerwall user → offer → callback route while Pulse safely discards the financial result.

Do **not** use the standalone **Callback Tester** as proof of `ayet_transport`. It is useful for checking that a URL can receive a postback, but ayeT's tester may populate synthetic fields independently (for example `payout_usd=0` with a non-zero `currency_amount`). That does not prove the live Offerwall reward contract that Pulse validates.

```text
Callback Tester    = diagnostic only
Sandbox Identifier = ayet_transport authority
Real conversion    = ayet_callback authority
```

## Authority rules

- For production conversions, `external_identifier` must be the authenticated Supabase user UUID.
- Browser activity never changes a balance.
- The signed provider callback is the conversion authority.
- The callback `adslot_id` must exactly match `AYET_ADSLOT_ID`.
- The callback `currency_conversion_rate` must match the current server reward contract.
- The callback `currency_amount` must be a positive whole credit amount and becomes the exact ledger reward.
- The economic check permits less than one credit of provider whole-unit rounding; larger drift is rejected as `reward-amount-mismatch`.
- Fractional callback currency is rejected as `FRACTIONAL_CURRENCY_AMOUNT` and proves the adslot decimal-place configuration is wrong for Pulse.
- `transaction_id` is the idempotency identity.
- Chargebacks reverse the exact original Reward Pulse credit rather than recalculating today's reward share. They are not blocked by a later reward-rate change.
- Invalid signatures, wrong/missing adslots, or reward mismatches never write financial state.
- Orphan chargebacks return a retryable error so an out-of-order conversion can arrive first.
- ayeT sandbox callbacks are non-financial. Only after HMAC, adslot binding, whole-credit authority, rate alignment and economic alignment pass does Pulse record `ayet_transport`.
- A sandbox identifier does not need to be a real Supabase user UUID because sandbox callbacks can never touch the ledger or satisfy `PRODUCT_READY`.
- Duplicate production callbacks remain idempotent and do not refresh earning evidence. Current financial provider evidence is created only when a fresh production conversion is actually credited.

## Recommended proof sequence

1. Configure the ayeT adslot to `1 USD = 700 credits`.
2. Set **Currency Decimal Places = 0**.
3. Add the callback URL above, including `{currency_amount}`, `{currency_conversion_rate}` and `{adslot_id}`.
4. Keep provider-side currency sales/multipliers disabled for this MVP contract.
5. Enable reversal/chargeback callbacks for the same placement.
6. Configure a **Sandbox Identifier** in ayeT and open the Web Offerwall using that identifier.
7. Trigger one of ayeT's predefined sandbox offers. Do not substitute the standalone Callback Tester for this gate.
8. Confirm `/admin/product` reports that ayeT transport/reward preflight is proven while **Real earning proof** remains blocked.
9. Open the live offerwall as a signed-in Pulse user so `externalIdentifier` is that user's Supabase UUID.
10. Complete one real payable action.
11. Confirm the callback created a confirmed monetization event, an available ledger entry and current `ayet_callback` evidence.

## Database

Apply migrations in order through `0019_ayet_transport_evidence.sql` before running the provider preflight.
