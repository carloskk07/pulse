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

requireText("lib/reward-state.ts", [
  "observedAt: string;",
  "const observedAtMs = Date.now();",
  "const observedAt = new Date(observedAtMs).toISOString();",
]);

requireText("lib/product-experience-core.ts", [
  'export type CoreProductEvent =',
  '"reward-settled"',
  '"payout-ready"',
  '"payout-processing"',
  '"payout-complete"',
  '"network-live"',
  "export function payoutProgressPercent",
  "export function isRecentAuthoritativeEvent",
  "export function deriveEarningPhase",
  "export function deriveEarningEvent",
  "export type CoreProductResidue =",
  "export function deriveEarningResidue",
  "export function deriveWalletResidue",
  "export function deriveProgressResidue",
  "export function deriveNetworkResidue",
  "export function deriveEarningResidueStrength",
  "export function deriveWalletResidueStrength",
  "export function deriveProgressResidueStrength",
  "export function deriveNetworkResidueStrength",
  'export type CoreResidueDimension = "none" | "value" | "signal" | "network"',
  "export function deriveResidueDimension",
  "export const NETWORK_RESIDUE_MILESTONE = 10",
  "export function deriveWalletCore",
  "export function deriveNetworkEvent",
]);

requireText("lib/product-experience.ts", [
  'export type ProductSurface = "reward" | "earn" | "balance" | "payout" | "progress" | "network"',
  "export type ProductEvent = CoreProductEvent",
  "export type ProductResidue = CoreProductResidue",
  "residue: ProductResidue;",
  "residueStrength: number;",
  "residueDimension: ProductResidueDimension;",
  "export function getEarningExperience",
  "export function getWalletExperience",
  "export function getProgressExperience",
  "export function getNetworkExperience",
  "deriveWalletCore({",
  "payoutReadyEvent = false",
  "const event: CoreProductEvent = paid",
  "payoutReadyEvent",
  '? "payout-ready"',
  "referralConfirmed = false",
  'active: referralConfirmed ? 1 : 0',
  "residue: deriveEarningResidue",
  "residue: deriveWalletResidue",
  "residue: deriveProgressResidue",
  "residue: deriveNetworkResidue",
  "residueStrength: deriveEarningResidueStrength",
  "residueStrength: deriveWalletResidueStrength",
  "residueStrength: deriveProgressResidueStrength",
  "residueStrength: deriveNetworkResidueStrength",
  "residueDimension: deriveResidueDimension(residue)",
]);

requireText("components/value-flow.tsx", [
  'import type { ProductJourney } from "@/lib/product-experience";',
  'export function ValueFlow({ journey }: { journey: ProductJourney })',
  'aria-label="Reward value path"',
  'href="/earn"',
  'href="/wallet"',
  'aria-current={stage === "earn" ? "step" : undefined}',
  '"--pc-value-progress"',
  'const compactPayoutLabel = payoutState === "building"',
  'className="pc-value-flow-label-wide"',
  'className="pc-value-flow-label-compact"',
  'aria-label={payoutLabel}',
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
  "data-product-event={experience?.event}",
  "data-product-residue={experience?.residue}",
  "data-product-residue-dimension={experience?.residueDimension}",
  "data-product-residue-strength={residueStrength}",
  '"--pc-residue-strength"',
]);

requireText("app/dashboard/page.tsx", [
  "isRecentAuthoritativeEvent(state.lastClaimAt, Date.parse(state.observedAt))",
  "claimSettled: claimSucceeded",
  '"Reward status refreshed. Your current balance is shown above."',
]);

requireText("app/wallet/page.tsx", [
  'row.label === "Withdrawal"',
  'row.state === "withdrawn"',
  "isRecentAuthoritativeEvent(row.createdAt, Date.parse(state.observedAt), 10 * 60_000)",
  "paid: paidConfirmed",
  "payoutReadyEvent,",
  "requiredWithdrawalCredits",
  "recentPositiveCredit",
  '"Payment status refreshed. The authoritative payout state is shown below."',
  'const payoutFlowState = experience.journey?.payoutState ?? "paused";',
]);

requireText("app/invite/page.tsx", [
  'NETWORK_RESIDUE_MILESTONE',
  '[NETWORK_RESIDUE_MILESTONE, "Referral milestone"]',
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
  "/* V6 — event choreography.",
  '.app-frame[data-product-event="reward-settled"]:after',
  '.app-frame[data-product-event="payout-processing"]:after',
  '.app-frame[data-product-event="payout-complete"] .pc-v3-vault-balance',
  '.app-frame[data-product-event="network-live"] .pc-luxe-invite-hero',
  ".pc-value-flow-label-wide{display:block}",
  ".pc-value-flow-label-compact{display:none}",
  "@media(max-width:760px)",
  ".pc-value-flow-label-wide{display:none}",
  ".pc-value-flow-label-compact{display:block}",
  "@media(prefers-reduced-motion:reduce)",
]);

console.log("Canonical product-experience authority PASS");
