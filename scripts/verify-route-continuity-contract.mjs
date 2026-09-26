import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(`${path} is missing route-continuity contract: ${fragment}`);
    }
  }
}

const nextConfig = read("next.config.ts");
if (nextConfig.includes("viewTransition:")) {
  throw new Error("Next 16.3 route continuity must not restore the removed experimental.viewTransition flag.");
}

requireText("components/spatial-atmosphere.tsx", [
  'import { ViewTransition } from "react";',
  'key={`carrier-${active}`}',
  'key={`orbit-${active}`}',
  'key={`index-${active}`}',
  'name="pc-route-carrier"',
  'name="pc-route-orbit"',
  'name="pc-route-index"',
  'default="none"',
  'update={{ default: "pc-route-carrier-share", "pc-forward": "pc-route-carrier-forward", "pc-back": "pc-route-carrier-back" }}',
  'update={{ default: "pc-route-orbit-share", "pc-forward": "pc-route-orbit-forward", "pc-back": "pc-route-orbit-back" }}',
  'update={{ default: "pc-route-index-share", "pc-forward": "pc-route-index-forward", "pc-back": "pc-route-index-back" }}',
  '"pc-forward": "pc-route-carrier-forward"',
  '"pc-back": "pc-route-carrier-back"',
  '"pc-forward": "pc-route-orbit-forward"',
  '"pc-back": "pc-route-orbit-back"',
  '"pc-forward": "pc-route-index-forward"',
  '"pc-back": "pc-route-index-back"',
  'className="pc-route-carrier"',
]);

requireText("components/app-shell.tsx", [
  'import { ViewTransition } from "react";',
  "const routeOrder = new Map",
  "function routeTransitionTypes",
  'import { getRouteDimension } from "@/lib/route-dimension";',
  "getRouteDimension(active)",
  "getRouteDimension(target)",
  'pc-transfer-${currentDimension}-${targetDimension}',
  'name="pc-route-topbar"',
  'name="pc-route-bottom-nav"',
  'share="pc-route-nav-anchor"',
  "transitionTypes={routeTransitionTypes(active, id)}",
]);

requireText("lib/route-dimension.ts", [
  'export type RouteDimension = "value" | "signal" | "network"',
  'home: "value"',
  'earn: "value"',
  'wallet: "value"',
  'progress: "signal"',
  'invite: "network"',
  '"/dashboard": "home"',
  '"/progress": "progress"',
  '"/invite": "invite"',
  "export function getRouteDimension",
  "export function getRouteDimensionFromHref",
]);

requireText("components/value-flow.tsx", [
  'const earnTransitionTypes = stage === "earn" ? undefined : ["pc-back"];',
  'const walletTransitionTypes = stage === "earn" ? ["pc-forward"] : undefined;',
  "transitionTypes={earnTransitionTypes}",
  "transitionTypes={walletTransitionTypes}",
]);

