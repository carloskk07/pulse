-- FaucetPay payout webhook reconciliation, prepared fail-closed.
-- The endpoint is intentionally disabled until an expected faucet id and
-- webhook secret are configured outside this migration.
-- Canonical release schema remains v55/0055.

insert into public.app_config(key,value,version,reason)
values (
  'faucetpay_webhook_reconciliation',
  jsonb_build_object(
    'enabled',false,
    'expected_faucet_id',null,
    'max_event_age_hours',72
  ),
  1,
  'Fail-closed FaucetPay payout webhook reconciliation; enable only after session+2FA webhook setup and secret verification'
)
on conflict (key) do nothing;

create table if not exists public.faucetpay_payout_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique
    check (length(trim(provider_event_id)) between 8 and 200),
  event_type text not null
    check (event_type in ('payout.sent','payout.failed')),
  faucet_id bigint not null check (faucet_id > 0),
  provider_payout_id text,
  destination_sha256 text not null
    check (destination_sha256 ~ '^[0-9a-f]{64}$'),
  amount_units bigint not null check (amount_units > 0),
  asset text not null
    check (length(trim(asset)) between 2 and 16),
  event_created_at timestamptz not null,
  payload_sha256 text not null
    check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  matched_withdrawal_id uuid references public.withdrawals(id) on delete restrict,
  outcome text not null check (
    outcome in (
      'settled_paid',
      'settled_failed',
      'idempotent_paid',
      'no_match',
      'ambiguous',
      'provider_payout_conflict',
      'terminal_conflict'
    )
  ),
  provider_message text,
  received_at timestamptz not null default now()
);

create unique index if not exists faucetpay_webhook_sent_payout_uidx
  on public.faucetpay_payout_webhook_events(provider_payout_id)
  where event_type='payout.sent' and provider_payout_id is not null;

create index if not exists faucetpay_webhook_withdrawal_idx
  on public.faucetpay_payout_webhook_events(matched_withdrawal_id,received_at desc)
  where matched_withdrawal_id is not null;

alter table public.faucetpay_payout_webhook_events enable row level security;

revoke all on table public.faucetpay_payout_webhook_events
  from public,anon,authenticated,service_role;
grant select,insert,update on table public.faucetpay_payout_webhook_events
  to service_role;

create or replace function public.faucetpay_webhook_reconciliation_enabled(
  p_faucet_id bigint
)
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select coalesce((
  select
    lower(coalesce(value->>'enabled','false')) in ('true','1','yes','on')
    and coalesce((value->>'expected_faucet_id')::bigint,0)=p_faucet_id
    and p_faucet_id > 0
  from public.app_config
  where key='faucetpay_webhook_reconciliation'
),false);
$$;

revoke all on function public.faucetpay_webhook_reconciliation_enabled(bigint)
  from public,anon,authenticated,service_role;
grant execute on function public.faucetpay_webhook_reconciliation_enabled(bigint)
  to service_role;

