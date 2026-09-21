-- Reconcile the historical production admin_user_allowlist migration with source control.
-- This migration recreates only the schema/privilege contract. Administrative
-- identities remain environment-specific and are never inserted from source.
-- It does not change release_schema, rewards, Treasury, claims, or payouts.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text not null default 'operator'
);

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from public, anon, authenticated;
grant all privileges on table public.admin_users to service_role;

comment on table public.admin_users is
  'Environment-specific operator allowlist schema retained for production reproducibility. No administrative identity is provisioned by migrations.';

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'admin_users'
      and c.relkind = 'r'
      and c.relrowsecurity
  ) then
    raise exception 'admin_users RLS contract missing';
  end if;

  if has_table_privilege('anon', 'public.admin_users', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.admin_users', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'admin_users client privilege contract drifted';
  end if;

  if not has_table_privilege('service_role', 'public.admin_users', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'admin_users service-role contract missing';
  end if;
end;
$$;
