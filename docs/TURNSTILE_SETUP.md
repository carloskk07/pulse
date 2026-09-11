# Turnstile context validation

Reward Pulse treats a successful Siteverify response as necessary but not sufficient for protected financial flows.

## Server checks

Every protected flow validates:

1. the token through Cloudflare Siteverify;
2. the expected widget `action` for that flow;
3. the returned `hostname` against the configured public site hostname plus any explicitly allowed aliases;
4. token length before making the external request;
5. a bounded Siteverify timeout so verification cannot hang a request indefinitely.

Current actions:

```text
signup
 daily_pulse
 withdrawal
 withdrawal-retry
```

The withdrawal endpoint accepts the two withdrawal actions because both map to the same server-owned payout domain; retry still reloads destination, asset and amount from PostgreSQL.

## Hostnames

`NEXT_PUBLIC_SITE_URL` automatically contributes its hostname to the allowlist. Additional legitimate aliases can be added as a comma-separated server variable:

```text
TURNSTILE_ALLOWED_HOSTNAMES=www.example.com,preview.example.com
```

Do not use wildcards here. Configure matching hostname restrictions in the Cloudflare Turnstile widget as well.

## Release evidence

Turnstile release evidence fingerprints the secret/site key, public site URL and optional hostname aliases. Rotating those settings automatically invalidates previous smoke evidence until a protected flow succeeds again under the new configuration.
