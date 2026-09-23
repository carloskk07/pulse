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
  "readUrlEncodedFormWithLimit",
  'contentType !== "application/x-www-form-urlencoded"',
  "new URLSearchParams(body)",
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
  "app/api/cashback/start/route.ts",
  "app/api/return-reminder/route.ts",
];

for (const routePath of sameOriginRoutes) {
  const routeSource = readFileSync(routePath, "utf8");
  if (!routeSource.includes("isTrustedSameOriginMutation(request)")) {
    throw new Error(`${routePath} is missing same-origin mutation provenance enforcement.`);
  }
}

const boundedFormRoutes = [
  "app/api/business/leads/route.ts",
  "app/api/ads/interest/route.ts",
  "app/api/ads/campaigns/route.ts",
  "app/api/ads/click/route.ts",
  "app/api/pulse/claim/route.ts",
  "app/api/withdrawals/route.ts",
  "app/api/direct/start/route.ts",
  "app/api/cashback/start/route.ts",
];

for (const routePath of boundedFormRoutes) {
  const routeSource = readFileSync(routePath, "utf8");
  if (!routeSource.includes("readUrlEncodedFormWithLimit(request,")) {
    throw new Error(`${routePath} is missing bounded URL-encoded form parsing.`);
  }
  if (routeSource.includes("request.formData()")) {
    throw new Error(`${routePath} restored unbounded formData parsing.`);
  }
}

for (const componentPath of [
  "components/sponsored-visit-button.tsx",
  "components/direct-start-button.tsx",
]) {
  const componentSource = readFileSync(componentPath, "utf8");
  if (!componentSource.includes("new URLSearchParams()") || componentSource.includes("new FormData()")) {
    throw new Error(`${componentPath} must keep the bounded URL-encoded request contract.`);
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
