import { readFileSync } from "node:fs";

const path = "lib/request-security.ts";
const source = readFileSync(path, "utf8");

const required = [
  'request.headers.get("origin")',
  'request.headers.get("sec-fetch-site")',
  "if (!fetchSite) return false;",
  'fetchSite === "same-origin"',
  'fetchSite === "none"',
  "readRequestBytesWithLimit",
  'request.headers.get("content-length")',
  "totalBytes > maxBytes",
  "reader.read()",
  'new TextDecoder("utf-8", { fatal: true })',
];

const sameOriginRoutes = [
  "app/api/business/leads/route.ts",
  "app/api/ads/interest/route.ts",
  "app/api/ads/campaigns/route.ts",
  "app/api/ads/click/route.ts",
  "app/api/marketing/event/route.ts",
  "app/api/pulse/claim/route.ts",
  "app/api/withdrawals/route.ts",
  "app/api/direct/start/route.ts",
  "app/api/return-reminder/route.ts",
];

for (const routePath of sameOriginRoutes) {
  const routeSource = readFileSync(routePath, "utf8");
  if (!routeSource.includes("isTrustedSameOriginMutation(request)")) {
    throw new Error(`${routePath} is missing same-origin mutation provenance enforcement.`);
  }
}

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
