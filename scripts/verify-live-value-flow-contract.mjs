import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(path, fragments) {
  const value = read(path);
  for (const fragment of fragments) {
    if (!value.includes(fragment)) {
      throw new Error(`${path} is missing product-experience contract: ${fragment}`);
    }
  }
}

requireText("lib/product-experience.ts", [
  'export type ProductSurface = "reward" | "earn" | "balance" | "payout" | "progress" | "network"',
  'export type PayoutFlowState = "building" | "ready" | "processing" | "paid" | "paused"',
  "export function payoutProgressPercent",
  "export function getEarningExperience",
  "export function getWalletExperience",
  "export function getProgressExperience",
  "export function getNetworkExperience",
  'payoutState === "processing"',
  'payoutState === "ready"',
  'payoutState === "paid"',
]);

requireText("components/value-flow.tsx", [
  'import type { ProductJourney } from "@/lib/product-experience";',
  'export function ValueFlow({ journey }: { journey: ProductJourney })',
  'aria-label="Reward value path"',
  'href="/earn"',
  'href="/wallet"',
  'aria-current={stage === "earn" ? "step" : undefined}',
  '"--pc-value-progress"',
]);

const governedPages = [
  ["app/dashboard/page.tsx", "getEarningExperience"],
  ["app/earn/page.tsx", "getEarningExperience"],
  ["app/wallet/page.tsx", "getWalletExperience"],
  ["app/progress/page.tsx", "getProgressExperience"],
  ["app/invite/page.tsx", "getNetworkExperience"],
];

for (const [path, authority] of governedPages) {
  const source = read(path);
  if (!source.includes(authority)) {
    throw new Error(`${path} must use ${authority}.`);
  }
  if (!source.includes("experience={experience}")) {
    throw new Error(`${path} must expose the canonical experience through AppShell.`);
  }
}

for (const path of ["app/dashboard/page.tsx", "app/earn/page.tsx", "app/wallet/page.tsx"]) {
  const source = read(path);
  if (!source.includes('import { ValueFlow } from "@/components/value-flow";')) {
    throw new Error(`${path} must import the canonical ValueFlow.`);
  }
  const count = (source.match(/<ValueFlow\b/g) ?? []).length;
  if (count !== 1) {
    throw new Error(`${path} must render exactly one ValueFlow; found ${count}.`);
  }
  if (!source.includes("<ValueFlow journey={experience.journey} />")) {
    throw new Error(`${path} must render ValueFlow from the canonical experience journey.`);
  }
  if (/payoutState=|payoutLabel=|payoutProgress=/.test(source)) {
    throw new Error(`${path} must not reconstruct ValueFlow state locally.`);
  }
  if (source.includes("state.availableCredits / payoutCredits")) {
    throw new Error(`${path} must not recalculate payout progress outside product-experience authority.`);
  }
}

requireText("components/app-shell.tsx", [
  'import type { ProductExperience } from "@/lib/product-experience";',
  "experience?: ProductExperience;",
  "data-product-surface={experience?.surface}",
  "data-product-phase={experience?.phase}",
]);

requireText("app/wallet/page.tsx", [
  'const payoutFlowState = experience.journey?.payoutState ?? "paused";',
  'payoutFlowState === "ready"',
  'payoutFlowState === "paid"',
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

console.log("Canonical product-experience authority PASS");
