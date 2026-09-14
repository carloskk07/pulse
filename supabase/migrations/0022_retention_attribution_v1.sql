-- Pulsercuit V4.3 — Return Intelligence attribution
-- Non-financial, append-only server telemetry for factual reminder effectiveness.

create table if not exists public.retention_events (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('reminder_exported','reminder_returned','pulse_completed')),
  channel text not null default 'calendar' check (channel in ('calendar')),
  target_at timestamptz not null,
  occurred_at timestamptz not null default now(),
  unique (user_id, reminder_id, event_type)
);

create index if not exists retention_events_type_occurred_idx
  on public.retention_events(event_type, occurred_at desc);

create index if not exists retention_events_user_reminder_idx
  on public.retention_events(user_id, reminder_id, occurred_at desc);

alter table public.retention_events enable row level security;

-- Intentionally no end-user RLS policy. Attribution is written/read only by trusted server code.
revoke all on table public.retention_events from public, anon, authenticated;
grant select, insert on table public.retention_events to service_role;
