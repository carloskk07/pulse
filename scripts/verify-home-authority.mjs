import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const manifest = read("app/globals.css");
const homePath = "app/styles/home.css";
const home = read(homePath);
const homeImport = '@import "./styles/home.css";';
const themeImport = '@import "./styles/theme.css";';

if (!manifest.includes(homeImport)) {
  throw new Error("globals.css must load the single canonical Home authority.");
}
if (manifest.indexOf(homeImport) > manifest.indexOf(themeImport)) {
  throw new Error("Home authority must load before the shared current theme.");
}

const retired = [
  "pulsercuit-v6.css",
  "pulsercuit-v6-fixes.css",
  "pulsercuit-v6-reference.css",
  "pulsercuit-v6-ultra.css",
  "pulsercuit-v6-material.css",
  "pulsercuit-v6-sensory.css",
];
for (const filename of retired) {
  const path = `app/styles/${filename}`;
  if (existsSync(path)) throw new Error(`Retired Home generation returned: ${path}`);
  if (manifest.includes(filename)) throw new Error(`globals.css still imports retired Home generation: ${filename}`);
}

const fragments = [
  ["./home/foundation.css", "app/styles/home/foundation.css", "Pulsercuit V6 — reference-matched cinematic system", ".pc-v6-hero{"],
  ["./home/usability.css", "app/styles/home/usability.css", "Pulsercuit V6.1 — visual truth + usability hardening", ".pc-v6-chamber-stage"],
  ["./home/reference.css", "app/styles/home/reference.css", "Pulsercuit V6.2 — reference-parity visual layer", ".pc-v6-sprite-vault"],
  ["./home/cinematic.css", "app/styles/home/cinematic.css", "Pulsercuit V6.3 — ultra-cinematic brand layer", ".pc-v6-chamber-body:after"],
  ["./home/material.css", "app/styles/home/material.css", "Pulsercuit V6.4 — physical material depth", ".pc-v6-vault-art:after"],
  ["./home/sensory.css", "app/styles/home/sensory.css", "Pulsercuit V6.5 — adaptive sensory motion", ".pc-sensory-progress"],
];

const expectedImports = fragments.map(([relative]) => `@import "${relative}";`);
const actualImports = [...home.matchAll(/@import\s+["']([^"']+)["'];/g)].map((match) => `@import "${match[1]}";`);
if (JSON.stringify(actualImports) !== JSON.stringify(expectedImports)) {
  throw new Error(`Home fragment order drifted. Expected ${expectedImports.join(" -> ")}`);
}

for (const [relative, path, marker, selector] of fragments) {
  if (!existsSync(path)) throw new Error(`Missing canonical Home fragment: ${relative}`);
  const css = read(path);
  if (!css.includes(marker) || !css.includes(selector)) {
    throw new Error(`Home fragment lost source identity or required selector: ${path}`);
  }
}


