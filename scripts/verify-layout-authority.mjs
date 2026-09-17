import { readFileSync } from "node:fs";

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
const touchImport = './styles/pulsercuit-v11-touch-foundation.css';
const authorityImport = './styles/pulsercuit-v11-layout-authority.css';
const v10AuditImport = './styles/pulsercuit-v10-sitewide-audit.css';

for (const item of [touchImport, authorityImport]) {
  if (!layout.includes(item)) throw new Error(`Root layout must load ${item}.`);
}
if (layout.lastIndexOf(touchImport) < layout.lastIndexOf(v10AuditImport)) {
  throw new Error("V11 touch foundation must load after legacy/V10 visual layers.");
}
if (layout.lastIndexOf(authorityImport) < layout.lastIndexOf(touchImport)) {
  throw new Error("V11 layout authority must remain the final visual authority.");
}
const trailingStyleImport = layout.slice(layout.lastIndexOf(authorityImport) + authorityImport.length).match(/styles\/.+\.css/);
if (trailingStyleImport) {
  throw new Error(`No stylesheet may load after V11 layout authority: ${trailingStyleImport[0]}`);
}

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

console.log("V11 layout authority contract PASS");
