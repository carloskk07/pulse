import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { isIP } from "node:net";
import ts from "typescript";

const root = process.cwd();

function fail(message) {
  throw new Error("External destination contract failed: " + message);
}

function loadAuthority() {
  const filename = path.join(root, "lib/public-external-url.ts");
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier === "server-only") return {};
      if (specifier === "node:net") return { isIP };
      fail("unexpected runtime dependency " + specifier);
    },
    URL,
    Set,
    Number,
    String,
    Math,
    JSON,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: "public-external-url.js" });
  return module.exports;
}

const authority = loadAuthority();
const clean = authority.cleanPublicExternalUrl;
const parse = authority.parsePublicExternalUrl;
if (typeof clean !== "function" || typeof parse !== "function") {
  fail("authority exports are missing");
}

const valid = [
  "https://example.com/",
  "https://sub.example.co.uk/path?x=1",
  "https://8.8.8.8/path",
  "https://1.1.1.1/",
];

for (const value of valid) {
  if (!clean(value)) fail("expected public HTTPS URL: " + value);
}

if (!clean("http://example.com/", { allowHttp: true })) {
  fail("explicit HTTP lead URL should be accepted");
}

const invalid = [
  "http://example.com/",
  "https://user:pass@example.com/",
  "https://localhost/",
  "https://foo.local/",
  "https://service.internal/",
  "https://router.lan/",
  "https://intranet/",
  "https://10.0.0.1/",
  "https://100.64.0.1/",
  "https://127.0.0.1/",
  "https://169.254.1.1/",
  "https://172.16.0.1/",
  "https://192.168.1.1/",
  "https://192.0.2.1/",
  "https://198.51.100.1/",
  "https://203.0.113.1/",
  "https://224.0.0.1/",
  "https://[::1]/",
  "https://[fc00::1]/",
  "https://[fe80::1]/",
  "https://[2001:db8::1]/",
  "https://example.com:8443/",
];

for (const value of invalid) {
  if (clean(value)) fail("unsafe destination accepted: " + value);
}

const integrations = new Map([
  ["app/api/ads/campaigns/route.ts", "cleanPublicExternalUrl"],
  ["app/api/ads/click/route.ts", "cleanPublicExternalUrl"],
  ["app/api/cashback/start/route.ts", "parsePublicExternalUrl"],
  ["app/api/direct/start/route.ts", "parsePublicExternalUrl"],
  ["app/admin/direct/actions.ts", "cleanPublicExternalUrl"],
  ["app/api/ads/interest/route.ts", "cleanPublicExternalUrl"],
  ["app/api/business/leads/route.ts", "cleanPublicExternalUrl"],
]);

for (const [relative, symbol] of integrations) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  if (!source.includes("@/lib/public-external-url")) {
    fail(relative + " does not import public URL authority");
  }
  if (!source.includes(symbol + "(")) {
    fail(relative + " does not execute " + symbol);
  }
}

const clickSource = fs.readFileSync(path.join(root, "app/api/ads/click/route.ts"), "utf8");
if (!clickSource.includes("const safeDestination = cleanPublicExternalUrl(destination)")) {
  fail("stored ad destinations are not revalidated at click time");
}

const directSource = fs.readFileSync(path.join(root, "app/api/direct/start/route.ts"), "utf8");
if (!directSource.includes("const target = parsePublicExternalUrl(destination)")) {
  fail("stored Direct destinations are not revalidated before exposure");
}

console.log("External destination contract PASS");
