-- Cover foreign keys flagged by the Supabase performance advisor.
-- Additive only: no financial semantics, RLS or runtime authority changes.

create index if not exists claims_ledger_entry_id_idx
on public.claims(ledger_entry_id);

create index if not exists monetization_events_original_event_id_idx
on public.monetization_events(original_event_id)
where original_event_id is not null;

create index if not exists risk_events_user_id_idx
on public.risk_events(user_id);

create index if not exists withdrawals_ledger_entry_id_idx
on public.withdrawals(ledger_entry_id)
where ledger_entry_id is not null;
