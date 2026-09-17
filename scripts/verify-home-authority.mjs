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

if (!home.includes("one authority controls the fragment order") && !home.includes("single") && !home.includes("Canonical Home visual authority")) {
  throw new Error("home.css must document its canonical ordering responsibility.");
}

console.log("Canonical Home cascade PASS");