create or replace function public.reconcile_faucetpay_payout_webhook(
  p_event_id text,
  p_event_type text,
  p_faucet_id bigint,
  p_destination text,
  p_destination_sha256 text,
  p_amount_units bigint,
  p_asset text,
  p_provider_payout_id text,
  p_event_created_at timestamptz,
  p_payload_sha256 text,
  p_message text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_cfg jsonb := '{}'::jsonb;
  v_enabled boolean := false;
  v_expected_faucet_id bigint := 0;
  v_max_age_hours integer := 72;
  v_existing public.faucetpay_payout_webhook_events%rowtype;
  v_candidate public.withdrawals%rowtype;
  v_candidate_count integer := 0;
  v_terminal public.withdrawals%rowtype;
  v_finalize jsonb;
  v_outcome text;
  v_provider_payout_id text := nullif(trim(coalesce(p_provider_payout_id,'')),'');
  v_message text := left(coalesce(p_message,''),500);
begin
  if p_event_id is null
     or length(trim(p_event_id)) not between 8 and 200
     or p_event_type not in ('payout.sent','payout.failed')
     or coalesce(p_faucet_id,0) <= 0
     or p_destination is null
     or length(trim(p_destination)) not between 1 and 200
     or p_destination_sha256 !~ '^[0-9a-f]{64}$'
     or coalesce(p_amount_units,0) <= 0
     or p_asset is null
     or length(trim(p_asset)) not between 2 and 16
     or p_event_created_at is null
     or p_payload_sha256 !~ '^[0-9a-f]{64}$'
  then
    return jsonb_build_object('status','invalid');
  end if;

  if p_event_type='payout.sent' and v_provider_payout_id is null then
    return jsonb_build_object('status','invalid_payout_id');
  end if;

  select coalesce(value,'{}'::jsonb)
  into v_cfg
  from public.app_config
  where key='faucetpay_webhook_reconciliation';

  v_enabled := lower(coalesce(v_cfg->>'enabled','false')) in ('true','1','yes','on');
  v_expected_faucet_id := coalesce((v_cfg->>'expected_faucet_id')::bigint,0);
  v_max_age_hours := greatest(1,least(
    coalesce((v_cfg->>'max_event_age_hours')::integer,72),
    168
  ));

  if not v_enabled then
    return jsonb_build_object('status','disabled');
  end if;

  if v_expected_faucet_id <= 0 or v_expected_faucet_id <> p_faucet_id then
    return jsonb_build_object('status','faucet_mismatch');
  end if;

  if p_event_created_at > now() + interval '5 minutes'
     or p_event_created_at < now() - make_interval(hours=>v_max_age_hours) then
    return jsonb_build_object('status','stale_event');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('faucetpay-webhook-event:' || trim(p_event_id),0)
  );

  select * into v_existing
  from public.faucetpay_payout_webhook_events
  where provider_event_id=trim(p_event_id)
  for update;

  if found then
    if v_existing.payload_sha256 <> p_payload_sha256 then
      return jsonb_build_object(
        'status','event_id_payload_mismatch',
        'outcome',v_existing.outcome
      );
    end if;

    return jsonb_build_object(
      'status','duplicate',
      'outcome',v_existing.outcome,
      'withdrawal_id',v_existing.matched_withdrawal_id
    );
  end if;

  if p_event_type='payout.sent' then
    perform pg_advisory_xact_lock(
      hashtextextended('faucetpay-webhook-payout:' || v_provider_payout_id,0)
    );

    select * into v_terminal
    from public.withdrawals
    where lower(payout_provider)='faucetpay'
      and status='paid'
      and external_id=v_provider_payout_id
    limit 1
    for update;

    if found then
      if trim(v_terminal.destination)=trim(p_destination)
         and upper(v_terminal.asset)=upper(trim(p_asset))
         and v_terminal.payout_amount_units=p_amount_units
         and p_event_created_at >= v_terminal.created_at - interval '5 minutes'
      then
        insert into public.faucetpay_payout_webhook_events(
          provider_event_id,event_type,faucet_id,provider_payout_id,
          destination_sha256,amount_units,asset,event_created_at,
          payload_sha256,matched_withdrawal_id,outcome,provider_message
        ) values (
          trim(p_event_id),p_event_type,p_faucet_id,v_provider_payout_id,
          p_destination_sha256,p_amount_units,upper(trim(p_asset)),p_event_created_at,
          p_payload_sha256,v_terminal.id,'idempotent_paid',v_message
        );

        return jsonb_build_object(
          'status','idempotent',
          'outcome','idempotent_paid',
          'withdrawal_id',v_terminal.id
        );
      end if;

      insert into public.faucetpay_payout_webhook_events(
        provider_event_id,event_type,faucet_id,provider_payout_id,
        destination_sha256,amount_units,asset,event_created_at,
        payload_sha256,outcome,provider_message
      ) values (
        trim(p_event_id),p_event_type,p_faucet_id,v_provider_payout_id,
        p_destination_sha256,p_amount_units,upper(trim(p_asset)),p_event_created_at,
        p_payload_sha256,'provider_payout_conflict',v_message
      );

      return jsonb_build_object('status','conflict','outcome','provider_payout_conflict');
    end if;
  end if;

  select count(*)::integer
  into v_candidate_count
  from public.withdrawals w
  where lower(w.payout_provider)='faucetpay'
    and w.status='submitted'
    and w.dispatch_attempts > 0
    and w.dispatch_claimed_at is not null
    and trim(w.destination)=trim(p_destination)
    and upper(w.asset)=upper(trim(p_asset))
    and w.payout_amount_units=p_amount_units
    and w.payout_authority_version is not null
    and upper(w.payout_authority_asset)=upper(w.asset)
    and w.payout_authority_units=w.payout_amount_units
    and w.payout_authority_credits=w.amount_credits
    and p_event_created_at >= w.created_at - interval '5 minutes';

  if v_candidate_count=0 then
    insert into public.faucetpay_payout_webhook_events(
      provider_event_id,event_type,faucet_id,provider_payout_id,
      destination_sha256,amount_units,asset,event_created_at,
      payload_sha256,outcome,provider_message
    ) values (
      trim(p_event_id),p_event_type,p_faucet_id,v_provider_payout_id,
      p_destination_sha256,p_amount_units,upper(trim(p_asset)),p_event_created_at,
      p_payload_sha256,'no_match',v_message
    );
    return jsonb_build_object('status','accepted','outcome','no_match');
  end if;

  if v_candidate_count<>1 then
    insert into public.faucetpay_payout_webhook_events(
      provider_event_id,event_type,faucet_id,provider_payout_id,
      destination_sha256,amount_units,asset,event_created_at,
      payload_sha256,outcome,provider_message
    ) values (
      trim(p_event_id),p_event_type,p_faucet_id,v_provider_payout_id,
      p_destination_sha256,p_amount_units,upper(trim(p_asset)),p_event_created_at,
      p_payload_sha256,'ambiguous',v_message
    );
    return jsonb_build_object(
      'status','accepted',
      'outcome','ambiguous',
      'candidate_count',v_candidate_count
    );
  end if;

  select * into v_candidate
  from public.withdrawals w
  where lower(w.payout_provider)='faucetpay'
    and w.status='submitted'
    and w.dispatch_attempts > 0
    and w.dispatch_claimed_at is not null
    and trim(w.destination)=trim(p_destination)
    and upper(w.asset)=upper(trim(p_asset))
    and w.payout_amount_units=p_amount_units
    and w.payout_authority_version is not null
    and upper(w.payout_authority_asset)=upper(w.asset)
    and w.payout_authority_units=w.payout_amount_units
    and w.payout_authority_credits=w.amount_credits
    and p_event_created_at >= w.created_at - interval '5 minutes'
  limit 1
  for update;

  if p_event_type='payout.sent' then
    v_finalize := public.finalize_withdrawal(
      v_candidate.id,
      'paid',
      v_provider_payout_id,
      nullif(v_message,'')
    );

    if coalesce(v_finalize->>'status','')='paid'
       and coalesce(v_finalize->>'external_id','')=v_provider_payout_id
    then
      v_outcome := 'settled_paid';
    else
      return jsonb_build_object(
        'status','retry',
        'outcome','settlement_unavailable',
        'withdrawal_id',v_candidate.id
      );
    end if;
  else
    v_finalize := public.finalize_withdrawal(
      v_candidate.id,
      'failed',
      null,
      nullif(v_message,'')
    );

    if coalesce(v_finalize->>'status','')='failed' then
      v_outcome := 'settled_failed';
    elsif coalesce(v_finalize->>'status','') in ('paid','cancelled') then
      v_outcome := 'terminal_conflict';
    else
      return jsonb_build_object(
        'status','retry',
        'outcome','settlement_unavailable',
        'withdrawal_id',v_candidate.id
      );
    end if;
  end if;

  insert into public.faucetpay_payout_webhook_events(
    provider_event_id,event_type,faucet_id,provider_payout_id,
    destination_sha256,amount_units,asset,event_created_at,
    payload_sha256,matched_withdrawal_id,outcome,provider_message
  ) values (
    trim(p_event_id),p_event_type,p_faucet_id,v_provider_payout_id,
    p_destination_sha256,p_amount_units,upper(trim(p_asset)),p_event_created_at,
    p_payload_sha256,v_candidate.id,v_outcome,v_message
  );

  return jsonb_build_object(
    'status','processed',
    'outcome',v_outcome,
    'withdrawal_id',v_candidate.id,
    'external_id',case when v_outcome='settled_paid' then v_provider_payout_id else null end
  );
