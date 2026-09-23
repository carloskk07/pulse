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

const manifest = read("app/globals.css");
const hardeningImport = '@import "./styles/visual-hardening.css";';
const auditImport = '@import "./styles/sitewide-audit.css";';
const currentImport = '@import "./styles/current.css";';
const touchImport = '@import "./styles/touch-foundation.css";';
const visualAuditImport = '@import "./styles/visual-audit.css";';
const authorityImport = '@import "./styles/layout-authority.css";';

for (const item of [currentImport, hardeningImport, auditImport, touchImport, visualAuditImport, authorityImport]) {
  if (!manifest.includes(item)) throw new Error(`Canonical CSS manifest must load ${item}.`);
}
if (manifest.lastIndexOf(hardeningImport) < manifest.lastIndexOf(currentImport)) {
  throw new Error("Visual hardening must remain after extracted current rules.");
}
if (manifest.lastIndexOf(auditImport) < manifest.lastIndexOf(hardeningImport)) {
  throw new Error("Site-wide audit corrections must remain after visual hardening.");
}
if (manifest.lastIndexOf(touchImport) < manifest.lastIndexOf(auditImport)) {
  throw new Error("Touch foundation must remain after site-wide audit corrections.");
}
if (manifest.lastIndexOf(visualAuditImport) < manifest.lastIndexOf(touchImport)) {
  throw new Error("Current visual audit must remain after touch foundation.");
}
if (manifest.lastIndexOf(authorityImport) < manifest.lastIndexOf(visualAuditImport)) {
  throw new Error("Layout authority must remain the final visual authority.");
}

