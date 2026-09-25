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
  'name="pc-route-carrier"',
  'name="pc-route-orbit"',
  'name="pc-route-index"',
  'default="none"',
  '"pc-forward": "pc-route-carrier-forward"',
  '"pc-back": "pc-route-carrier-back"',
  '"pc-forward": "pc-route-orbit-forward"',
  '"pc-back": "pc-route-orbit-back"',
  '"pc-forward": "pc-route-index-forward"',
  '"pc-back": "pc-route-index-back"',
  'className="pc-route-carrier"',
]);

requireText("components/app-shell.tsx", [
  "const routeOrder = new Map",
  "function routeTransitionTypes",
  '"pc-forward"',
  '"pc-back"',
  "transitionTypes={routeTransitionTypes(active, id)}",
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
]);

requireText("scripts/verify-route-continuity-runtime.mjs", [
  "/dashboard",
  "/earn",
  "/wallet",
  "/progress",
  "Document.prototype.startViewTransition",
  "window.__pcRouteTransitionTypes",
  'assertTypes(earn, "pc-forward"',
  'assertTypes(wallet, "pc-forward"',
  'assertTypes(progress, "pc-back"',
  '"prefers-reduced-motion", value: "no-preference"',
  '"prefers-reduced-motion", value: "reduce"',
  "Native route continuity PASS",
]);

const css = read("app/styles/app-art-direction.css");
const sceneCarriers = (css.match(/pc-spatial-atmosphere\[data-scene="(?:home|progress|earn|wallet|invite)"\] \.pc-route-carrier/g) ?? []).length;
if (sceneCarriers < 5) {
  throw new Error(`Route continuity must preserve five scene carrier positions; found ${sceneCarriers}.`);
}

if (/view-transition-name\s*:/.test(css)) {
  throw new Error("V10 must let React own view-transition-name assignment instead of hard-coding CSS names.");
}

for (const forbidden of ["availableCredits", "payoutCredits", "claimReady", "rewardCredits", "ledger"]) {
  const atmosphere = read("components/spatial-atmosphere.tsx");
  if (atmosphere.includes(forbidden)) {
    throw new Error(`Shared transition geometry must not depend on financial state: ${forbidden}`);
  }
}

console.log("Native route continuity static contract PASS");