end;
$$;

revoke all on function public.reconcile_faucetpay_payout_webhook(
  text,text,bigint,text,text,bigint,text,text,timestamptz,text,text
) from public,anon,authenticated,service_role;
grant execute on function public.reconcile_faucetpay_payout_webhook(
  text,text,bigint,text,text,bigint,text,text,timestamptz,text,text
) to service_role;

create or replace function public.release_faucetpay_webhook_reconciliation_contract()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
select
  to_regclass('public.faucetpay_payout_webhook_events') is not null
  and coalesce((
    select relrowsecurity
    from pg_class
    where oid='public.faucetpay_payout_webhook_events'::regclass
  ),false)
  and not has_table_privilege('anon','public.faucetpay_payout_webhook_events','SELECT')
  and not has_table_privilege('authenticated','public.faucetpay_payout_webhook_events','SELECT')
  and has_table_privilege('service_role','public.faucetpay_payout_webhook_events','SELECT')
  and to_regprocedure(
    'public.reconcile_faucetpay_payout_webhook(text,text,bigint,text,text,bigint,text,text,timestamptz,text,text)'
  ) is not null
  and has_function_privilege(
    'service_role',
    'public.reconcile_faucetpay_payout_webhook(text,text,bigint,text,text,bigint,text,text,timestamptz,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.reconcile_faucetpay_payout_webhook(text,text,bigint,text,text,bigint,text,text,timestamptz,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.reconcile_faucetpay_payout_webhook(text,text,bigint,text,text,bigint,text,text,timestamptz,text,text)',
    'EXECUTE'
  )
  and position(
    'v_candidate_count<>1'
    in regexp_replace(
      lower(pg_get_functiondef(
        'public.reconcile_faucetpay_payout_webhook(text,text,bigint,text,text,bigint,text,text,timestamptz,text,text)'::regprocedure
      )),
      '[[:space:]]+','','g'
    )
  ) > 0
  and position(
    'status=''submitted'''
    in regexp_replace(
      lower(pg_get_functiondef(
        'public.reconcile_faucetpay_payout_webhook(text,text,bigint,text,text,bigint,text,text,timestamptz,text,text)'::regprocedure
      )),
      '[[:space:]]+','','g'
    )
  ) > 0
  and coalesce((
    select
      lower(coalesce(value->>'enabled','false'))='false'
      and greatest(1,least(coalesce((value->>'max_event_age_hours')::integer,72),168)) between 1 and 168
    from public.app_config
    where key='faucetpay_webhook_reconciliation'
  ),false);
$$;

revoke all on function public.release_faucetpay_webhook_reconciliation_contract()
  from public,anon,authenticated,service_role;
grant execute on function public.release_faucetpay_webhook_reconciliation_contract()
  to service_role;

do $$
begin
  if not public.release_faucetpay_webhook_reconciliation_contract() then
    raise exception 'FaucetPay webhook reconciliation contract failed';
  end if;

  if coalesce((
    select (value->>'version')::integer
    from public.app_config
    where key='release_schema'
  ),0) <> 55 then
    raise exception 'FaucetPay webhook reconciliation requires canonical release schema v55';
  end if;
end
$$;
