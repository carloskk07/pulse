-- V13 performance hardening after live advisors.
-- Add covering indexes for the two remaining unindexed foreign keys surfaced
-- by Supabase advisors. No financial authority or release schema is changed.

create index if not exists network_commission_source_user_idx
  on public.network_commission_events(source_user_id, created_at desc);

create index if not exists pulse_ads_callbacks_verified_campaign_idx
  on public.pulse_ads_merchant_callbacks(verified_campaign_id)
  where verified_campaign_id is not null;

do $$
begin
  if to_regclass('public.network_commission_source_user_idx') is null then
    raise exception 'network commission source-user index missing';
  end if;

  if to_regclass('public.pulse_ads_callbacks_verified_campaign_idx') is null then
    raise exception 'Pulse Ads verified-campaign callback index missing';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'V13 FK hardening requires canonical release schema v55';
  end if;
end
$$;
