import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(path, fragments) {
  const value = read(path);
  for (const fragment of fragments) {
    if (!value.includes(fragment)) {
      throw new Error(`${path} is missing live value-flow contract: ${fragment}`);
    }
  }
}

requireText("components/value-flow.tsx", [
  'type ValueFlowStage = "earn" | "balance" | "payout"',
  'type PayoutState = "building" | "ready" | "processing" | "paid" | "paused"',
  'aria-label="Reward value path"',
  'href="/earn"',
  'href="/wallet"',
  'aria-current={stage === "earn" ? "step" : undefined}',
  '"--pc-value-progress"',
]);

for (const path of ["app/dashboard/page.tsx", "app/earn/page.tsx", "app/wallet/page.tsx"]) {
  const source = read(path);
  if (!source.includes('import { ValueFlow } from "@/components/value-flow";')) {
    throw new Error(`${path} must import the canonical ValueFlow.`);
  }
  const count = (source.match(/<ValueFlow\b/g) ?? []).length;
  if (count !== 1) {
    throw new Error(`${path} must render exactly one ValueFlow; found ${count}.`);
  }
}

requireText("app/wallet/page.tsx", [
  'payoutFlowState === "paid"',
  'payoutFlowState === "processing"',
  'payoutFlowState === "ready"',
  '"is-payout-ready"',
  '"is-payout-paid"',
]);

requireText("app/progress/page.tsx", [
  '"--pc-signal"',
  'className="pc-live-signal-trace"',
  '"is-preview" : "is-live"',
]);

requireText("components/pulse-visuals.tsx", [
  'const hasActive = typeof active === "number" && active > 0',
  '"has-active"',
  '"has-waiting"',
]);

requireText("app/styles/app-art-direction.css", [
  "/* V5 — live value-flow behavior.",
  ".pc-value-flow{",
  ".pc-value-flow.is-earn .pc-value-flow-line:not(.is-payout)>i{",
  ".pc-value-flow.is-balance .pc-value-flow-line.is-payout>i{",
  ".pc-value-flow.payout-processing .pc-value-flow-line.is-payout>i{",
  ".pc-live-signal-trace{",
  ".pc-v3-prestige-card.is-preview .pc-live-signal-trace>i:after{display:none}",
  ".pc-v3-vault-balance.is-payout-ready{",
  ".pc-v3-vault-balance.is-payout-paid{",
  "@media(prefers-reduced-motion:reduce)",
]);

console.log("Live value-flow visual contract PASS");
