-- Explicit release schema marker and external-evidence gate.

insert into public.app_config(key, value, version, reason)
values (
  'release_schema',
  '{"version":7,"name":"release-readiness"}'::jsonb,
  7,
  'Minimum schema required by the controlled launch gate'
)
on conflict (key) do update
set value = excluded.value,
    version = excluded.version,
    reason = excluded.reason,
    updated_at = now();

insert into public.app_config(key, value, version, reason)
values (
  'release_external_proof',
  '{"turnstile":false,"ayet_callback":false,"faucetpay_payout":false}'::jsonb,
  1,
  'External smoke evidence must be explicitly confirmed before production promotion'
)
on conflict (key) do nothing;
