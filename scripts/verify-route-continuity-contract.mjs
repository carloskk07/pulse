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

requireText("next.config.ts", [
  "experimental: {",
  "viewTransition: true",
]);

requireText("components/spatial-atmosphere.tsx", [
  'className="pc-route-carrier"',
  "<i />",
  "<b />",
]);

requireText("app/styles/app-art-direction.css", [
  "/* V10 — native route continuity.",
  ".pc-route-carrier{",
  '.pc-spatial-atmosphere[data-scene="home"] .pc-route-carrier',
  '.pc-spatial-atmosphere[data-scene="progress"] .pc-route-carrier',
  '.pc-spatial-atmosphere[data-scene="earn"] .pc-route-carrier',
  '.pc-spatial-atmosphere[data-scene="wallet"] .pc-route-carrier',
  '.pc-spatial-atmosphere[data-scene="invite"] .pc-route-carrier',
  "@supports (view-transition-name: pc-route-carrier)",
  "view-transition-name:pc-route-carrier",
  "view-transition-name:pc-route-orbit",
  "view-transition-name:pc-route-index",
  "view-transition-name:pc-active-nav",
  "view-transition-name:pc-active-nav-mobile",
  "::view-transition-old(root)",
  "::view-transition-group(pc-route-carrier)",
  "::view-transition-group(pc-route-orbit)",
  "::view-transition-group(pc-active-nav)",
  "@media(prefers-reduced-motion:reduce)",
  "view-transition-name:none!important",
]);

requireText("scripts/verify-route-continuity-runtime.mjs", [
  "/dashboard",
  "/earn",
  "/wallet",
  'typeof Document.prototype.startViewTransition !== "function"',
  "pc-route-carrier",
  "pc-route-orbit",
  "pc-route-index",
  "pc-active-nav",
  '"prefers-reduced-motion", value: "no-preference"',
  '"prefers-reduced-motion", value: "reduce"',
  "Native route continuity PASS",
]);

const css = read("app/styles/app-art-direction.css");
const sceneCarriers = (css.match(/pc-spatial-atmosphere\[data-scene="(?:home|progress|earn|wallet|invite)"\] \.pc-route-carrier/g) ?? []).length;
if (sceneCarriers < 5) {
  throw new Error(`Route continuity must preserve five scene carrier positions; found ${sceneCarriers}.`);
}

if (/view-transition-name:\s*pc-route-(?:carrier|orbit|index)[^\n]*\.(?:wallet|balance|reward|claim|payout)/i.test(css)) {
  throw new Error("Route continuity must not bind named transition snapshots to financial-state selectors.");
}

console.log("Native route continuity static contract PASS");