requireText("app/styles/app-art-direction.css", [
  "/* V10 — native route continuity.",
  ".pc-route-carrier{",
  '.pc-spatial-atmosphere[data-scene="home"] .pc-route-carrier',
  '.pc-spatial-atmosphere[data-scene="progress"] .pc-route-carrier',
  '.pc-spatial-atmosphere[data-scene="earn"] .pc-route-carrier',
  '.pc-spatial-atmosphere[data-scene="wallet"] .pc-route-carrier',
  '.pc-spatial-atmosphere[data-scene="invite"] .pc-route-carrier',
  "--pc-route-vt-motion:1",
  "::view-transition-group(.pc-route-carrier-forward)",
  "::view-transition-group(.pc-route-carrier-back)",
  "::view-transition-group(.pc-route-orbit-forward)",
  "::view-transition-group(.pc-route-index-forward)",
  "::view-transition-old(.pc-route-carrier-forward)",
  "::view-transition-new(.pc-route-carrier-forward)",
  "::view-transition-old(.pc-route-carrier-back)",
  "::view-transition-new(.pc-route-carrier-back)",
  "@media(prefers-reduced-motion:reduce)",
  "--pc-route-vt-motion:0",
  "--pc-route-vt-carrier-duration:.001ms",
  "/* V10.4 — replaced route-content boundary.",
  "::view-transition-old(.pc-route-content-forward)",
  "::view-transition-new(.pc-route-content-forward)",
  "::view-transition-old(.pc-route-content-back)",
  "::view-transition-new(.pc-route-content-back)",
  "@keyframes pcRouteContentSlide",
  "@keyframes pcRouteContentFade",
  "::view-transition{",
  "pointer-events:none",
  "/* V10.8 page-root navigation anchor */",
  "::view-transition-group(.pc-route-nav-anchor)",
  "/* V11.12 — Selective Semantic Field Bridge.",
  "/* V11.14 — Authoritative Transfer Amplitude.",
  "view-transition-name:pc-spatial-field",
  "--pc-route-transfer-source-strength:0",
  "--pc-transfer-out-opacity:1",
  "--pc-transfer-out-scale-x:1",
  "--pc-transfer-out-scale-y:1",
  "--pc-transfer-out-blur:0px",
  "--pc-transfer-bridge-scale-x:1",
  "--pc-transfer-bridge-scale-y:1",
  "--pc-transfer-bridge-blur:0px",
  "opacity:var(--pc-transfer-out-opacity)",
  "scale(var(--pc-transfer-out-scale-x),var(--pc-transfer-out-scale-y))",
  "scale(var(--pc-transfer-bridge-scale-x),var(--pc-transfer-bridge-scale-y))",
  "--pc-route-transfer-duration:.56s",
  "::view-transition-group(pc-spatial-field)",
  "::view-transition-old(pc-spatial-field)",
  "::view-transition-group(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-value-signal)::view-transition-old(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-signal-value)::view-transition-old(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-value-network)::view-transition-old(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-network-value)::view-transition-old(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-signal-network)::view-transition-old(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-network-signal)::view-transition-old(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-value-signal)::view-transition-group(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-signal-value)::view-transition-group(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-value-network)::view-transition-group(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-network-value)::view-transition-group(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-signal-network)::view-transition-group(pc-spatial-field)",
  "active-view-transition-type(pc-transfer-network-signal)::view-transition-group(pc-spatial-field)",
  "pc-transfer-value-signal",
  "pc-transfer-signal-value",
  "pc-transfer-value-network",
  "pc-transfer-network-value",
  "pc-transfer-signal-network",
  "pc-transfer-network-signal",
  "@keyframes pcTransferValueSignalOut",
  "@keyframes pcTransferSignalValueOut",
  "@keyframes pcTransferValueNetworkOut",
  "@keyframes pcTransferNetworkValueOut",
  "@keyframes pcTransferSignalNetworkOut",
  "@keyframes pcTransferNetworkSignalOut",
  "@keyframes pcTransferValueSignalBridge",
  "@keyframes pcTransferSignalValueBridge",
  "@keyframes pcTransferValueNetworkBridge",
  "@keyframes pcTransferNetworkValueBridge",
  "@keyframes pcTransferSignalNetworkBridge",
  "@keyframes pcTransferNetworkSignalBridge",
  "--pc-route-transfer-duration:.34s",
  "--pc-route-transfer-duration:.28s",
  "filter:none!important",
  "::view-transition-old(.pc-route-nav-anchor)",
  "::view-transition-new(.pc-route-nav-anchor)",
]);

requireText("components/route-page-transition.tsx", [
  'import { ViewTransition } from "react";',
  'key={`route-page-${route}`}',
  '"pc-forward": "pc-route-content-forward"',
  '"pc-back": "pc-route-content-back"',
  "enter={routePageTransition}",
  "exit={routePageTransition}",
  'default="none"',
]);

for (const [path, route] of [
  ["app/dashboard/page.tsx", "home"],
  ["app/progress/page.tsx", "progress"],
  ["app/earn/page.tsx", "earn"],
  ["app/wallet/page.tsx", "wallet"],
  ["app/invite/page.tsx", "invite"],
]) {
  requireText(path, [
    'import { RoutePageTransition } from "@/components/route-page-transition";',
    `<RoutePageTransition route="${route}">`,
    "</RoutePageTransition>",
  ]);
}

requireText("components/view-transition-runtime-fixture.tsx", [
  '"use client";',
  'startTransition',
  'ViewTransition',
  'update="auto"',
  'id="vt-runtime-trigger"',
  'id="vt-runtime-state"',
]);

requireText("app/visual-smoke-fixture/view-transition/page.tsx", [
  'localVisualHost',
  'if (!localVisualHost) notFound();',
  '<ViewTransitionRuntimeFixture />',
]);

