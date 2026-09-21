import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireAll(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(path + " missing FaucetPay webhook contract: " + fragment);
    }
  }
}

function forbidAll(path, fragments) {
  const source = read(path).toLowerCase();
  for (const fragment of fragments) {
    if (source.includes(fragment.toLowerCase())) {
      throw new Error(path + " contains forbidden FaucetPay webhook behavior: " + fragment);
    }
  }
}

requireAll("app/api/faucetpay/webhook/route.ts", [
  'request.headers.get("x-faucetpay-signature")',
  'createHmac("sha256", secret).update(rawBody).digest("hex")',
  "timingSafeEqual",
  "await request.text()",
  "verifySignature(rawBody, signature, secret)",
  '"payout.sent"',
  '"payout.failed"',
  '"reconcile_faucetpay_payout_webhook"',
  "destinationHash",
  "payloadHash",
  '"webhook-not-configured"',
  '"reconciliation-unavailable"',
]);

forbidAll("app/api/faucetpay/webhook/route.ts", [
  "request.json()",
  "NEXT_PUBLIC_FAUCETPAY_WEBHOOK_SECRET",
  "FAUCETPAY_SCOPED_KEY",
  "FAUCETPAY_READ_KEY",
]);

requireAll("supabase/migrations/0090_faucetpay_webhook_reconciliation.sql", [
  "faucetpay_webhook_reconciliation",
  "'enabled',false",
  "expected_faucet_id",
  "create table if not exists public.faucetpay_payout_webhook_events",
  "alter table public.faucetpay_payout_webhook_events enable row level security",
  "create policy \"faucetpay_webhook_no_public_access\"",
  "using (false)",
  "with check (false)",
  "revoke all on table public.faucetpay_payout_webhook_events",
  "create or replace function public.reconcile_faucetpay_payout_webhook",
  "v_candidate_count<>1",
  "status='submitted'",
  "dispatch_attempts > 0",
  "payout_authority_version is not null",
  "public.finalize_withdrawal",
  "'settled_paid'",
  "'settled_failed'",
  "'idempotent_paid'",
  "'no_match'",
  "'ambiguous'",
  "release_faucetpay_webhook_reconciliation_contract",
  "canonical release schema v55",
]);

forbidAll("supabase/migrations/0090_faucetpay_webhook_reconciliation.sql", [
  "'enabled',true",
  "pilot_mode = false",
  "fund_reward_treasury(",
  "'version',56",
  "schema_version = 56",
  "grant select,insert,update on table public.faucetpay_payout_webhook_events to authenticated",
]);

console.log("FaucetPay webhook reconciliation contract PASS");
