-- Cover the two remaining foreign keys reported by the Supabase database linter.
-- These indexes are read/performance-only and do not change reward or financial semantics.

create index if not exists direct_campaign_events_user_id_idx
  on public.direct_campaign_events (user_id);

create index if not exists direct_campaigns_opportunity_id_idx
  on public.direct_campaigns (opportunity_id);