requireText("app/styles/visual-hardening.css", [
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

requireText("app/styles/sitewide-audit.css", [
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
  "/* Fourth-pass release audit:",
  "--muted-2:#818b9a;",
  "--pulse-muted-2:#818b9a;",
  ".auth-page,\n.referral-landing{overflow-x:clip!important;overflow-y:visible!important}",
  ".referral-landing .referral-funnel>small{font-size:11px!important;line-height:1.55!important}",
  ".integration-path-grid article>span,",
  ".prospect-signal-fieldset legend,",
  ".admin-badge{",
  ".pc-v6-header .pc-v6-button.compact{min-height:44px}",
  ".completion-header nav a,",
  ".integration-code{font-size:11px!important;line-height:1.7}",
]);

requireText("app/styles/visual-audit.css", [
  "/* Current visual audit refinements.",
  ".pc-visual-story{",
  ".pc-luxe-invite-hero{",
  ".pc-luxe-vault-balance:before{",
  ".pc-turbo-orb{",
  ".app-frame .account-grid .completion-card{",
  "color-scheme:dark;",
  ".app-frame .account-grid .completion-form input{",
  ".app-frame .account-grid .inline-action{color:#d9ff72!important}",
  ".app-frame .account-grid .button-secondary{",
  ".pc-v8-vault-orbit{",
  ".pc-v8-orbit-ring{",
  ".pc-v8-reward-line small,",
  ".pc-v8 .pc-v8-return-core>p{",
  ".system-state-page{",
  ".system-state-shell{",
  ".system-state-visual{",
  ".system-state-progress{",
  ".app-frame .admin-head p{",
  ".app-frame .readiness-summary p,",
  ".app-frame .admin-decision-card p{",
]);

requireText("proxy.ts", [
  'matchesPrefix(pathname, "/visual-smoke-fixture")',
  'request.headers.get("x-forwarded-host")',
  "const effectiveHost = forwardedHost || host",
  'effectiveHost.startsWith("127.0.0.1:")',
  'effectiveHost.startsWith("localhost:")',
  'status: 404',
  '"Cache-Control": "no-store, max-age=0"',
]);

requireText(".github/workflows/visual-smoke.yml", [
  '"privacy|/privacy"',
  '"terms|/terms"',
  '"rewards-policy|/rewards-policy"',
  '"auth-recover|/auth/recover"',
  '"faucet|/faucet"',
  '"advertise|/advertise"',
  '"/__visual-smoke-not-found__"',
  '"scripts/capture-public-full-page.mjs"',
  "Capture full-page public evidence",
  'test "$count" -eq 82',
  'test "$count" -eq 90',
  "local-preview/claim-reveal/desktop",
  "production-fixture-isolation",
]);

requireText("scripts/capture-public-full-page.mjs", [
  '["home", "/"]',
  '["faucet", "/faucet"]',
  '["proof", "/proof"]',
  '["auth", "/auth"]',
  '["desktop", 1440, 900]',
  '["mobile", 390, 844]',
  '"Page.getLayoutMetrics"',
  '"Page.captureScreenshot"',
  "captureBeyondViewport: true",
  'name: "prefers-reduced-motion", value: "reduce"',
  "captureHeight > 20000",
]);

requireText("app/styles/theme.css", [
  ".app-content .wallet-balance-card{color:var(--pc7-text)!important}",
  ".app-content .wallet-balance-card>div:nth-child(2)>span{color:var(--pc7-lime)!important}",
  ".app-content .wallet-balance-card>div:nth-child(2)>small{color:var(--pc7-muted)!important}",
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
  ["dark product secondary copy", "#818b9a", "#11151d"],
  ["account dark-card action", "#d9ff72", "#111512"],
  ["account dark-card metadata", "#aeb6b0", "#111512"],
  ["account dark-card input placeholder", "#818b9a", "#0d100e"],
  ["public chamber live detail", "#818b83", "#0e1312"],
  ["dark balance metadata", "#8b94a5", "#12161f"],
  ["Vault primary value", "#f7f2e6", "#111713"],
  ["Vault available label", "#d9ff72", "#111713"],
  ["Vault balance metadata", "#9b9d95", "#111713"],
  ["post-claim readable metadata", "#89948f", "#090d0d"],
  ["system state secondary copy", "#aeb6b0", "#050706"],
  ["system state metadata", "#89948f", "#050706"],
  ["admin heading secondary copy", "#aeb6b0", "#030504"],
  ["admin explanatory copy", "#9aa39f", "#0d1016"],
];
for (const [label, foreground, background] of contrastPairs) {
  const ratio = contrast(foreground, background);
  if (ratio < 4.5) throw new Error(`${label} contrast is ${ratio.toFixed(2)}:1; expected at least 4.5:1.`);
}

const auditCss = read("app/styles/sitewide-audit.css");
const narrowNavContract = "@media(max-width:560px){\n  /* Do not regress below the readability floor on the narrowest phones. */\n  .bottom-nav>a,.bottom-nav-more summary{font-size:10px!important}\n}";
if (!auditCss.includes(narrowNavContract)) {
  throw new Error("Narrow-phone bottom navigation must preserve the 10px readability floor.");
}


requireText("app/not-found.tsx", [
  'className="system-state-page"',
  'className="system-state-visual"',
  "Return home",
]);
requireText("app/loading.tsx", [
  'className="system-state-page"',
  'className="system-state-progress"',
  "Loading your account.",
]);
requireText("app/error.tsx", [
  'className="system-state-page"',
  'className="system-state-visual is-error"',
  "Try again",
]);
requireText("app/admin/loading.tsx", [
  'className="system-state-page system-state-admin"',
  "Loading operator truth.",
]);
requireText("app/admin/error.tsx", [
  'className="system-state-page system-state-admin"',
  "Retry safely",
]);

requireText("components/claim-reveal-hero.tsx", [
  'className="pc-v8-vault-orbit"',
  'className="pc-v8-orbit-ring"',
  'className="pc-v8-orbit-core"',
  'pc-v8-reveal is-',
  'You revealed.',
  'Variable draw settled',
  'This claim',
  'balance now',
  'current rank',
]);

requireText("app/dashboard/claimed/page.tsx", [
  "<ClaimRevealHero",
  "rewardTone={rewardTone}",
  "probabilityLabel={probabilityLabel}",
]);

requireText("app/visual-smoke-fixture/claim-reveal/page.tsx", [
  'requestHeaders.get("host")',
  'requestHeaders.get("x-forwarded-host")',
  "const effectiveHost = forwardedHost || host",
  'effectiveHost.startsWith("127.0.0.1:")',
  'effectiveHost.startsWith("localhost:")',
  "notFound()",
  'rewardTone={tone}',
  "standard:",
  "boosted:",
  "top:",
]);

requireText("app/earn/page.tsx", [
  '<div className="balance-chip"><small>Balance</small><strong>{state.preview ? "—" : formatUsdFromCredits(state.availableCredits)}</strong></div>',
]);

requireText("components/turnstile-field.tsx", [
  'type TurnstileTheme = "dark" | "light" | "auto";',
  'theme = "dark"',
  "const TURNSTILE_COMPACT_MAX_WIDTH = 260;",
  'const size = availableWidth > 0 && availableWidth < TURNSTILE_COMPACT_MAX_WIDTH ? "compact" : "flexible";',
  "container.dataset.turnstileSize = size;",
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
  'aria-current={active === "ads" ? "page" : undefined}',
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
