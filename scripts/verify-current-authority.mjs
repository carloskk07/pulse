import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(path, fragments) {
  const value = read(path);
  for (const fragment of fragments) {
    if (!value.includes(fragment)) {
      throw new Error(`${path} is missing required current-authority contract: ${fragment}`);
    }
  }
}

const manifestPath = "app/styles/current.css";
const manifest = read(manifestPath);
const imports = [
  '@import "./current/tokens.css";',
  '@import "./current/dashboard-components.css";',
  '@import "./current/share-preview.css";',
  '@import "./current/momentum-actions.css";',
  '@import "./current/compatibility-hardening.css";',
  '@import "./current/responsive-contracts.css";',
];

let previous = -1;
for (const item of imports) {
  const index = manifest.indexOf(item);
  if (index <= previous) {
    throw new Error(`Current semantic bridge import order drifted at ${item}.`);
  }
  previous = index;
}

if (manifest.includes("{")) {
  throw new Error("current.css must remain import-only; declarations belong to semantic current/* authorities.");
}

const imported = [...manifest.matchAll(/@import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
if (imported.length !== imports.length) {
  throw new Error(`Current semantic bridge must contain exactly ${imports.length} stylesheet imports.`);
}

requireText("app/styles/current/tokens.css", [
  "current presentation bridge",
  "--pc-lime:#cfff67",
  "--pc-cyan:#72f3ff",
  "--pc-violet:#a690ff",
  "--pc-warm:#ffd87d",
]);
requireText("app/styles/current/dashboard-components.css", [
  ".pc-dashboard-ribbon{",
  ".pc-momentum-card{",
  ".pc-momentum-top{",
  ".pc-milestone-track{",
]);
requireText("app/styles/current/share-preview.css", [
  ".pc-share-preview{",
  ".pc-share-card{",
  ".pc-share-card h3 em{",
]);
requireText("app/styles/current/momentum-actions.css", [
  ".pc-v5-primary{",
  ".pc-v5-primary:hover{",
]);
requireText("app/styles/current/compatibility-hardening.css", [
  ".pc-v6-ranks article:nth-child(3):before{display:none!important}",
  ".pc-share-studio,.pc-share-studio-placeholder{scroll-margin-top:84px}",
  ".app-frame:after{-webkit-mask-image:",
  ".pc-luxe-pulse-stage:before{-webkit-mask-image:",
  "@media(hover:none),(pointer:coarse)",
]);
requireText("app/styles/current/responsive-contracts.css", [
  "@media(max-width:1050px)",
  "@media(max-width:760px)",
  "@media(max-width:520px)",
  "@media(prefers-reduced-motion:reduce)",
  ".pc-sensory-reveal-ready",
]);

for (const path of [
  "app/styles/current/tokens.css",
  "app/styles/current/dashboard-components.css",
  "app/styles/current/share-preview.css",
  "app/styles/current/momentum-actions.css",
  "app/styles/current/compatibility-hardening.css",
  "app/styles/current/responsive-contracts.css",
]) {
  if (/@import\s+["']/.test(read(path))) {
    throw new Error(`${path} must not create another nested cascade.`);
  }
}

console.log("Current semantic bridge PASS");
