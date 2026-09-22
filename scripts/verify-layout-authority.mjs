import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(path, fragments) {
  const value = read(path);
  for (const fragment of fragments) {
    if (!value.includes(fragment)) {
      throw new Error(`${path} is missing required layout contract: ${fragment}`);
    }
  }
}

const layout = read("app/layout.tsx");
const manifest = read("app/globals.css");
const theme = read("app/styles/theme.css");
const pulseExperience = read("app/styles/pulse-experience.css");
const momentum = read("app/styles/momentum.css");
const luxe = read("app/styles/luxe.css");

const imports = {
  pulseExperience: '@import "./styles/pulse-experience.css";',
  momentum: '@import "./styles/momentum.css";',
  shareStudio: '@import "./styles/share-studio.css";',
  nextCircuit: '@import "./styles/next-circuit.css";',
  postClaim: '@import "./styles/post-claim.css";',
  luxe: '@import "./styles/luxe.css";',
  home: '@import "./styles/home.css";',
  theme: '@import "./styles/theme.css";',
  dashboardCommand: '@import "./styles/dashboard-command-center.css";',
  dashboardRefinement: '@import "./styles/dashboard-refinement.css";',
  current: '@import "./styles/current.css";',
  visualHardening: '@import "./styles/visual-hardening.css";',
  sitewideAudit: '@import "./styles/sitewide-audit.css";',
  touchFoundation: '@import "./styles/touch-foundation.css";',
  layoutAuthority: '@import "./styles/layout-authority.css";',
};

if (!layout.includes('import "./globals.css";')) {
  throw new Error("Root layout must load the canonical globals.css manifest.");
}
if (layout.includes('import "./styles/')) {
  throw new Error("Root layout must not load visual layers directly; globals.css is the single cascade entry point.");
}

for (const item of Object.values(imports)) {
  if (!manifest.includes(item)) throw new Error(`Canonical manifest must load ${item}.`);
}

const ordered = [
  imports.pulseExperience,
  imports.momentum,
  imports.shareStudio,
  imports.nextCircuit,
  imports.postClaim,
  imports.luxe,
  imports.home,
  imports.theme,
  imports.dashboardCommand,
  imports.dashboardRefinement,
  imports.current,
  imports.visualHardening,
  imports.sitewideAudit,
  imports.touchFoundation,
  imports.layoutAuthority,
];
let previous = -1;
for (const item of ordered) {
  const index = manifest.indexOf(item);
  if (index <= previous) throw new Error(`Canonical CSS cascade order drifted at ${item}.`);
  previous = index;
}

