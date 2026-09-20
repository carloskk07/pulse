-- Performance-only migration: collapse public social-proof fan-out into one RPC.
-- Compatible with release schema v55 / 0055. No reward, Treasury funding,
-- payout, RLS or release-authority changes are made.
--
-- The public social-proof API is CDN-cached, but each cache miss previously
-- issued four independent Supabase requests. This read-only snapshot preserves
-- the exact counts and five most recent reward rows in one service-role RPC.

create or replace function public.public_social_proof_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
with
member_stats as (
  select count(*)::bigint as member_count
  from public.profiles
),
reward_stats as (
  select count(*)::bigint as reward_event_count
  from public.ledger_entries
  where credits > 0
    and state in ('available', 'withdrawn')
    and entry_type in ('daily_reward', 'pulse_reward', 'offer', 'survey', 'referral')
),
withdrawal_stats as (
  select count(*)::bigint as paid_withdrawal_count
  from public.withdrawals
  where status = 'paid'
),
recent as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'entry_type', entry_type,
        'credits', credits,
        'created_at', created_at
      )
      order by created_at desc
    ),
    '[]'::jsonb
  ) as rows
  from (
    select entry_type, credits, created_at
    from public.ledger_entries
    where credits > 0
      and state in ('available', 'withdrawn')
      and entry_type in ('daily_reward', 'pulse_reward', 'offer', 'survey', 'referral')
    order by created_at desc
    limit 5
  ) q
)
select jsonb_build_object(
  'member_count', m.member_count,
  'reward_event_count', r.reward_event_count,
  'paid_withdrawal_count', w.paid_withdrawal_count,
  'recent', x.rows
)
from member_stats m
cross join reward_stats r
cross join withdrawal_stats w
cross join recent x;
$$;

revoke all on function public.public_social_proof_snapshot()
  from public, anon, authenticated, service_role;
grant execute on function public.public_social_proof_snapshot()
  to service_role;

do $$
declare
  v_schema jsonb;
  v_snapshot jsonb;
  v_legacy jsonb;
begin
  select value
  into v_schema
  from public.app_config
  where key = 'release_schema';

  if coalesce((v_schema->>'version')::integer, 0) <> 55
     or coalesce(v_schema->>'migration', '') <> '0055_invite_snapshot_compaction.sql' then
    raise exception 'public social-proof snapshot requires v55 authority';
  end if;

  select public.public_social_proof_snapshot()
  into v_snapshot;

  select jsonb_build_object(
    'member_count',
      (select count(*)::bigint from public.profiles),
    'reward_event_count',
      (
        select count(*)::bigint
        from public.ledger_entries
        where credits > 0
          and state in ('available', 'withdrawn')
          and entry_type in ('daily_reward', 'pulse_reward', 'offer', 'survey', 'referral')
      ),
    'paid_withdrawal_count',
      (
        select count(*)::bigint
        from public.withdrawals
        where status = 'paid'
      ),
    'recent',
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'entry_type', entry_type,
              'credits', credits,
              'created_at', created_at
            )
            order by created_at desc
          ),
          '[]'::jsonb
        )
        from (
          select entry_type, credits, created_at
          from public.ledger_entries
          where credits > 0
            and state in ('available', 'withdrawn')
            and entry_type in ('daily_reward', 'pulse_reward', 'offer', 'survey', 'referral')
          order by created_at desc
          limit 5
        ) q
      )
  )
  into v_legacy;

  if v_snapshot is distinct from v_legacy then
    raise exception 'public social-proof snapshot does not match legacy queries';
  end if;

  if (
    select p.prosecdef
    from pg_catalog.pg_proc p
    where p.oid = 'public.public_social_proof_snapshot()'::regprocedure
  ) then
    raise exception 'public social-proof snapshot must remain SECURITY INVOKER';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.public_social_proof_snapshot()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.public_social_proof_snapshot()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.public_social_proof_snapshot()',
       'EXECUTE'
     ) then
    raise exception 'public social-proof snapshot execution scope changed';
  end if;
end
$$;