requireText("scripts/verify-route-continuity-runtime.mjs", [
  "/visual-smoke-fixture/view-transition",
  "verifyMinimalReactViewTransition",
  'CSS.supports("view-transition-class", "pc-probe")',
  "Minimal React ViewTransition runtime PASS",
  "/dashboard",
  "/earn",
  "/wallet",
  "/progress",
  "Page.addScriptToEvaluateOnNewDocument",
  "waitForHydratedLink",
  "__reactProps$",
  "__reactFiber$",
  "documentId: performance.timeOrigin",
  "full document navigation instead of App Router navigation",
  "Document.prototype.startViewTransition",
  "window.__pcRouteTransitionTypes",
  "window.__pcRouteTransitionAnimations",
  "window.__pcRouteTransitionHistory",
  "entry.samples",
  "requestAnimationFrame(sampleFrame)",
  "transition?.updateCallbackDone",
  "carrierDuration",
  "orbitDuration",
  "indexDuration",
  'transferDuration: rootStyle.getPropertyValue("--pc-route-transfer-duration").trim()',
  "assertReducedMotionState",
  'state?.motion !== "0"',
  "transition?.types",
  "entry.animationNames",
  "entry.animationEvidence",
  "transferSourceStrength",
  "transferPair",
  "transferSource",
  "transferOpacity",
  "transferScaleX",
  "transferScaleY",
  "transferRotate",
  "transferBlur",
  "bridgeScaleX",
  "bridgeScaleY",
  "bridgeRotate",
  "bridgeBlur",
  "secondaryAnimation",
  "secondaryPseudo",
  ":active-view-transition-type(",
  "waitForTransitionTypes",
  "assertNoSemanticRootAnimation",
  "verifyAuthoritativeTransferAmplitude",
  "assertTransferAmplitude",
  '"Fixture Value 83 → Signal"',
  '"Fixture Signal 94 → Network"',
  "strength: 83",
  "strength: 94",
  '"::view-transition-old(pc-spatial-field)"',
  '"::view-transition-group(pc-spatial-field)"',
  '"pcTransferSignalValueBridge"',
  '"pcTransferNetworkSignalBridge"',
  "probeInstalled",
  'waitForTransitionTypes(send, ["pc-forward"], earnCallsBefore, "Rewards → Earn")',
  'assertNoSemanticTransfer(earn, earnCallsBefore, "Rewards → Earn")',
  'assertReducedMotionState(reducedProgress, "Earn → Progress")',
  'crossRoute("/wallet", "pc-forward", "pc-transfer-signal-value"',
  'crossRoute("/invite", "pc-forward", "pc-transfer-value-network"',
  'crossRoute("/wallet", "pc-back", "pc-transfer-network-value"',
  'crossRoute("/progress", "pc-back", "pc-transfer-value-signal"',
  'crossRoute("/invite", "pc-forward", "pc-transfer-signal-network"',
  'crossRoute("/progress", "pc-back", "pc-transfer-network-signal"',
  '"prefers-reduced-motion", value: "no-preference"',
  '"prefers-reduced-motion", value: "reduce"',
  "width: 390",
  "height: 844",
  "mobile: true",
  'transferDuration !== ".28s"',
  '"Mobile Progress → Referrals"',
  '"Mobile Referrals → Progress"',
  '"Mobile semantic bridge"',
  '"Mobile Progress → Balance"',
  "Native route continuity PASS",
]);


const atmosphereSource = read("components/spatial-atmosphere.tsx");
if (atmosphereSource.includes("pc-route-field") || atmosphereSource.includes("pc-route-field-transfer")) {
  throw new Error("Semantic route transfer must use the selective CSS-owned spatial bridge, not an inactive parent React ViewTransition boundary.");
}

const appShell = read("components/app-shell.tsx");
if (appShell.includes("routeContentTransition") || appShell.includes('key={`route-content-${active}`}')) {
  throw new Error("Route ViewTransition must live before AppShell DOM, not inside the persistent shell.");
}

const css = read("app/styles/app-art-direction.css");
const semanticBlock = css.indexOf("/* V11.12 — Selective Semantic Field Bridge.");
const mobileDuration820 = css.indexOf("--pc-route-transfer-duration:.34s", semanticBlock);
const mobileDuration560 = css.indexOf("--pc-route-transfer-duration:.28s", semanticBlock);
const reducedDuration = css.indexOf("--pc-route-transfer-duration:.001ms", semanticBlock);
if (!(semanticBlock >= 0 && mobileDuration820 > semanticBlock && mobileDuration560 > mobileDuration820 && reducedDuration > mobileDuration560)) {
  throw new Error("Semantic bridge durations must remain ordered desktop → 820px → 560px → reduced-motion.");
}

const sceneCarriers = (css.match(/pc-spatial-atmosphere\[data-scene="(?:home|progress|earn|wallet|invite)"\] \.pc-route-carrier/g) ?? []).length;
if (sceneCarriers < 5) {
  throw new Error(`Route continuity must preserve five scene carrier positions; found ${sceneCarriers}.`);
}

const explicitViewTransitionNames = css.match(/view-transition-name\s*:/g) ?? [];
if (explicitViewTransitionNames.length !== 1 || !css.includes("view-transition-name:pc-spatial-field;")) {
  throw new Error(
    `Route continuity permits exactly one CSS-owned View Transition name for the selective spatial field; found ${explicitViewTransitionNames.length}.`,
  );
}
if (/active-view-transition-type\(pc-transfer-[^)]+\)::view-transition-old\(root\)/.test(css)) {
  throw new Error("Semantic route deformation must not be bound to the root snapshot.");
}

for (const forbidden of ["availableCredits", "payoutCredits", "claimReady", "rewardCredits", "ledger"]) {
  const atmosphere = read("components/spatial-atmosphere.tsx");
  if (atmosphere.includes(forbidden)) {
    throw new Error(`Shared transition geometry must not depend on financial state: ${forbidden}`);
  }
}

console.log("Native route continuity static contract PASS");
