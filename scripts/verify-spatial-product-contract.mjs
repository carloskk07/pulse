import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(`${path} is missing spatial-product contract: ${fragment}`);
    }
  }
}

requireText("components/scene-telemetry.tsx", [
  'variant: "reward" | "earn" | "wallet" | "progress" | "invite"',
  'aria-label="Current product state"',
  'className="pc-scene-telemetry-orbit"',
  'className={\`pc-scene-telemetry-item item-\${index + 1}\`}',
]);

for (const [path, variant] of [
  ["app/dashboard/page.tsx", 'variant="reward"'],
  ["app/earn/page.tsx", 'variant="earn"'],
  ["app/wallet/page.tsx", 'variant="wallet"'],
  ["app/progress/page.tsx", 'variant="progress"'],
  ["app/invite/page.tsx", 'variant="invite"'],
]) {
  requireText(path, [
    'import { SceneTelemetry } from "@/components/scene-telemetry";',
    "<SceneTelemetry",
    variant,
  ]);
}

requireText("components/spatial-atmosphere.tsx", [
  'home: { index: "01", label: "REWARD FIELD"',
  'progress: { index: "02", label: "PROGRESS FIELD"',
  'earn: { index: "03", label: "EARNING FIELD"',
  'wallet: { index: "04", label: "PAYOUT FIELD"',
  'invite: { index: "05", label: "NETWORK FIELD"',
  'className="pc-spatial-atmosphere"',
  'aria-hidden="true"',
  'className="pc-space-grid"',
  'className="pc-space-plane plane-a"',
  'className="pc-space-orbit orbit-a"',
]);

requireText("components/app-shell.tsx", [
  'import { SpatialAtmosphere } from "./spatial-atmosphere";',
  'import { ProductInteractionLayer } from "./product-interaction-layer";',
  'import { SystemEventField, type SystemEventCue } from "./system-event-field";',
  "<SpatialAtmosphere active={active} />",
  "<ProductInteractionLayer />",
  "const routeDimension = new Map",
  'pc-transfer-${currentDimension}-${targetDimension}',
  "<SystemEventField cue={eventCue} />",
  "eventCue?: SystemEventCue | null",
  'data-product-surface={experience?.surface}',
  'data-product-phase={experience?.phase}',
  'data-product-event={experience?.event}',
  'data-product-residue={experience?.residue}',
  'data-product-residue-dimension={experience?.residueDimension}',
  'data-product-residue-strength={residueStrength}',
  '"--pc-residue-strength"',
]);


requireText("components/system-event-field.tsx", [
  '"use client";',
  'export type SystemEventKind =',
  '"reward-settled"',
  '"payout-ready"',
  '"payout-complete"',
  '"rank-up"',
  '"referral-confirmed"',
  'const SEEN_KEY = "pc-system-event-seen:v1"',
  'window.sessionStorage',
  'const rootRef = useRef<HTMLDivElement>(null)',
  'frame?.setAttribute("data-system-event", cue.kind)',
  'root.classList.add("is-visible")',
  'data-system-event-cue={cue.kind}',
  'aria-live="polite"',
]);

requireText("lib/product-experience.ts", [
  "export type ProductResidue = CoreProductResidue",
  "residue: ProductResidue;",
  "residueStrength: number;",
  "residueDimension: ProductResidueDimension;",
  "const residue = deriveEarningResidue({",
  "const residue = deriveWalletResidue({",
  "const residue = deriveProgressResidue({",
  "const residue = deriveNetworkResidue({ signedIn, active, waiting });",
  "residueStrength: deriveEarningResidueStrength",
  "residueStrength: deriveWalletResidueStrength",
  "residueStrength: deriveProgressResidueStrength",
  "residueStrength: deriveNetworkResidueStrength",
  "residueDimension: deriveResidueDimension(residue)",
  "payoutReadyEvent = false",
  "payoutReadyEvent?: boolean",
  "referralConfirmed = false",
  "referralConfirmed?: boolean",
  'active: referralConfirmed ? 1 : 0',
]);

requireText("app/dashboard/claimed/page.tsx", [
  'kind: "reward-settled" as const',
  'kind: "rank-up" as const',
  "previousSignal",
  "rankAdvanced",
  '"Progress advanced"',
  "eventCue={eventCue}",
]);

requireText("app/wallet/page.tsx", [
  "recentPositiveCredit",
  "requiredWithdrawalCredits",
  "&& canWithdraw",
  "payoutReadyTargetLabel",
  "payoutReadyEvent",
  'kind: "payout-complete" as const',
  'kind: "payout-ready" as const',
  "eventCue={eventCue}",
]);

requireText("app/invite/page.tsx", [
  "recentReferralReward",
  "referralConfirmed: Boolean(recentReferralReward)",
  'kind: "referral-confirmed" as const',
  "eventCue={eventCue}",
]);

requireText("app/visual-smoke-fixture/core-state/page.tsx", [
  'event?: string',
  'params.event === "reward-settled"',
  'kind: "reward-settled" as const',
  "eventCue={eventCue}",
]);

requireText(".github/workflows/visual-smoke.yml", [
  "local-preview/system-event/desktop/reward-settled.png",
  "local-preview/system-event/mobile/reward-settled.png",
  'test "$count" -eq 94',
  'test "$count" -eq 106',
]);