function splitSelectorList(header) {
  const selectors = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote = null;

  for (let index = 0; index < header.length; index += 1) {
    const char = header[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") parentheses += 1;
    else if (char === ")") parentheses = Math.max(0, parentheses - 1);
    else if (char === "[") brackets += 1;
    else if (char === "]") brackets = Math.max(0, brackets - 1);
    else if (char === "," && parentheses === 0 && brackets === 0) {
      selectors.push(header.slice(start, index).trim());
      start = index + 1;
    }
  }

  selectors.push(header.slice(start).trim());
  return selectors.filter(Boolean);
}

function topLevelSelectors(css) {
  const selectors = new Set();
  let index = 0;

  function skipWhitespaceAndComments() {
    while (index < css.length) {
      if (/\s/.test(css[index])) {
        index += 1;
        continue;
      }
      if (css.startsWith("/*", index)) {
        const end = css.indexOf("*/", index + 2);
        index = end === -1 ? css.length : end + 2;
        continue;
      }
      break;
    }
  }

  while (index < css.length) {
    skipWhitespaceAndComments();
    if (index >= css.length) break;

    const headerStart = index;
    let quote = null;
    let parentheses = 0;
    let brackets = 0;
    while (index < css.length) {
      const char = css[index];
      if (quote) {
        if (char === "\\") index += 2;
        else {
          if (char === quote) quote = null;
          index += 1;
        }
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        index += 1;
        continue;
      }
      if (css.startsWith("/*", index)) {
        const end = css.indexOf("*/", index + 2);
        index = end === -1 ? css.length : end + 2;
        continue;
      }
      if (char === "(") parentheses += 1;
      else if (char === ")") parentheses = Math.max(0, parentheses - 1);
      else if (char === "[") brackets += 1;
      else if (char === "]") brackets = Math.max(0, brackets - 1);
      else if (parentheses === 0 && brackets === 0 && (char === "{" || char === ";")) break;
      index += 1;
    }

    if (index >= css.length) break;
    if (css[index] === ";") {
      index += 1;
      continue;
    }

    const header = css.slice(headerStart, index).trim();
    const open = index;
    let depth = 1;
    quote = null;
    index += 1;
    while (index < css.length && depth > 0) {
      const char = css[index];
      if (quote) {
        if (char === "\\") index += 2;
        else {
          if (char === quote) quote = null;
          index += 1;
        }
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        index += 1;
        continue;
      }
      if (css.startsWith("/*", index)) {
        const end = css.indexOf("*/", index + 2);
        index = end === -1 ? css.length : end + 2;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      index += 1;
    }

    if (!header.startsWith("@") && open >= 0) {
      for (const selector of splitSelectorList(header)) selectors.add(selector);
    }
  }

  return selectors;
}

function forbidTopLevelSelectors(path, forbidden) {
  const selectors = topLevelSelectors(read(path));
  for (const selector of forbidden) {
    if (selectors.has(selector)) {
      throw new Error(`Provably shadowed global selector returned to Home authority: ${path} -> ${selector}`);
    }
  }
}

forbidTopLevelSelectors("app/styles/home/foundation.css", [
  "html", "body", ".app-frame", ".app-sidebar", ".app-nav a", ".app-nav a.active",
  ".app-page-head h1", ".avatar", ".app-eyebrow",
  ".wallet-balance-card", ".pc-progress-hero", ".drop-card", ".withdrawal-panel",
  ".transaction-card", ".trust-card", ".pc-share-studio", ".pc-next-circuit",
  ".pc-missions-card", ".pc-signal-card", ".pc-momentum-card", ".invite-card",
  ".progress-card", ".button-light", ".pc-v5-primary", ".hourly-pulse-card", ".pc-identity-card",
]);
forbidTopLevelSelectors("app/styles/home/cinematic.css", [
  ".app-frame", ".wallet-balance-card", ".pc-progress-hero", ".drop-card", ".withdrawal-panel",
  ".transaction-card", ".trust-card", ".pc-share-studio", ".pc-next-circuit",
  ".pc-missions-card", ".pc-signal-card", ".pc-momentum-card", ".invite-card",
  ".progress-card", ".hourly-pulse-card",
]);
forbidTopLevelSelectors("app/styles/home/material.css", [
  ".app-sidebar", ".wallet-balance-card", ".pc-progress-hero", ".drop-card", ".withdrawal-panel",
  ".transaction-card", ".trust-card", ".pc-share-studio", ".pc-next-circuit",
  ".pc-missions-card", ".pc-signal-card", ".pc-momentum-card", ".invite-card",
  ".progress-card", ".hourly-pulse-card",
]);

const theme = read("app/styles/theme.css");
for (const marker of [
  "color:var(--pc6-ivory);",
  ".app-nav a{position:relative;border:1px solid transparent;border-radius:8px!important;color:#8f9791!important;",
  '.app-page-head h1{font-family:Georgia,"Times New Roman",serif!important;font-weight:500!important}',
]) {
  if (!theme.includes(marker)) {
    throw new Error(`Current theme lost migrated application ownership: ${marker}`);
  }
}

if (!home.includes("one authority controls the fragment order") && !home.includes("single") && !home.includes("Canonical Home visual authority")) {
  throw new Error("home.css must document its canonical ordering responsibility.");
}


const homePage = read("app/page.tsx");
for (const fragment of [
  'import { getPublicSocialProof } from "@/lib/social-proof";',
  "export default async function HomePage()",
  "const initialProof = await getPublicSocialProof();",
  "<V6HeroProof initialProof={initialProof} />",
  "<V6FinalProof initialProof={initialProof} />",
]) {
  if (!homePage.includes(fragment)) {
    throw new Error(`Home lost verified social-proof HTML bootstrap: ${fragment}`);
  }
}
if (homePage.includes('export const dynamic = "force-dynamic"')) {
  throw new Error("Home social-proof bootstrap must not force dynamic rendering.");
}

const liveProof = read("components/v6-live-proof.tsx");
for (const fragment of [
  "initialProof: PublicSocialProof",
  "useState<PublicSocialProof>(cachedProof ?? initialProof ?? EMPTY_PROOF)",
  "void refreshPublicProof().then",
  'data-proof-source="server-bootstrap"',
  'data-proof-available={proof.available ? "true" : "false"}',
  "data-proof-member-count",
  "data-proof-reward-event-count",
  "data-proof-paid-withdrawal-count",
]) {
  if (!liveProof.includes(fragment)) {
    throw new Error(`Live proof lost server bootstrap/background refresh contract: ${fragment}`);
  }
}
if (liveProof.includes("if (cachedProof) return Promise.resolve(cachedProof);")) {
  throw new Error("Live proof must refresh authoritative runtime data even when bootstrapped.");
}

console.log("Canonical Home cascade PASS");
