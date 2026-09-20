import { readFileSync } from "node:fs";

const funnel = readFileSync("lib/marketing-funnel.ts", "utf8");
const route = readFileSync("app/api/marketing/event/route.ts", "utf8");
const actions = readFileSync("app/auth/actions.ts", "utf8");
const link = readFileSync("components/funnel-link.tsx", "utf8");
const migration = readFileSync("supabase/migrations/0073_attributed_marketing_funnel.sql", "utf8");

const required = [
  [funnel, '"cta_click"', "CTA event type"],
  [funnel, "cleanMarketingEventLabel", "CTA allowlist"],
  [funnel, "user_id: userId", "signup user attribution"],
  [route, '"invalid_event_label"', "public label rejection"],
  [route, "isLikelyAutomation(request)", "automation exclusion"],
  [actions, 'recordMarketingEvent(sessionId, "signup_created", {}, { userId })', "signup attribution write"],
  [actions, "recordSuccessfulSignup(data.user.id)", "Auth user binding"],
  [link, 'event: "cta_click"', "client CTA intent"],
  [migration, "attributed_users as (", "attributed activation cohort"],
  [migration, "join attributed_users a on a.user_id = pc.user_id", "Pulse attribution join"],
  [migration, "join attributed_users a on a.user_id = w.user_id", "payout attribution join"],
  [migration, "marketing_funnel_events_user_attribution_check", "signup-only UUID constraint"],
  [migration, "marketing_funnel_events_event_label_check", "CTA-label constraint"],
];

for (const [source, fragment, label] of required) {
  if (!source.includes(fragment)) throw new Error(`Marketing attribution contract missing ${label}: ${fragment}`);
}

const forbidden = [
  [migration, "from public.profiles p", "time-window profile cohort"],
  [migration, "update public.reward_treasuries", "Treasury mutation"],
  [migration, "insert into public.pulse_claims", "claim mutation"],
  [migration, "update public.withdrawals", "withdrawal mutation"],
  [migration, "insert into public.ledger_entries", "ledger mutation"],
];

for (const [source, fragment, label] of forbidden) {
  if (source.toLowerCase().includes(fragment.toLowerCase())) {
    throw new Error(`Marketing attribution contract contains forbidden ${label}: ${fragment}`);
  }
}

console.log("Marketing attribution contract PASS");