requireText("components/product-interaction-layer.tsx", [
  '"use client";',
  'const REACTIVE_SELECTOR = [',
  '".pc-v9-chamber"',
  '".pc-luxe-best-turbo"',
  '".pc-v3-vault-balance"',
  '".pc-v3-prestige-card"',
  '".pc-luxe-invite-hero"',
  '".pc-value-flow"',
  '"--pc-field-x-near"',
  '"--pc-surface-x"',
  'frame.dataset.productInteraction',
  'frame.addEventListener("pointermove"',
  'frame.addEventListener("pointerdown"',
  'window.matchMedia("(prefers-reduced-motion: reduce)")',
]);

requireText("app/styles/app-art-direction.css", [
  "/* V7 — Spatial Product System.",
  ".pc-spatial-atmosphere{",
  '.pc-spatial-atmosphere[data-scene="home"]',
  '.pc-spatial-atmosphere[data-scene="earn"]',
  '.pc-spatial-atmosphere[data-scene="wallet"]',
  '.pc-spatial-atmosphere[data-scene="progress"]',
  '.pc-spatial-atmosphere[data-scene="invite"]',
  ".pc-value-flow{",
  "/* V9 — Reactive Spatial Continuity.",
  '@keyframes pcRouteFieldArrive',
  '.app-frame[data-product-interaction="reactive"] .pc-space-grid',
  '.pc-v9-chamber.pc-interaction-active .pc-dashboard-reward-art',
  '.pc-luxe-best-turbo.pc-interaction-active .pc-turbo-orb',
  '.pc-v3-vault-balance.pc-interaction-active .pc-v3-vault-visual',
  '.pc-v3-prestige-card.pc-interaction-active .pc-v3-progress-orbit',
  '.pc-luxe-invite-hero.pc-interaction-active .pc-invite-visual-stage',
  '.pc-value-flow.pc-interaction-active>a.active .pc-value-flow-index',
  '.pc-interaction-pressed :is(',
  '.app-frame[data-section="home"] .pc-v9-chamber',
  '.app-frame[data-section="earn"] .pc-luxe-best-turbo',
  '.app-frame[data-section="wallet"] .pc-v3-vault-balance',
  '.app-frame[data-section="progress"] .pc-v3-prestige-card',
  '.app-frame[data-section="invite"] .pc-luxe-invite-hero',
  "@media(max-width:820px)",
  '.app-frame[data-section="earn"] .pc-earn-head-copy{order:1!important}',
  '.app-frame[data-section="earn"] .pc-scene-telemetry{order:2!important}',
  '.app-frame[data-section="earn"] .pc-earn-head-visual{order:3!important}',
  "@media(max-width:560px)",
  ".pc-scene-telemetry{",
  ".pc-scene-telemetry-item{",
  ".pc-scene-telemetry-orbit{",
  "/* V11.4 — Authoritative System Event Field.",
  ".pc-system-event-field{",
  ".pc-system-event-field.is-visible{",
  ".pc-system-event-card{",
  ".pc-system-event-field.is-visible .pc-system-event-card{",
  ".app-frame[data-system-event]:after{",
  "@keyframes pcSystemEventCard",
  "@keyframes pcSystemEventWave",
  "/* V11.5 — Authoritative State Residue.",
  "/* V11.6 — Proportional Residue Energy.",
  "/* V11.7 — Dimensional Residue Field.",
  "/* V11.8 — Dimensional Channel Isolation.",
  "/* V11.11 — Selective Semantic Field Transfer.",
  "view-transition-name:pc-spatial-field",
  "pc-transfer-value-signal",
  "pc-transfer-signal-value",
  "pc-transfer-value-network",
  "pc-transfer-network-value",
  "pc-transfer-signal-network",
  "pc-transfer-network-signal",
  "active-view-transition-type(pc-transfer-value-signal)::view-transition-old(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-network-signal)::view-transition-old(pc-spatial-field)",
  "--pc-route-transfer-duration:.34s",
  "--pc-route-transfer-duration:.28s",
  "filter:none!important",
  'data-product-residue-dimension="value"',
  'data-product-residue-dimension="signal"',
  'data-product-residue-dimension="network"',
  "--pc-dimension-line:",
  '.app-frame[data-product-residue-dimension="value"] :is(',
  '.app-frame[data-product-residue-dimension="signal"] .pc-space-orbit.orbit-b',
  '.app-frame[data-product-residue-dimension="network"] .pc-space-orbit.orbit-a',
  "--pc-residue-line-max:",
  "--pc-residue-glow:",
  '.app-frame[data-product-residue]:not([data-product-residue="none"]) .pc-route-carrier',
  '.app-frame[data-product-residue="balance-funded"] :is(',
  '.app-frame[data-product-residue="payout-ready"] .pc-v3-vault-balance',
  '.app-frame[data-product-residue^="rank-"] .pc-v3-prestige-card',
  '.app-frame[data-product-residue="network-active"] .pc-luxe-invite-hero',
  "@media(prefers-reduced-motion:reduce)",
]);

const css = read("app/styles/app-art-direction.css");
const routeScenes = (css.match(/pc-spatial-atmosphere\[data-scene=/g) ?? []).length;
if (routeScenes < 5) {
  throw new Error(`Spatial system must keep at least five route-specific scene contracts; found ${routeScenes}.`);
}

const component = read("components/spatial-atmosphere.tsx");
if (/\b(balance|credits|payoutProgress|rewardCredits)\b/.test(component)) {
  throw new Error("Spatial atmosphere must remain decorative and must not invent financial state.");
}

console.log("Spatial product composition contract PASS");
