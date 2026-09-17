import { readFileSync } from "node:fs";

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

function rejectText(path, fragments) {
  const value = read(path);
  for (const fragment of fragments) {
    if (value.includes(fragment)) {
      throw new Error(`${path} contains forbidden legacy visual copy: ${fragment}`);
    }
  }
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
  "@media(max-width:420px)",
]);

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

for (const path of [
  "app/business/page.tsx",
  "app/business/integration/page.tsx",
  "app/r/[handle]/page.tsx",
]) {
  rejectText(path, ["Reward Pulse"]);
  requireText(path, ["Pulsercuit"]);
}

console.log("Visual hardening contract PASS");
