create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  category text not null check (category in ('earning','withdrawal','account','privacy','other')),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'open' check (status in ('open','in_review','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_cases_user_created_idx on public.support_cases(user_id, created_at desc) where user_id is not null;
create index if not exists support_cases_status_created_idx on public.support_cases(status, created_at asc);

alter table public.support_cases enable row level security;
revoke all on table public.support_cases from anon, authenticated;
grant select (id, user_id, email, category, subject, status, created_at, updated_at) on table public.support_cases to authenticated;
grant select, insert, update, delete on table public.support_cases to service_role;

create policy "support_cases_read_own" on public.support_cases
for select to authenticated
using ((select auth.uid()) = user_id);

insert into public.app_config(key, value, version, reason)
values ('release_schema', jsonb_build_object('version', 20, 'migration', '0020_support_cases.sql'), 20, 'First-party support case channel')
on conflict (key) do update
set value = excluded.value, version = excluded.version, reason = excluded.reason, updated_at = now();
