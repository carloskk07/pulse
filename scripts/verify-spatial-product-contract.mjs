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
  "<SpatialAtmosphere active={active} />",
  'data-product-surface={experience?.surface}',
  'data-product-phase={experience?.phase}',
  'data-product-event={experience?.event}',
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
  '.app-frame[data-section="home"] .pc-v9-chamber',
  '.app-frame[data-section="earn"] .pc-luxe-best-turbo',
  '.app-frame[data-section="wallet"] .pc-v3-vault-balance',
  '.app-frame[data-section="progress"] .pc-v3-prestige-card',
  '.app-frame[data-section="invite"] .pc-luxe-invite-hero',
  "@media(max-width:820px)",
  "@media(max-width:560px)",
  ".pc-scene-telemetry{",
  ".pc-scene-telemetry-item{",
  ".pc-scene-telemetry-orbit{",
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
