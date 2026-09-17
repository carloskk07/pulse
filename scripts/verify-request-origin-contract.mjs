import { readFileSync } from "node:fs";

const path = "lib/request-security.ts";
const source = readFileSync(path, "utf8");

const required = [
  'request.headers.get("origin")',
  'request.headers.get("sec-fetch-site")',
  "if (!fetchSite) return false;",
  'fetchSite === "same-origin"',
  'fetchSite === "none"',
];

for (const fragment of required) {
  if (!source.includes(fragment)) {
    throw new Error(`${path} is missing fail-closed mutation provenance contract: ${fragment}`);
  }
}

const forbidden = [
  'if (fetchSite && fetchSite !== "same-origin"',
  "return true;\n}",
];

for (const fragment of forbidden) {
  if (source.includes(fragment)) {
    throw new Error(`${path} contains fail-open mutation provenance behavior: ${fragment}`);
  }
}

console.log("Request mutation provenance contract PASS");
