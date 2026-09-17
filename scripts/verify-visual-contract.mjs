import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(path, fragments) {
  const value = read(path);
  for (const fragment of fragments) {
    if (!value.includes(fragment)) {
      throw new Error(`${path} is missing required visual contract: ${fragment}`);
    }
  }
}

function uiFiles(root) {
  const files = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...uiFiles(path));
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) files.push(path);
  }
  return files;
}

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((index) => channel(Number.parseInt(value.slice(index, index + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const layout = read("app/layout.tsx");
const hardeningImport = './styles/pulsercuit-v10-visual-hardening.css';
const auditImport = './styles/pulsercuit-v10-sitewide-audit.css';
if (!layout.includes(hardeningImport)) {
  throw new Error("Root layout must load the V10 visual hardening authority.");
}
if (!layout.includes(auditImport)) {
  throw new Error("Root layout must load the V10 site-wide audit corrections.");
}
if (layout.lastIndexOf(hardeningImport) < layout.lastIndexOf("pulsercuit-v7-audit.css")) {
  throw new Error("V10 visual hardening must remain after legacy visual layers.");
}
if (layout.lastIndexOf(auditImport) < layout.lastIndexOf(hardeningImport)) {
  throw new Error("V10 site-wide audit corrections must remain the final visual authority.");
}

requireText("app/styles/pulsercuit-v10-visual-hardening.css", [
  "/* Pulsercuit V10 — site-wide visual hardening authority.",
  "min-width:320px",
  "overflow-x:clip",
  ".app-nav{",
  "overflow-y:auto",
  ".app-content{",
  "min-width:0",
  "@media(max-width:1180px)",
  ".pc-v9-chamber{",
  "grid-template-columns:1fr!important",
  "@media(max-width:980px)",
  ".app-sidebar{display:none!important}",
  ".bottom-nav{",
  "env(safe-area-inset-bottom)",
  ".admin-provider-table,.prospect-table",
  "overflow-x:auto!important",
  "font-size:16px!important",
  ":focus-visible",
  "@media(prefers-reduced-motion:reduce)",
]);

requireText("app/styles/pulsercuit-v10-sitewide-audit.css", [
  "/* Pulsercuit V10 — site-wide audit corrections.",
  ".completion-page{color-scheme:light}",
  ".completion-page .claim-message.success",
  ".completion-page .status-pill",
  ".direct-campaign-table .admin-provider-row",
  ".business-lead-table{",
  "overflow-x:auto!important",
  ".business-lead-row.header",
  ".turnstile-field{",
  "overflow:visible!important",
  "font-size:max(10px,.625rem)!important",
  ".sidebar-tools a.active",
  ".bottom-nav .bottom-nav-menu>a.active",
  ".pc-luxe-ranked-turbo .reward-row.intelligence-row .reward-metric",
  "grid-template-columns:minmax(220px,1.5fr) repeat(4,minmax(72px,.55fr))!important",
  ".bottom-nav>a,.bottom-nav-more summary{font-size:10px!important}",
  ".pc-v6-header .brand-word{display:inline-flex!important}",
  "grid-template-columns:repeat(2,minmax(0,1fr))!important",
  ".pc-v6-share-cards{grid-template-columns:1fr!important}",
  ".auth-card>small,",
  ".auth-divider,",
  ".auth-help-line{color:#838c99!important}",
  ".completion-page .case-list small{color:#667168!important}",
  ".pc-luxe-quickwins :where(.quick-win-top span,.quick-win-top small,.quick-win-foot span)",
  ".pc-luxe-quickwins .quick-win-foot span{color:#8b94a5!important}",
  ".business-page{overflow-x:clip!important;overflow-y:visible!important}",
  ".business-page .business-form-note{color:#8b94a5!important}",
  ".business-page .business-form input::placeholder,",
  "color:#7d8796!important",
  "@media(max-width:560px){",
  "Do not regress below the readability floor",
  "@media(max-width:420px)",
  ".auth-trust span{font-size:10px!important}",
]);

const contrastPairs = [
  ["completion microcopy", "#566159", "#f5f7f4"],
  ["completion success", "#245a35", "#eaf7ed"],
  ["completion neutral", "#455249", "#f1f4f1"],
  ["completion error", "#842c33", "#fff0f0"],
  ["auth legal and helper copy", "#838c99", "#080a0f"],
  ["completion case metadata", "#667168", "#ffffff"],
  ["business form note", "#8b94a5", "#07090d"],
  ["business form placeholder", "#7d8796", "#0a0e14"],
  ["Turbo Quick Win metadata", "#8b94a5", "#07090d"],
];
for (const [label, foreground, background] of contrastPairs) {
  const ratio = contrast(foreground, background);
  if (ratio < 4.5) throw new Error(`${label} contrast is ${ratio.toFixed(2)}:1; expected at least 4.5:1.`);
}

const auditCss = read("app/styles/pulsercuit-v10-sitewide-audit.css");
const narrowNavContract = "@media(max-width:560px){\n  /* Do not regress below the readability floor on the narrowest phones. */\n  .bottom-nav>a,.bottom-nav-more summary{font-size:10px!important}\n}";
if (!auditCss.includes(narrowNavContract)) {
  throw new Error("Narrow-phone bottom navigation must preserve the 10px readability floor.");
}

requireText("components/turnstile-field.tsx", [
  'type TurnstileTheme = "dark" | "light" | "auto";',
  'theme = "dark"',
  'const size = availableWidth > 0 && availableWidth < 300 ? "compact" : "flexible";',
  "theme,",
  "size,",
]);

requireText("app/support/page.tsx", [
  '<TurnstileField action="support" theme="light" />',
]);

requireText("components/app-shell.tsx", [
  'aria-current={active === id ? "page" : undefined}',
  'className={active === "account" ? "active" : ""}',
  'aria-current={active === "account" ? "page" : undefined}',
  'aria-current={active === "proof" ? "page" : undefined}',
  'aria-current={active === "support" ? "page" : undefined}',
]);

const legacyBrandHits = [...uiFiles("app"), ...uiFiles("components")].filter((path) => read(path).includes("Reward Pulse"));
if (legacyBrandHits.length) {
  throw new Error(`Legacy Reward Pulse UI copy remains in: ${legacyBrandHits.join(", ")}`);
}

for (const path of [
  "app/business/page.tsx",
  "app/business/integration/page.tsx",
  "app/r/[handle]/page.tsx",
]) {
  requireText(path, ["Pulsercuit"]);
}

console.log("Visual hardening contract PASS");
