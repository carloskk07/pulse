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
const pulseExperienceImport = '@import "./styles/pulse-experience.css";';
const themeImport = '@import "./styles/theme.css";';
const touchImport = '@import "./styles/pulsercuit-v11-touch-foundation.css";';
const authorityImport = '@import "./styles/pulsercuit-v11-layout-authority.css";';
const v10AuditImport = '@import "./styles/pulsercuit-v10-sitewide-audit.css";';
const currentImport = '@import "./styles/current.css";';

if (!layout.includes('import "./globals.css";')) {
  throw new Error("Root layout must load the canonical globals.css manifest.");
}
if (layout.includes('import "./styles/')) {
  throw new Error("Root layout must not load visual layers directly; globals.css is the single cascade entry point.");
}

for (const item of [pulseExperienceImport, themeImport, currentImport, touchImport, authorityImport]) {
  if (!manifest.includes(item)) throw new Error(`Canonical manifest must load ${item}.`);
}
if (manifest.lastIndexOf(currentImport) > manifest.lastIndexOf(v10AuditImport)) {
  throw new Error("Extracted current rules must load before release hardening layers.");
}
if (manifest.lastIndexOf(touchImport) < manifest.lastIndexOf(v10AuditImport)) {
  throw new Error("V11 touch foundation must load after V10 visual layers.");
}
if (manifest.lastIndexOf(authorityImport) < manifest.lastIndexOf(touchImport)) {
  throw new Error("V11 layout authority must remain the final visual authority.");
}
const afterAuthority = manifest.slice(manifest.lastIndexOf(authorityImport) + authorityImport.length);
if (/@import\s+["'].+\.css["']/.test(afterAuthority)) {
  throw new Error("No stylesheet may load after V11 layout authority.");
}

const retired = [
  "app/styles/responsive.css",
  "app/styles/pulse-v2.css",
  "app/styles/pulse-v3.css",
  "app/styles/pulse-v3-marketing.css",
  "app/styles/pulsercuit-v4.css",
  "app/styles/pulsercuit-v5.css",
  "app/styles/pulsercuit-v7-fixes.css",
  "app/styles/pulsercuit-v7-audit.css",
  "app/styles/pulsercuit-v7-universe.css",
];
for (const path of retired) {
  if (existsSync(path)) throw new Error(`Retired global visual generation returned: ${path}`);
  const basename = path.split("/").at(-1);
  if (basename && manifest.includes(basename)) throw new Error(`Retired stylesheet is still imported: ${basename}`);
}

const v4 = manifest.indexOf('@import "./styles/pulsercuit-v4-1.css";');
const pulseExperienceIndex = manifest.indexOf(pulseExperienceImport);
if (v4 < 0 || pulseExperienceIndex < 0 || v4 < pulseExperienceIndex) {
  throw new Error("Current Pulse experience must load before retained later feature systems.");
}
const v9 = manifest.indexOf('@import "./styles/pulse-dashboard-v9.css";');
const currentTheme = manifest.indexOf(themeImport);
if (v9 < 0 || currentTheme < 0 || v9 < currentTheme) {
  throw new Error("Dashboard V9 must load after the current unversioned theme, never before it.");
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

requireText("app/styles/theme.css", [
  "/* Pulsercuit current theme.",
  "--pc7-gold:#e6bd5d",
  ".app-frame{",
  ".app-sidebar{",
  ".app-content :where(.balance-chip",
  ".pc-luxe-pulse-stage:before",
  ".pc-luxe-momentum-hero:before",
  ".pc-luxe-vault-balance:before",
  ":where(.proof-page,.business-page,.integration-page,.referral-landing){",
  ".business-page :where(input,textarea,select)",
]);

requireText("app/styles/current.css", [
  "current presentation bridge",
  "--pc-lime:#cfff67",
  ".pc-dashboard-ribbon{",
  ".pc-momentum-card{",
  ".pc-share-preview{",
  ".pc-v5-primary{",
  ".pc-v6-ranks article:nth-child(3):before{display:none!important}",
  "-webkit-mask-image",
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

requireText("app/styles/pulsercuit-v11-layout-authority.css", [
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
]);

requireText("app/styles/pulsercuit-v11-touch-foundation.css", [
  "@media(max-width:1120px)",
  ".bottom-nav{",
  ".bottom-nav-more summary::-webkit-details-marker{display:none}",
  ".bottom-nav-menu{",
  "env(safe-area-inset-bottom)",
]);

console.log("Canonical CSS/layout architecture PASS");