const afterAuthority = manifest.slice(manifest.indexOf(imports.layoutAuthority) + imports.layoutAuthority.length);
if (/@import\s+["'].+\.css["']/.test(afterAuthority)) {
  throw new Error("No stylesheet may load after the canonical layout authority.");
}

const retired = [
  "app/styles/responsive.css",
  "app/styles/pulse-v2.css",
  "app/styles/pulse-v3.css",
  "app/styles/pulse-v3-marketing.css",
  "app/styles/pulsercuit-v4.css",
  "app/styles/pulsercuit-v4-1.css",
  "app/styles/pulsercuit-v4-2.css",
  "app/styles/pulse-v4-3.css",
  "app/styles/pulse-v4-3-retention.css",
  "app/styles/pulse-v4-3-postclaim.css",
  "app/styles/pulsercuit-v5.css",
  "app/styles/pulsercuit-v5-1.css",
  "app/styles/pulsercuit-v5-1-surfaces.css",
  "app/styles/pulsercuit-v6.css",
  "app/styles/pulsercuit-v6-fixes.css",
  "app/styles/pulsercuit-v6-reference.css",
  "app/styles/pulsercuit-v6-ultra.css",
  "app/styles/pulsercuit-v6-material.css",
  "app/styles/pulsercuit-v6-sensory.css",
  "app/styles/pulsercuit-v7-fixes.css",
  "app/styles/pulsercuit-v7-audit.css",
  "app/styles/pulsercuit-v7-universe.css",
  "app/styles/pulse-dashboard-v9.css",
  "app/styles/pulse-dashboard-v9-1.css",
  "app/styles/pulsercuit-v10-visual-hardening.css",
  "app/styles/pulsercuit-v10-sitewide-audit.css",
  "app/styles/pulsercuit-v11-touch-foundation.css",
  "app/styles/pulsercuit-v11-layout-authority.css",
];
for (const path of retired) {
  if (existsSync(path)) throw new Error(`Retired visual-generation filename returned: ${path}`);
  const basename = path.split("/").at(-1);
  if (basename && manifest.includes(basename)) throw new Error(`Retired stylesheet is still imported: ${basename}`);
}

if (theme.includes("main:not(")) {
  throw new Error("Current theme must use explicit page scopes; broad exclusion selectors are forbidden.");
}
if (theme.includes(".completion-page")) {
  throw new Error("Dark current theme must not target the light completion/legal surface family.");
}

for (const forbidden of [".app-frame{", ".app-sidebar{", ".auth-page{", ".proof-page{", ".brand-mark{"]) {
  if (pulseExperience.includes(forbidden)) {
    throw new Error(`Pulse experience must not own a retired global surface: ${forbidden}`);
  }
}
for (const forbidden of [".app-frame{", ".app-sidebar{", ".auth-page{", ".proof-page{", ".bottom-nav{", ".pc-scene-strip{"]) {
  if (momentum.includes(forbidden)) {
    throw new Error(`Momentum experience must not own unrelated historical surface: ${forbidden}`);
  }
}
for (const forbidden of ["body{", ".app-frame{", ".app-sidebar{", ".app-nav ", ".bottom-nav{", ".pc-luxe-marketing", ".pc-luxe-hero{", ".pc-luxe-claim-handoff"]) {
  if (luxe.includes(forbidden)) {
    throw new Error(`Luxe finish must not reclaim a retired global/superseded surface: ${forbidden}`);
  }
}

requireText("app/styles/pulse-experience.css", [
  "/* Current Pulse experience.",
  "--pulse-v3-lime:#cfff67",
  "--pulse-v2-accent:var(--pulse-v3-lime)",
  ".pc-v9-dashboard .balance-chip-v2{",
  ".pc-v9-dashboard .hourly-pulse-card{",
  ".pulse-core-visual{",
  ".pulse-core-field{",
  ".pulse-core-ring.ring-four{",
  ".pulse-core-visual.is-paused",
  ".pc-v9-dashboard .pulse-integrity-rail{",
  ".pc-v9-dashboard .pulse-onboarding{",
  "@media(prefers-reduced-motion:reduce)",
]);
requireText("app/styles/momentum.css", [
  "/* Current Momentum experience.",
  ".pc-signal-grid{",
  ".pc-missions-card{",
  ".pc-mission-list{",
  ".pc-share-rhythm{",
  ".pc-progress-hero{",
  ".pc-identity-card{",
  ".pc-weekly-card,.pc-retention-callout{",
  ".pc-achievement-grid{",
  ".pc-progress-cta{",
]);
requireText("app/styles/share-studio.css", [
  "/* Pulsercuit V4.3 — factual social moments */",
  ".pc-share-studio{",
  ".pc-share-moment-card{",
  ".pc-share-moment-foot button{",
]);
requireText("app/styles/next-circuit.css", [
  "/* Pulsercuit V4.3 — factual retention / Next Circuit */",
  ".pc-next-circuit{",
  ".pc-next-primary{",
  ".pc-next-reminder{",
]);
requireText("app/styles/post-claim.css", [
  "/* Pulsercuit V8 — premium post-claim progress experience */",
  ".pc-v8-victory{",
  ".pc-v8-progress-zone{",
  ".pc-v8-return-stage{",
]);
requireText("app/styles/luxe.css", [
  "/* Current Luxe product finish.",
  "--luxe-gold:#efd08a",
  ".pc-luxe-dashboard-head h1{",
  ".pc-luxe-pulse-chamber{",
  ".pc-luxe-momentum-head h1{",
  ".pc-luxe-share-studio{",
  ".pc-luxe-invite-hero{",
  ".pc-luxe-vault-balance{",
  ".pc-luxe-best-turbo{",
  ".pc-luxe-auth-card h2{",
]);
requireText("app/styles/dashboard-command-center.css", [
  "/* Pulsercuit Dashboard V9 — live command center */",
  ".pc-v9-dashboard{",
  ".pc-v9-chamber{",
  ".pc-v9-progress-deck{",
]);
requireText("app/styles/dashboard-refinement.css", [
  "/* Pulsercuit Dashboard V9.1 — composition, hierarchy and density refinement */",
  ".pc-v9-dashboard{",
  ".pc-v9-chamber{",
  "@media(max-width:1100px)",
]);
requireText("app/styles/auth.css", [
  "/* Product-rail visual belongs to authentication",
  ".auth-circuit-visual{",
  ".auth-circuit-core{",
  ".auth-circuit-node.node-pulse",
]);
requireText("app/styles/completion.css", [
  "/* Support evidence guidance belongs to the light support surface. */",
  ".completion-page .support-proof-note{",
  ".completion-page .support-proof-note i{",
]);
requireText("app/styles/theme.css", [
  "/* Pulsercuit current theme.",
  "--pc7-gold:#e6bd5d",
  ".app-frame{",
  ".app-sidebar{",
  ".app-content :where(.balance-chip",
  ".pc-luxe-pulse-stage:before",
  ".pc-luxe-momentum-hero:before",
  ".pc-luxe-vault-balance:before",
  ".pc-luxe-auth-card{",
  ".pc-luxe-auth-copy h1 em{",
  ":where(.proof-page,.business-page,.integration-page,.referral-landing){",
  ".business-page :where(input,textarea,select)",
]);
requireText("app/styles/current.css", [
  "current semantic bridge",
  '@import "./current/tokens.css";',
  '@import "./current/dashboard-components.css";',
  '@import "./current/share-preview.css";',
  '@import "./current/momentum-actions.css";',
  '@import "./current/compatibility-hardening.css";',
  '@import "./current/responsive-contracts.css";',
]);

requireText("components/pulse-core-visual.tsx", [
  'className={`pulse-core-visual is-${state}`}',
  'className="pulse-core-field"',
  'className="pulse-core-ring ring-four"',
  'className="pulse-core-heart"',
  'className="pulse-core-readout"',
]);
requireText("components/site-header.tsx", [
  'export function SiteHeader({ overlay = false }',
  'overlay ? "is-overlay" : "is-flow"',
  'className="shell pc-v6-shell pc-v6-header-inner"',
]);
requireText("app/page.tsx", ["<SiteHeader overlay />"]);
requireText("app/proof/page.tsx", ["<SiteHeader />"]);
requireText("app/business/page.tsx", ["<SiteHeader />"]);
requireText("app/business/integration/page.tsx", ["<SiteHeader />"]);

requireText("app/styles/layout-authority.css", [
  "/* Pulsercuit V11 — canonical layout authority.",
  "--pc11-public-max:1200px",
  ".shell,.pc-v6-shell{",
  ".pc-v6-header.is-flow{",
  "position:relative!important",
  ".pc-v6-header.is-overlay{",
  ".app-content{",
  "max-width:var(--pc11-app-max)!important",
  "@media(max-width:1400px)",
  ".pc-v9-chamber{",
  "@media(max-width:1120px)",
  ".app-sidebar{display:none!important}",
  ".completion-page{",
  "background:#f5f7f4!important",
  ".completion-page::before,.completion-page::after",
  ".auth-shell{grid-template-columns:1fr!important",
  ".pc-v6-pillar-grid,.pc-v6-share-cards{grid-template-columns:1fr!important",
  ".pc-v6:not(.pc-home-lobby) .pc-v6-login{display:none!important}",
  ".pc-home-lobby .pc-v6-login{display:inline-flex!important}",
]);
requireText("app/styles/touch-foundation.css", [
  "@media(max-width:1120px)",
  ".bottom-nav{",
  ".bottom-nav-more summary::-webkit-details-marker{display:none}",
  ".bottom-nav-menu{",
  "env(safe-area-inset-bottom)",
]);

if (/(^|\\n)\\s*\\.pc-v6-login\\{display:none!important\\}/.test(readFileSync("app/styles/layout-authority.css", "utf8"))) {
  throw new Error("Canonical layout must not suppress the Home login with a global mobile rule.");
}

console.log("Canonical CSS/layout architecture PASS");
