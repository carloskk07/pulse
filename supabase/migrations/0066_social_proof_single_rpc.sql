-- Performance-only migration: collapse public social-proof fan-out into one RPC.
-- Keep release authority pinned to v55/0055. This changes no financial state.

create or replace function public.public_social_proof_snapshot()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
with member_stats as (
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
paid_stats as (
  select count(*)::bigint as paid_withdrawal_count
  from public.withdrawals
  where status = 'paid'
),
recent as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'entry_type', r.entry_type,
        'credits', r.credits,
        'created_at', r.created_at
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  ) as recent_activity
  from (
    select entry_type, credits, created_at
    from public.ledger_entries
    where credits > 0
      and state in ('available', 'withdrawn')
      and entry_type in ('daily_reward', 'pulse_reward', 'offer', 'survey', 'referral')
    order by created_at desc
    limit 5
  ) r
)
select jsonb_build_object(
  'member_count', m.member_count,
  'reward_event_count', rw.reward_event_count,
  'paid_withdrawal_count', p.paid_withdrawal_count,
  'recent_activity', r.recent_activity
)
from member_stats m
cross join reward_stats rw
cross join paid_stats p
cross join recent r;
$$;

revoke all on function public.public_social_proof_snapshot()
  from public, anon, authenticated, service_role;
grant execute on function public.public_social_proof_snapshot()
  to service_role;

do $$
declare
  v_schema jsonb;
  v_actual jsonb;
  v_expected jsonb;
begin
  select value
  into v_schema
  from public.app_config
  where key = 'release_schema';

  if coalesce(nullif(v_schema->>'version', '')::integer, 0) <> 55
     or coalesce(v_schema->>'migration', '') <> '0055_invite_snapshot_compaction.sql' then
    raise exception 'v66 requires release authority v55/0055';
  end if;

  select public.public_social_proof_snapshot()
  into v_actual;

  select jsonb_build_object(
    'member_count',
      (select count(*) from public.profiles),
    'reward_event_count',
      (
        select count(*)
        from public.ledger_entries
        where credits > 0
          and state in ('available', 'withdrawn')
          and entry_type in ('daily_reward', 'pulse_reward', 'offer', 'survey', 'referral')
      ),
    'paid_withdrawal_count',
      (select count(*) from public.withdrawals where status = 'paid'),
    'recent_activity',
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'entry_type', x.entry_type,
              'credits', x.credits,
              'created_at', x.created_at
            )
            order by x.created_at desc
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
        ) x
      )
  )
  into v_expected;

  if v_actual <> v_expected then
    raise exception 'v66 social proof output mismatch';
  end if;

  if not (
    (select p.prosecdef
     from pg_catalog.pg_proc p
     where p.oid = 'public.public_social_proof_snapshot()'::regprocedure)
    and has_function_privilege(
      'service_role',
      'public.public_social_proof_snapshot()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.public_social_proof_snapshot()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.public_social_proof_snapshot()',
      'EXECUTE'
    )
  ) then
    raise exception 'v66 social proof execution authority drifted';
  end if;
end
$$;
