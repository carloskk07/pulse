-- V13 withdrawal retry backoff authority.
-- Preserve idempotent recovery indefinitely while preventing rapid repeated
-- provider dispatches during prolonged transient failure.
-- Canonical release schema remains v55/0055.

create or replace function public.claim_withdrawal_dispatch(
  p_withdrawal_id uuid,
  p_retry_after_seconds integer default 30
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row public.withdrawals%rowtype;
  v_now timestamptz := now();
  v_base_retry_seconds integer := coalesce(p_retry_after_seconds,30);
  v_effective_retry_seconds integer;
  v_retry_after integer;
  v_backoff_exponent integer;
begin
  if v_base_retry_seconds < 5 or v_base_retry_seconds > 900 then
    return jsonb_build_object('status','invalid_retry_window','dispatch',false);
  end if;

  select * into v_row
  from public.withdrawals
  where id=p_withdrawal_id
  for update;

  if not found then
    return jsonb_build_object('status','not_found','dispatch',false);
  end if;

  if v_row.status='paid' then
    return jsonb_build_object(
      'status','paid',
      'dispatch',false,
      'external_id',v_row.external_id,
      'attempt',v_row.dispatch_attempts
    );
  end if;

  if v_row.status='held' then
    return jsonb_build_object('status','held','dispatch',false,'attempt',v_row.dispatch_attempts);
  end if;

  if v_row.status in ('failed','cancelled') then
    return jsonb_build_object('status',v_row.status,'dispatch',false,'attempt',v_row.dispatch_attempts);
  end if;

  if not public.withdrawal_pilot_allowed(v_row.user_id) then
    return jsonb_build_object(
      'status','pilot_restricted',
      'dispatch',false,
      'attempt',v_row.dispatch_attempts
    );
  end if;

  if v_row.status not in ('requested','submitted') then
    return jsonb_build_object('status','invalid_state','dispatch',false,'attempt',v_row.dispatch_attempts);
  end if;

  -- attempt 1: base 30s
  -- attempt 2: 60s
  -- attempt 3: 120s
  -- attempt 4: 240s
  -- attempt 5: 480s
  -- attempt 6+: 900s hard cap
  v_backoff_exponent := least(greatest(v_row.dispatch_attempts - 1,0),5);
  v_effective_retry_seconds := least(
    900,
    greatest(
      v_base_retry_seconds,
      round(30::numeric * power(2::numeric,v_backoff_exponent))::integer
    )
  );

  if v_row.status='submitted'
     and v_row.dispatch_claimed_at is not null
     and v_row.dispatch_claimed_at > v_now - make_interval(secs=>v_effective_retry_seconds) then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (
        (v_row.dispatch_claimed_at + make_interval(secs=>v_effective_retry_seconds)) - v_now
      )))::integer
    );

    return jsonb_build_object(
      'status','submitted',
      'dispatch',false,
      'retry_after_seconds',v_retry_after,
      'backoff_seconds',v_effective_retry_seconds,
      'attempt',v_row.dispatch_attempts
    );
  end if;

  update public.withdrawals
  set status='submitted',
      dispatch_claimed_at=v_now,
      dispatch_attempts=dispatch_attempts+1,
      provider_message=case
        when v_row.status='requested' then 'Payout dispatch lease claimed'
        else 'Payout recovery dispatch lease claimed'
      end,
      updated_at=v_now
  where id=p_withdrawal_id
  returning * into v_row;

  return jsonb_build_object(
    'status','submitted',
    'dispatch',true,
    'attempt',v_row.dispatch_attempts,
    'dispatch_claimed_at',v_row.dispatch_claimed_at,
    'backoff_seconds',case
      when v_row.dispatch_attempts <= 1 then v_base_retry_seconds
      else least(
        900,
        greatest(
          v_base_retry_seconds,
          round(30::numeric * power(2::numeric,least(greatest(v_row.dispatch_attempts - 1,0),5)))::integer
        )
      )
    end
  );
end;
$$;

revoke all on function public.claim_withdrawal_dispatch(uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_withdrawal_dispatch(uuid,integer)
  to service_role;

create or replace function public.release_withdrawal_retry_backoff_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  position(
    'power(2::numeric'
    in lower(pg_get_functiondef('public.claim_withdrawal_dispatch(uuid,integer)'::regprocedure))
  ) > 0
  and position(
    'least(900'
    in regexp_replace(
      lower(pg_get_functiondef('public.claim_withdrawal_dispatch(uuid,integer)'::regprocedure)),
      '[[:space:]]+',
      '',
      'g'
    )
  ) > 0
  and position(
    'dispatch_attempts=dispatch_attempts+1'
    in regexp_replace(
      lower(pg_get_functiondef('public.claim_withdrawal_dispatch(uuid,integer)'::regprocedure)),
      '[[:space:]]+',
      '',
      'g'
    )
  ) > 0
  and has_function_privilege(
    'service_role','public.claim_withdrawal_dispatch(uuid,integer)','EXECUTE'
  )
  and not has_function_privilege(
    'anon','public.claim_withdrawal_dispatch(uuid,integer)','EXECUTE'
  )
  and not has_function_privilege(
    'authenticated','public.claim_withdrawal_dispatch(uuid,integer)','EXECUTE'
  )
  and not exists(
    select 1 from public.withdrawals
    where dispatch_attempts < 0
  );
$$;

revoke all on function public.release_withdrawal_retry_backoff_contract()
  from public, anon, authenticated, service_role;
grant execute on function public.release_withdrawal_retry_backoff_contract()
  to service_role;

do $$
begin
  if not public.release_withdrawal_retry_backoff_contract() then
    raise exception 'withdrawal retry backoff contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'withdrawal retry backoff requires canonical release schema v55';
  end if;
end
$$;
