-- Pulse Ads Merchant callback durability.
-- FaucetPay Merchant verification tokens are single-use. Persist the provider-
-- verified payment authority before internal settlement so a transient failure
-- can retry settlement without consuming the provider token again.
-- Does not change release_schema or any reward/Treasury/payout authority.

alter table public.pulse_ads_merchant_callbacks
  add column if not exists verified_campaign_id uuid references public.pulse_ads_campaigns(id) on delete restrict,
  add column if not exists verified_checkout_reference uuid,
  add column if not exists verified_amount_usd_micros bigint check (verified_amount_usd_micros is null or verified_amount_usd_micros > 0),
  add column if not exists verified_pricing_currency text check (verified_pricing_currency is null or verified_pricing_currency = 'USDT'),
  add column if not exists provider_verified_at timestamptz;

alter table public.pulse_ads_merchant_callbacks
  drop constraint if exists pulse_ads_merchant_callbacks_provider_proof_check;

alter table public.pulse_ads_merchant_callbacks
  add constraint pulse_ads_merchant_callbacks_provider_proof_check
  check (
    provider_verified_at is null
    or (
      verified_campaign_id is not null
      and verified_checkout_reference is not null
      and verified_amount_usd_micros is not null
      and verified_pricing_currency = 'USDT'
      and provider_transaction_id is not null
      and custom_reference is not null
    )
  );

comment on column public.pulse_ads_merchant_callbacks.provider_verified_at is
  'Set immediately after authoritative FaucetPay get-payment verification. Allows settlement retry without reusing the single-use provider token.';
