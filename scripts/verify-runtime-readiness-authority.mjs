import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireAll(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(path + " missing runtime readiness authority: " + fragment);
    }
  }
}

function forbidAll(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (source.includes(fragment)) {
      throw new Error(path + " contains stale readiness authority: " + fragment);
    }
  }
}

for (const path of [
  "lib/product-readiness.ts",
  "lib/release-readiness.ts",
  "lib/controlled-technical-readiness.ts",
]) {
  requireAll(path, [
    "@/lib/supabase/public-config",
    "getSupabasePublicConfig",
    "@/lib/turnstile",
    "hasTurnstileRuntimeAuthority",
    "@/lib/faucetpay-webhook-authority",
    "hasFaucetPayWebhookRuntimeAuthority",
  ]);
}

forbidAll("lib/product-readiness.ts", [
  'configured("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"',
  'configured("TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY")',
]);
forbidAll("lib/release-readiness.ts", [
  'configured("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY")',
  'configured("TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY")',
]);
forbidAll("lib/controlled-technical-readiness.ts", [
  'configured("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY")',
  'configured("TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY")',
]);

requireAll("lib/product-readiness.ts", [
  '"faucetpay-webhook"',
  "faucetPayWebhookReady",
  "32–512 characters",
]);
requireAll("lib/release-readiness.ts", [
  '"faucetpay-webhook"',
  "faucetPayWebhookReady",
  "32–512 characters",
]);
requireAll("lib/controlled-technical-readiness.ts", [
  '"faucetpay-webhook-secret"',
]);

requireAll("app/api/faucetpay/webhook/route.ts", [
  "@/lib/faucetpay-webhook-authority",
  "getFaucetPayWebhookSecret()",
  '"webhook-not-configured"',
]);
forbidAll("app/api/faucetpay/webhook/route.ts", [
  'process.env.FAUCETPAY_WEBHOOK_SECRET?.trim()',
]);

requireAll("scripts/audit-vercel-production-env.mjs", [
  "classifyStrongSecret",
  '["faucetpay-webhook", classifyStrongSecret(values, "FAUCETPAY_WEBHOOK_SECRET")]',
  '"INVALID"',
]);

console.log("Runtime authority/readiness contract PASS");
