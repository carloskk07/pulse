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

const layout = read("app/layout.tsx");
const importName = './styles/pulsercuit-v10-visual-hardening.css';
if (!layout.includes(importName)) {
  throw new Error("Root layout must load the V10 visual hardening authority.");
}
if (layout.lastIndexOf(importName) < layout.lastIndexOf("pulsercuit-v7-audit.css")) {
  throw new Error("V10 visual hardening must remain after legacy visual layers.");
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

console.log("Visual hardening contract PASS");
