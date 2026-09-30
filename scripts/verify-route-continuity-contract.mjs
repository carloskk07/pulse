import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(`${path} is missing route-continuity contract: ${fragment}`);
    }
  }
}

const nextConfig = read("next.config.ts");
if (nextConfig.includes("viewTransition:")) {
  throw new Error("Next 16.3 route continuity must not restore the removed experimental.viewTransition flag.");
}

requireText("components/spatial-atmosphere.tsx", [
  'import { ViewTransition } from "react";',
  'import { getRouteSemanticDimension } from "@/lib/route-semantics";',
  "const routeDimension = getRouteSemanticDimension(active);",
  'data-route-dimension={routeDimension}',
  'key={`carrier-${active}`}',
  'key={`orbit-${active}`}',
  'key={`index-${active}`}',
  'name="pc-route-carrier"',
  'name="pc-route-orbit"',
  'name="pc-route-index"',
  'default="none"',
  'update={{ default: "pc-route-carrier-share", "pc-forward": "pc-route-carrier-forward", "pc-back": "pc-route-carrier-back" }}',
  'update={{ default: "pc-route-orbit-share", "pc-forward": "pc-route-orbit-forward", "pc-back": "pc-route-orbit-back" }}',
  'update={{ default: "pc-route-index-share", "pc-forward": "pc-route-index-forward", "pc-back": "pc-route-index-back" }}',
  '"pc-forward": "pc-route-carrier-forward"',
  '"pc-back": "pc-route-carrier-back"',
  '"pc-forward": "pc-route-orbit-forward"',
  '"pc-back": "pc-route-orbit-back"',
  '"pc-forward": "pc-route-index-forward"',
  '"pc-back": "pc-route-index-back"',
  'className="pc-route-carrier"',
]);

requireText("lib/route-semantics.ts", [
  'export type RouteSemanticDimension = "value" | "signal" | "network";',
  'export type ProductRouteId = "home" | "progress" | "earn" | "wallet" | "invite";',
  'const PRODUCT_ROUTE_ORDER: ProductRouteId[] = ["home", "progress", "earn", "wallet", "invite"];',
  'home: "/dashboard"',
  'progress: "/progress"',
  'earn: "/earn"',
  'wallet: "/wallet"',
  'invite: "/invite"',
  'home: "value"',
  'earn: "value"',
  'wallet: "value"',
  'progress: "signal"',
  'invite: "network"',
  "export type ProductRouteHref",
  "export function getProductRouteHref",
  "export function getRouteSemanticDimension",
  "export function getRouteSemanticTransfer",
  "export function getProductRouteIdFromHref",
  "export function getRouteTransitionTypes",
  "export function getRouteTransitionTypesForHref",
  "export function getRouteLinkProps",
  'return `pc-transfer-${current}-${target}`;',
]);

requireText("components/app-shell.tsx", [
  'import { ViewTransition } from "react";',
  'import { getProductRouteHref, getRouteLinkProps, getRouteNavigationHref, getRouteSemanticDimension } from "@/lib/route-semantics";',
  'href: getProductRouteHref("home")',
  "getRouteLinkProps(active, href)",
  'getRouteNavigationHref("admin", href)',
  "const routeSemanticDimension = getRouteSemanticDimension(active);",
  'data-route-dimension={routeSemanticDimension ?? undefined}',
  'name="pc-route-topbar"',
  'name="pc-route-bottom-nav"',
  'share="pc-route-nav-anchor"',
]);

requireText("components/value-flow.tsx", [
  'import { getRouteTransitionTypes } from "@/lib/route-semantics";',
  'const sourceRoute = stage === "earn" ? "earn" : "wallet";',
  'getRouteTransitionTypes(sourceRoute, "earn")',
  'getRouteTransitionTypes(sourceRoute, "wallet")',
  "transitionTypes={earnTransitionTypes}",
  "transitionTypes={walletTransitionTypes}",
]);

for (const [contextPath, fragments] of [
  ["app/dashboard/page.tsx", [
    'getRouteTransitionTypesForHref("home", "/progress")',
    'getRouteTransitionTypesForHref("home", "/wallet")',
    'getRouteTransitionTypesForHref("home", "/invite")',
    'getRouteTransitionTypesForHref("home", "/earn")',
  ]],
  ["app/dashboard/claimed/page.tsx", [
    'getRouteTransitionTypesForHref("home", "/earn")',
    'getRouteTransitionTypesForHref("home", "/progress#circuit-moments")',
  ]],
  ["app/earn/page.tsx", ['getRouteTransitionTypesForHref("earn", "/dashboard")']],
  ["app/progress/page.tsx", [
    'getRouteLinkProps("progress", shareEntryHref)',
    'getRouteTransitionTypesForHref("progress", state.signedIn ? "/dashboard"',
  ]],
  ["components/continuous-pulse-panel.tsx", [
    'getRouteTransitionTypesForHref("home", "/earn")',
    'getRouteTransitionTypesForHref("home", "/invite")',
  ]],
  ["components/continuous-earn-hub.tsx", [
    'getRouteLinkProps("earn", mission.href)',
    'getRouteTransitionTypesForHref("earn", "/invite")',
  ]],
  ["components/next-circuit-panel.tsx", ['getRouteTransitionTypesForHref("progress", "/dashboard")']],
  ["components/claim-reveal-hero.tsx", [
    'getRouteTransitionTypesForHref("home", "/dashboard")',
    'getRouteTransitionTypesForHref("home", "/wallet")',
  ]],
]) {
  requireText(contextPath, fragments);
}

requireText("app/styles/app-art-direction.css", [
  "/* V10 — native route continuity.",
  ".pc-route-carrier{",
  '.pc-spatial-atmosphere[data-scene="home"] .pc-route-carrier',
  '.pc-spatial-atmosphere[data-scene="progress"] .pc-route-carrier',
  '.pc-spatial-atmosphere[data-scene="earn"] .pc-route-carrier',
  '.pc-spatial-atmosphere[data-scene="wallet"] .pc-route-carrier',
  '.pc-spatial-atmosphere[data-scene="invite"] .pc-route-carrier',
  "--pc-route-vt-motion:1",
  "::view-transition-group(.pc-route-carrier-forward)",
  "::view-transition-group(.pc-route-carrier-back)",
  "::view-transition-group(.pc-route-orbit-forward)",
  "::view-transition-group(.pc-route-index-forward)",
  "::view-transition-old(.pc-route-carrier-forward)",
  "::view-transition-new(.pc-route-carrier-forward)",
  "::view-transition-old(.pc-route-carrier-back)",
  "::view-transition-new(.pc-route-carrier-back)",
  "@media(prefers-reduced-motion:reduce)",
  "--pc-route-vt-motion:0",
  "--pc-route-vt-carrier-duration:.001ms",
  "/* V10.4 — replaced route-content boundary.",
  "::view-transition-old(.pc-route-content-forward)",
  "::view-transition-new(.pc-route-content-forward)",
  "::view-transition-old(.pc-route-content-back)",
  "::view-transition-new(.pc-route-content-back)",
  "@keyframes pcRouteContentSlide",
  "@keyframes pcRouteContentFade",
  "::view-transition{",
  "pointer-events:none",
  "/* V10.8 page-root navigation anchor */",
  "::view-transition-group(.pc-route-nav-anchor)",
  "/* V11.14 — Semantic Layer Handoff.",
  "/* V11.15 — Route Semantic Authority.",
  '.pc-spatial-atmosphere[data-route-dimension="value"] .pc-field-value-layer',
  '.pc-spatial-atmosphere[data-route-dimension="signal"] .pc-field-signal-layer',
  '.pc-spatial-atmosphere[data-route-dimension="network"] .pc-field-network-layer',
  "--pc-route-layer-rest:.46",

  "view-transition-name:pc-field-value",
  "view-transition-name:pc-field-signal",
  "view-transition-name:pc-field-network",
  "--pc-route-transfer-duration:.56s",
  "::view-transition-group(pc-field-value)",
  "::view-transition-group(pc-field-signal)",
  "::view-transition-group(pc-field-network)",
  "active-view-transition-type(pc-transfer-value-signal)::view-transition-old(pc-field-value)",
  "active-view-transition-type(pc-transfer-value-signal)::view-transition-group(pc-field-signal)",
  "active-view-transition-type(pc-transfer-signal-value)::view-transition-old(pc-field-signal)",
  "active-view-transition-type(pc-transfer-signal-value)::view-transition-group(pc-field-value)",
  "active-view-transition-type(pc-transfer-value-network)::view-transition-old(pc-field-value)",
  "active-view-transition-type(pc-transfer-value-network)::view-transition-group(pc-field-network)",
  "active-view-transition-type(pc-transfer-network-value)::view-transition-old(pc-field-network)",
  "active-view-transition-type(pc-transfer-network-value)::view-transition-group(pc-field-value)",
  "active-view-transition-type(pc-transfer-signal-network)::view-transition-old(pc-field-signal)",
  "active-view-transition-type(pc-transfer-signal-network)::view-transition-group(pc-field-network)",
  "active-view-transition-type(pc-transfer-network-signal)::view-transition-old(pc-field-network)",
  "active-view-transition-type(pc-transfer-network-signal)::view-transition-group(pc-field-signal)",
  "pc-transfer-value-signal",
  "pc-transfer-signal-value",
  "pc-transfer-value-network",
  "pc-transfer-network-value",
  "pc-transfer-signal-network",
  "pc-transfer-network-signal",
  "@keyframes pcTransferValueSignalOut",
  "@keyframes pcTransferSignalValueOut",
  "@keyframes pcTransferValueNetworkOut",
  "@keyframes pcTransferNetworkValueOut",
  "@keyframes pcTransferSignalNetworkOut",
  "@keyframes pcTransferNetworkSignalOut",
  "@keyframes pcTransferValueSignalIn",
  "@keyframes pcTransferSignalValueIn",
  "@keyframes pcTransferValueNetworkIn",
  "@keyframes pcTransferNetworkValueIn",
  "@keyframes pcTransferSignalNetworkIn",
  "@keyframes pcTransferNetworkSignalIn",
  "--pc-route-transfer-duration:.34s",
  "--pc-route-transfer-duration:.28s",
  "filter:none!important",
  "::view-transition-old(.pc-route-nav-anchor)",
  "::view-transition-new(.pc-route-nav-anchor)",
]);

requireText("components/route-page-transition.tsx", [
  'import { ViewTransition } from "react";',
  'key={`route-page-${route}`}',
  '"pc-forward": "pc-route-content-forward"',
  '"pc-back": "pc-route-content-back"',
  "enter={routePageTransition}",
  "exit={routePageTransition}",
  'default="none"',
]);

for (const [path, route] of [
  ["app/dashboard/page.tsx", "home"],
  ["app/progress/page.tsx", "progress"],
  ["app/earn/page.tsx", "earn"],
  ["app/wallet/page.tsx", "wallet"],
  ["app/invite/page.tsx", "invite"],
]) {
  requireText(path, [
    'import { RoutePageTransition } from "@/components/route-page-transition";',
    `<RoutePageTransition route="${route}">`,
    "</RoutePageTransition>",
  ]);
}

requireText("components/view-transition-runtime-fixture.tsx", [
  '"use client";',
  'startTransition',
  'ViewTransition',
  'update="auto"',
  'id="vt-runtime-trigger"',
  'id="vt-runtime-state"',
]);

requireText("app/visual-smoke-fixture/view-transition/page.tsx", [
  'localVisualHost',
  'if (!localVisualHost) notFound();',
  '<ViewTransitionRuntimeFixture />',
]);

requireText("scripts/verify-route-continuity-runtime.mjs", [
  "/visual-smoke-fixture/view-transition",
  "verifyMinimalReactViewTransition",
  'CSS.supports("view-transition-class", "pc-probe")',
  "Minimal React ViewTransition runtime PASS",
  "/dashboard",
  "/earn",
  "/wallet",
  "/progress",
  "Page.addScriptToEvaluateOnNewDocument",
  "waitForHydratedLink",
  "__reactProps$",
  "__reactFiber$",
  "documentId: performance.timeOrigin",
  "full document navigation instead of App Router navigation",
  "Document.prototype.startViewTransition",
  "window.__pcRouteTransitionTypes",
  "window.__pcRouteTransitionAnimations",
  "window.__pcRouteTransitionHistory",
  "entry.samples",
  "requestAnimationFrame(sampleFrame)",
  "transition?.updateCallbackDone",
  "carrierDuration",
  "orbitDuration",
  "indexDuration",
  'transferDuration: rootStyle.getPropertyValue("--pc-route-transfer-duration").trim()',
  "assertReducedMotionState",
  'state?.motion !== "0"',
  "transition?.types",
  "entry.animationNames",
  "entry.animationEvidence",
  "secondaryAnimation",
  "secondaryPseudo",
  ":active-view-transition-type(",
  "waitForTransitionTypes",
  "contextualRoute",
  "clickSelector",
  "semanticProof",
  "assertSemanticLayerIsolation",
  '"::view-transition-old(pc-field-signal)"',
  '"::view-transition-group(pc-field-value)"',
  '"::view-transition-old(pc-field-network)"',
  '"::view-transition-group(pc-field-signal)"',
  '"pcTransferSignalValueIn"',
  '"pcTransferNetworkSignalIn"',
  "probeInstalled",
  'waitForTransitionTypes(send, ["pc-forward"], earnCallsBefore, "Rewards → Earn")',
  'assertNoSemanticTransfer(earn, earnCallsBefore, "Rewards → Earn")',
  'assertReducedMotionState(reducedProgress, "Earn → Progress")',
  'crossRoute("/wallet", "pc-forward", "pc-transfer-signal-value"',
  'crossRoute("/invite", "pc-forward", "pc-transfer-value-network"',
  'crossRoute("/wallet", "pc-back", "pc-transfer-network-value"',
  'crossRoute("/progress", "pc-back", "pc-transfer-value-signal"',
  'crossRoute("/invite", "pc-forward", "pc-transfer-signal-network"',
  'crossRoute("/progress", "pc-back", "pc-transfer-network-signal"',
  '"prefers-reduced-motion", value: "no-preference"',
  '"prefers-reduced-motion", value: "reduce"',
  "width: 390",
  "height: 844",
  "mobile: true",
  'transferDuration !== ".28s"',
  '"Mobile Progress → Referrals"',
  '"Mobile Referrals → Progress"',
  '"Mobile semantic layers"',
  '"Mobile Progress → Balance"',
  '"Rewards card → Progress"',
  '"Rewards card → Referrals"',
  '"Rewards CTA → Earn"',
  '"Earn CTA → Referrals"',
  "Native route continuity PASS",
]);


const routeAuthority = read("lib/route-semantics.ts");
for (const forbidden of ["availableCredits", "payoutCredits", "claimReady", "rewardCredits", "ledger"]) {
  if (routeAuthority.includes(forbidden)) {
    throw new Error(`Route transition authority must not depend on financial state: ${forbidden}`);
  }
}

const atmosphereSource = read("components/spatial-atmosphere.tsx");
for (const layerClass of [
  "pc-space-semantic-layer pc-field-value-layer",
  "pc-space-semantic-layer pc-field-signal-layer",
  "pc-space-semantic-layer pc-field-network-layer",
  "pc-space-base-layer",
]) {
  if (!atmosphereSource.includes(layerClass)) {
    throw new Error(`Semantic layer structure is missing: ${layerClass}`);
  }
}
if (atmosphereSource.includes("pc-route-field") || atmosphereSource.includes("pc-route-field-transfer")) {
  throw new Error("Semantic layer handoff must not restore an inactive parent React ViewTransition boundary.");
}

const appShell = read("components/app-shell.tsx");
for (const forbidden of ["const routeDimension = new Map", "const routeOrder = new Map", "function routeTransitionTypes"]) {
  if (appShell.includes(forbidden)) {
    throw new Error(`Route transition authority must remain centralized in lib/route-semantics.ts: ${forbidden}`);
  }
}
if (appShell.includes("routeContentTransition") || appShell.includes('key={`route-content-${active}`}')) {
  throw new Error("Route ViewTransition must live before AppShell DOM, not inside the persistent shell.");
}

const css = read("app/styles/app-art-direction.css");
const semanticBlock = css.indexOf("/* V11.14 — Semantic Layer Handoff.");
const mobileDuration820 = css.indexOf("--pc-route-transfer-duration:.34s", semanticBlock);
const mobileDuration560 = css.indexOf("--pc-route-transfer-duration:.28s", semanticBlock);
const reducedDuration = css.indexOf("--pc-route-transfer-duration:.001ms", semanticBlock);
if (!(semanticBlock >= 0 && mobileDuration820 > semanticBlock && mobileDuration560 > mobileDuration820 && reducedDuration > mobileDuration560)) {
  throw new Error("Semantic layer durations must remain ordered desktop → 820px → 560px → reduced-motion.");
}

const sceneCarriers = (css.match(/pc-spatial-atmosphere\[data-scene="(?:home|progress|earn|wallet|invite)"\] \.pc-route-carrier/g) ?? []).length;
if (sceneCarriers < 5) {
  throw new Error(`Route continuity must preserve five scene carrier positions; found ${sceneCarriers}.`);
}

const explicitViewTransitionNames = css.match(/view-transition-name\s*:/g) ?? [];
const semanticLayerNames = [
  "view-transition-name:pc-field-value",
  "view-transition-name:pc-field-signal",
  "view-transition-name:pc-field-network",
];
if (
  explicitViewTransitionNames.length !== 3
  || semanticLayerNames.some((name) => !css.includes(name))
) {
  throw new Error(
    `Route continuity permits exactly three CSS-owned semantic layer snapshots; found ${explicitViewTransitionNames.length}.`,
  );
}
if (css.includes("pc-spatial-field")) {
  throw new Error("Whole-field semantic snapshot must stay removed after V11.14.");
}
if (/active-view-transition-type\(pc-transfer-[^)]+\)::view-transition-(?:old|new)\(root\)/.test(css)) {
  throw new Error("Semantic route deformation must not be bound to the root snapshot.");
}

for (const forbidden of ["availableCredits", "payoutCredits", "claimReady", "rewardCredits", "ledger"]) {
  const atmosphere = read("components/spatial-atmosphere.tsx");
  if (atmosphere.includes(forbidden)) {
    throw new Error(`Shared transition geometry must not depend on financial state: ${forbidden}`);
  }
}


const PRODUCT_ROUTE_PATHS = new Set(["/dashboard", "/progress", "/earn", "/wallet", "/invite"]);
const OUTSIDE_PRODUCT_ROUTE_MARKER = "outside-product";
const SEMANTIC_LINK_ROOTS = [
  "app/dashboard",
  "app/earn",
  "app/progress",
  "app/wallet",
  "app/invite",
  "components",
];

function collectTsxFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) files.push(...collectTsxFiles(full));
    else if (entry.isFile() && full.endsWith(".tsx")) files.push(full.replaceAll("\\\\", "/"));
  }
  return files;
}

function collectTypeScriptFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) files.push(...collectTypeScriptFiles(full));
    else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) {
      files.push(full.replaceAll("\\", "/"));
    }
  }
  return files;
}

function jsxAttribute(opening, name) {
  return opening.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.text === name,
  );
}

function staticHrefCandidates(expression) {
  if (!expression) return [];
  if (ts.isStringLiteralLike(expression)) return [expression.text];
  if (ts.isParenthesizedExpression(expression)) return staticHrefCandidates(expression.expression);
  if (ts.isConditionalExpression(expression)) {
    return [
      ...staticHrefCandidates(expression.whenTrue),
      ...staticHrefCandidates(expression.whenFalse),
    ];
  }
  if (
    ts.isBinaryExpression(expression)
    && expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    return [
      ...staticHrefCandidates(expression.left),
      ...staticHrefCandidates(expression.right),
    ];
  }
  if (ts.isTemplateExpression(expression)) return [expression.head.text];
  return [];
}

function hrefCandidates(attribute) {
  if (!attribute || !attribute.initializer) return [];
  if (ts.isStringLiteral(attribute.initializer)) return [attribute.initializer.text];
  if (ts.isJsxExpression(attribute.initializer)) {
    return staticHrefCandidates(attribute.initializer.expression);
  }
  return [];
}

function literalJsxAttributeValue(attribute) {
  if (!attribute || !attribute.initializer) return null;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (
    ts.isJsxExpression(attribute.initializer)
    && attribute.initializer.expression
    && ts.isStringLiteralLike(attribute.initializer.expression)
  ) {
    return attribute.initializer.expression.text;
  }
  return null;
}

function importedBindingNames(sourceFile, moduleName, importedName) {
  const bindings = new Set();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement)
      || !ts.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== moduleName
      || !statement.importClause?.namedBindings
      || !ts.isNamedImports(statement.importClause.namedBindings)
    ) continue;

    for (const element of statement.importClause.namedBindings.elements) {
      const sourceName = element.propertyName?.text ?? element.name.text;
      if (sourceName === importedName) bindings.add(element.name.text);
    }
  }
  return bindings;
}

function hasRouteLinkAuthority(opening, authorityBindings) {
  return opening.attributes.properties.some((property) => (
    ts.isJsxSpreadAttribute(property)
    && ts.isCallExpression(property.expression)
    && ts.isIdentifier(property.expression.expression)
    && authorityBindings.has(property.expression.expression.text)
  ));
}

function hasUnresolvedDynamicHref(attribute) {
  if (
    !attribute?.initializer
    || !ts.isJsxExpression(attribute.initializer)
    || !attribute.initializer.expression
  ) return false;
  return staticHrefCandidates(attribute.initializer.expression).length === 0;
}

function auditNavigationTargetContexts(source, path) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations = [];
  const configByTag = new Map([
    ["Link", { target: "target", linkLike: true }],
    ["a", { target: "target", linkLike: true }],
    ["area", { target: "target", linkLike: true }],
    ["form", { target: "target", linkLike: false }],
    ["button", { target: "formTarget", linkLike: false }],
    ["input", { target: "formTarget", linkLike: false }],
  ]);

  function report(node, kind, target = null) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({
      kind,
      path,
      line: position.line + 1,
      column: position.character + 1,
      target,
    });
  }

  function relProtectsBlank(node) {
    const rel = literalJsxAttributeValue(jsxAttribute(node, "rel"));
    if (!rel) return false;
    const tokens = new Set(rel.toLowerCase().split(/\s+/).filter(Boolean));
    return tokens.has("noopener") || tokens.has("noreferrer");
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile);
      const config = configByTag.get(tag);
      if (config) {
        const targetAttribute = jsxAttribute(node, config.target);
        if (targetAttribute?.initializer) {
          const target = literalJsxAttributeValue(targetAttribute);
          if (target === null) {
            report(node, "target-dynamic");
          } else {
            const normalized = target.trim().toLowerCase();
            if (normalized === "_self" || normalized === "") {
              // Explicit same-context navigation is safe.
            } else if (normalized === "_blank") {
              if (!config.linkLike) {
                report(node, "target-context", target);
              } else if (!relProtectsBlank(node)) {
                report(node, "target-blank-rel", target);
              }
            } else {
              report(node, "target-context", target);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

{
  const selfTest = [
    'const dynamicTarget = "_blank";',
    'const Fixture = () => (<>',
    '  <a href="/dashboard" target="_top">top</a>',
    '  <form action="/api/withdrawals" target="_parent" />',
    '  <button formTarget="named-frame">named</button>',
    '  <a href="https://example.com" target="_blank">unsafe blank</a>',
    '  <a href="https://example.com" target="_blank" rel="noopener">safe blank</a>',
    '  <Link href="/dashboard" target="_self">same context</Link>',
    '  <input formTarget={dynamicTarget} />',
    '</>);',
  ].join("\n");
  const violations = auditNavigationTargetContexts(
    selfTest,
    "navigation-target-context.self-test.tsx",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 5
    || counts["target-context"] !== 3
    || counts["target-blank-rel"] !== 1
    || counts["target-dynamic"] !== 1
  ) {
    throw new Error("Navigation target context policy self-test failed: " + JSON.stringify(violations));
  }
}

function staticNavigationTransport(value) {
  const href = String(value ?? "").trim();
  if (!href) return "empty";
  if (href.startsWith("#")) return "fragment";
  if (href.startsWith("/") && !href.startsWith("//")) return "internal";
  if (href.startsWith("//")) return "protocol-relative";

  const scheme = href.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1]?.toLowerCase() ?? null;
  if (scheme === "https") return "https";
  if (scheme === "http") return "http";
  if (scheme === "mailto") return "mailto";
  if (scheme === "tel") return "tel";
  if (scheme) return "other-scheme";
  return "relative";
}

function staticNavigationTransportAllowed(value, surface) {
  const transport = staticNavigationTransport(value);
  if (surface === "anchor") {
    return ["internal", "fragment", "https", "mailto", "tel"].includes(transport);
  }
  return ["internal", "fragment", "https"].includes(transport);
}

function auditStaticNavigationTransport(source, path) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations = [];
  const attributeByTag = new Map([
    ["Link", { attribute: "href", surface: "route" }],
    ["a", { attribute: "href", surface: "anchor" }],
    ["area", { attribute: "href", surface: "anchor" }],
    ["form", { attribute: "action", surface: "route" }],
    ["button", { attribute: "formAction", surface: "route" }],
    ["input", { attribute: "formAction", surface: "route" }],
  ]);

  function report(node, value, surface) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({
      path,
      line: position.line + 1,
      column: position.character + 1,
      targets: [value],
      transport: staticNavigationTransport(value),
      surface,
    });
  }

  function metaRefreshTarget(contentValue) {
    if (!contentValue) return null;
    const match = contentValue.match(/(?:^|;)\s*url\s*=\s*([^;]+)\s*$/i);
    return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? null;
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile);
      const config = attributeByTag.get(tag);
      if (config) {
        const values = hrefCandidates(jsxAttribute(node, config.attribute));
        for (const value of values) {
          if (!staticNavigationTransportAllowed(value, config.surface)) {
            report(node, value, config.surface);
          }
        }
      }

      if (tag.toLowerCase() === "meta") {
        const httpEquiv = literalJsxAttributeValue(jsxAttribute(node, "httpEquiv"))
          ?? literalJsxAttributeValue(jsxAttribute(node, "http-equiv"));
        if (httpEquiv?.toLowerCase() === "refresh") {
          const target = metaRefreshTarget(
            literalJsxAttributeValue(jsxAttribute(node, "content")),
          );
          if (target && !staticNavigationTransportAllowed(target, "route")) {
            report(node, target, "meta-refresh");
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

{
  const selfTest = [
    'const Fixture = () => (<>',
    '  <Link href="http://example.com">http link</Link>',
    '  <Link href="//example.com/path">protocol relative</Link>',
    '  <Link href="../relative">relative link</Link>',
    '  <Link href="/dashboard">safe internal</Link>',
    '  <a href="http://example.com">http anchor</a>',
    '  <a href="//example.com/path">protocol-relative anchor</a>',
    '  <a href="blob:https://example.com/id">blob anchor</a>',
    '  <a href="../relative">relative anchor</a>',
    '  <a href="mailto:hello@example.com">safe mail</a>',
    '  <a href="tel:+555555555">safe phone</a>',
    '  <a href="https://example.com">safe https</a>',
    '  <area href="http://example.com/map" />',
    '  <form action="http://example.com/submit" />',
    '  <meta httpEquiv="refresh" content="0; url=//example.com/path" />',
    '</>);',
  ].join("\n");

  const violations = auditStaticNavigationTransport(
    selfTest,
    "navigation-transport.self-test.tsx",
  );
  const transports = violations.reduce((acc, violation) => {
    acc[violation.transport] = (acc[violation.transport] ?? 0) + 1;
    return acc;
  }, {});

  if (
    violations.length !== 10
    || transports.http !== 4
    || transports["other-scheme"] !== 1
    || transports["protocol-relative"] !== 3
    || transports.relative !== 2
  ) {
    throw new Error("Navigation transport policy self-test failed: " + JSON.stringify(violations));
  }
}

function auditEmbeddedContextSources(source, path) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations = [];
  const internalAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getRouteNavigationHref",
  );
  const productAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getProductRouteHref",
  );
  const externalAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getExternalNavigationHref",
  );
  const sourceByTag = new Map([
    ["iframe", "src"],
    ["frame", "src"],
    ["fencedframe", "src"],
    ["object", "data"],
    ["embed", "src"],
  ]);

  function report(node, kind, targets = []) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({
      kind,
      path,
      line: position.line + 1,
      column: position.character + 1,
      targets: [...new Set(targets)],
    });
  }

  function hasInternalAuthority(expression) {
    return expressionContainsAuthorityCall(expression, internalAuthorityBindings)
      || expressionContainsAuthorityCall(expression, productAuthorityBindings);
  }

  function hasExternalAuthority(expression) {
    return expressionContainsAuthorityCall(expression, externalAuthorityBindings);
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile).toLowerCase();

      if (tag === "iframe") {
        const srcDoc = jsxAttribute(node, "srcDoc") ?? jsxAttribute(node, "srcdoc");
        if (srcDoc?.initializer) report(node, "embedded-srcdoc");
      }

      const sourceAttributeName = sourceByTag.get(tag);
      if (sourceAttributeName) {
        const attribute = jsxAttribute(node, sourceAttributeName);
        if (attribute?.initializer) {
          const expression = declarativeAttributeExpression(attribute);
          const values = staticNavigationLikeValues(attribute);

          if (values.length === 0) {
            if (
              !hasInternalAuthority(expression)
              && !hasExternalAuthority(expression)
            ) {
              report(node, "embedded-source-dynamic");
            }
          } else {
            for (const value of values) {
              const transport = staticNavigationTransport(value);
              if (transport === "internal" || transport === "fragment") {
                if (!hasInternalAuthority(expression)) {
                  report(node, "embedded-source", [value]);
                }
              } else if (transport === "https") {
                if (!hasExternalAuthority(expression)) {
                  report(node, "embedded-source", [value]);
                }
              } else {
                report(node, "embedded-source-transport", [value]);
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

{
  const selfTest = [
    'import { getExternalNavigationHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'const dynamicSource = chooseSource();',
    'const Fixture = () => (<>',
    '  <iframe src="/dashboard" />',
    '  <iframe src={getRouteNavigationHref("embedded-source", "/dashboard")} />',
    '  <object data="https://example.com/doc" />',
    '  <embed src={getExternalNavigationHref("https://example.com/doc")} />',
    '  <iframe src={dynamicSource} />',
    '  <iframe src="http://example.com/insecure" />',
    '  <object data="//example.com/protocol-relative" />',
    '  <frame src="/wallet" />',
    '  <iframe srcDoc="<a href=\"/dashboard\">inside</a>" />',
    '  <iframe />',
    '</>);',
  ].join("\n");
  const violations = auditEmbeddedContextSources(
    selfTest,
    "embedded-context-source.self-test.tsx",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 7
    || counts["embedded-source"] !== 3
    || counts["embedded-source-dynamic"] !== 1
    || counts["embedded-source-transport"] !== 2
    || counts["embedded-srcdoc"] !== 1
  ) {
    throw new Error("Embedded context source authority self-test failed: " + JSON.stringify(violations));
  }
}

function executableUrlScheme(value) {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/[\u0000-\u0020\u007f]/g, "")
    .toLowerCase();

  if (normalized.startsWith("javascript:")) return "javascript";
  if (normalized.startsWith("vbscript:")) return "vbscript";
  if (!normalized.startsWith("data:")) return null;

  const mediaType = normalized
    .slice("data:".length)
    .split(/[;,]/, 1)[0];
  if (
    mediaType === "text/html"
    || mediaType === "application/xhtml+xml"
    || mediaType === "image/svg+xml"
    || mediaType === "text/javascript"
    || mediaType === "application/javascript"
    || mediaType === "text/ecmascript"
    || mediaType === "application/ecmascript"
  ) return "data-executable";

  return null;
}

function auditExecutableUrlSchemes(source, path) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations = [];
  const attributeByTag = new Map([
    ["Link", "href"],
    ["a", "href"],
    ["area", "href"],
    ["form", "action"],
    ["button", "formAction"],
    ["input", "formAction"],
    ["base", "href"],
    ["iframe", "src"],
    ["object", "data"],
    ["embed", "src"],
    ["script", "src"],
    ["Script", "src"],
  ]);

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile);
      const attributeName = attributeByTag.get(tag);
      if (attributeName) {
        const attribute = jsxAttribute(node, attributeName);
        const values = hrefCandidates(attribute);
        const executableValues = values
          .map((value) => ({ value, scheme: executableUrlScheme(value) }))
          .filter((entry) => entry.scheme);
        if (executableValues.length > 0) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          violations.push({
            path,
            line: position.line + 1,
            column: position.character + 1,
            targets: executableValues.map((entry) => entry.value),
            schemes: [...new Set(executableValues.map((entry) => entry.scheme))],
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

{
  const selfTest = [
    'const Fixture = () => (<>',
    '  <a href="javascript:alert(1)">bad</a>',
    '  <Link href="JaVaScRiPt:alert(2)">bad link</Link>',
    '  <form action="vbscript:msgbox(1)" />',
    '  <button formAction="data:text/html,<script>alert(1)</script>">bad form action</button>',
    '  <input formAction="data:application/xhtml+xml,<html />" />',
    '  <iframe src="data:image/svg+xml,<svg onload=alert(1) />" />',
    '  <object data="data:text/html;base64,PGgxPkJhZDwvaDE+" />',
    '  <base href="javascript:alert(1)" />',
    '  <a href="https://example.com">safe https</a>',
    '  <a href="mailto:hello@example.com">safe mail</a>',
    '  <a href="tel:+555555555">safe phone</a>',
    '  <img src="data:image/png;base64,AA==" />',
    '</>);',
  ].join("\n");
  const violations = auditExecutableUrlSchemes(
    selfTest,
    "executable-url-scheme.self-test.tsx",
  );
  const schemes = violations.flatMap((violation) => violation.schemes);
  if (
    violations.length !== 8
    || schemes.filter((scheme) => scheme === "javascript").length !== 3
    || schemes.filter((scheme) => scheme === "vbscript").length !== 1
    || schemes.filter((scheme) => scheme === "data-executable").length !== 4
  ) {
    throw new Error("Executable URL scheme boundary self-test failed: " + JSON.stringify(violations));
  }
}

function normalizedProductRoute(value) {
  const path = value.split("#", 1)[0]?.split("?", 1)[0] ?? value;
  return PRODUCT_ROUTE_PATHS.has(path) ? path : null;
}

function auditSemanticLinks(source, path) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations = [];
  const routeLinkAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getRouteLinkProps",
  );
  const routeNavigationAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getRouteNavigationHref",
  );
  const productHrefAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getProductRouteHref",
  );
  const externalHrefAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getExternalNavigationHref",
  );

  function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && node.tagName.getText(sourceFile) === "Link"
    ) {
      const href = jsxAttribute(node, "href");
      const targets = hrefCandidates(href)
        .map(normalizedProductRoute)
        .filter(Boolean);
      const transitionTypes = jsxAttribute(node, "transitionTypes");
      const explicitOutsideProduct = literalJsxAttributeValue(
        jsxAttribute(node, "data-route-semantic"),
      ) === OUTSIDE_PRODUCT_ROUTE_MARKER;
      const routeLinkAuthority = hasRouteLinkAuthority(node, routeLinkAuthorityBindings);
      const unresolvedDynamicHref = hasUnresolvedDynamicHref(href);
      const hrefExpression = href?.initializer && ts.isJsxExpression(href.initializer)
        ? href.initializer.expression
        : null;
      const dynamicHrefAuthority = (
        routeLinkAuthority
        || expressionContainsAuthorityCall(hrefExpression, routeNavigationAuthorityBindings)
        || expressionContainsAuthorityCall(hrefExpression, productHrefAuthorityBindings)
        || expressionContainsAuthorityCall(hrefExpression, externalHrefAuthorityBindings)
      );
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

      if (unresolvedDynamicHref && !dynamicHrefAuthority) {
        violations.push({
          kind: "provenance",
          path,
          line: position.line + 1,
          column: position.character + 1,
          targets: [],
        });
      }

      if (targets.length > 0 && !routeLinkAuthority && !transitionTypes && !explicitOutsideProduct) {
        violations.push({
          kind: "coverage",
          path,
          line: position.line + 1,
          column: position.character + 1,
          targets: [...new Set(targets)],
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

{
  const selfTest = [
    'import { getRouteLinkProps, getRouteNavigationHref } from "@/lib/route-semantics";',
    "const Fixture = ({ signedIn, mission, admin }) => (",
    "  <>",
    "    <Link href=\"/progress\">Missing static coverage</Link>",
    "    <Link href={\"/wallet?tab=history\"} transitionTypes={[\"pc-forward\"]}>Covered static product route</Link>",
    "    <Link href={signedIn ? \"/invite#network\" : \"/auth\"} transitionTypes={routeTypes}>Conditional static candidates</Link>",
    "    <Link href={mission.href} transitionTypes={getRouteTransitionTypesForHref(\"earn\", mission.href)}>Unproven dynamic route</Link>",
    "    <Link {...getRouteLinkProps(\"earn\", mission.href)}>Authoritative dynamic route</Link>",
    "    <Link href={admin.href} data-route-semantic=\"outside-product\">Unproven dynamic outside-product route</Link>",
    "    <Link href={getRouteNavigationHref(\"admin\", admin.href)} data-route-semantic=\"outside-product\">Governed dynamic outside-product route</Link>",
    "    <Link href=\"/dashboard\" data-route-semantic=\"outside-product\">Explicit static public escape</Link>",
    "  </>",
    ");",
  ].join("\n");
  const violations = auditSemanticLinks(selfTest, "semantic-link-coverage.self-test.tsx");
  if (
    violations.length !== 3
    || violations.filter((violation) => violation.kind === "coverage").length !== 1
    || violations.filter((violation) => violation.kind === "provenance").length !== 2
    || violations.find((violation) => violation.kind === "coverage")?.targets[0] !== "/progress"
  ) {
    throw new Error("Semantic Link coverage/provenance self-test failed: " + JSON.stringify(violations));
  }
}

function auditNativeAnchors(source, path) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations = [];
  const routeNavigationAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getRouteNavigationHref",
  );
  const productHrefAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getProductRouteHref",
  );
  const externalHrefAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getExternalNavigationHref",
  );

  function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && (node.tagName.getText(sourceFile) === "a" || node.tagName.getText(sourceFile) === "area")
    ) {
      const href = jsxAttribute(node, "href");
      const targets = hrefCandidates(href)
        .map(normalizedProductRoute)
        .filter(Boolean);
      const explicitOutsideProduct = literalJsxAttributeValue(
        jsxAttribute(node, "data-route-semantic"),
      ) === OUTSIDE_PRODUCT_ROUTE_MARKER;
      const unresolvedDynamicHref = hasUnresolvedDynamicHref(href);
      const hrefExpression = href?.initializer && ts.isJsxExpression(href.initializer)
        ? href.initializer.expression
        : null;
      const dynamicHrefAuthority = (
        expressionContainsAuthorityCall(hrefExpression, routeNavigationAuthorityBindings)
        || expressionContainsAuthorityCall(hrefExpression, productHrefAuthorityBindings)
        || expressionContainsAuthorityCall(hrefExpression, externalHrefAuthorityBindings)
      );
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

      if (unresolvedDynamicHref && (!explicitOutsideProduct || !dynamicHrefAuthority)) {
        violations.push({
          kind: "dynamic-provenance",
          path,
          line: position.line + 1,
          column: position.character + 1,
          targets: [],
        });
      } else if (targets.length > 0 && !explicitOutsideProduct) {
        violations.push({
          kind: "semantic",
          path,
          line: position.line + 1,
          column: position.character + 1,
          targets: [...new Set(targets)],
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

{
  const selfTest = [
    'import { getExternalNavigationHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'const Fixture = ({ provider, admin }) => (<>',
    '  <a href={provider.href} data-route-semantic="outside-product">raw provider</a>',
    '  <a href={getExternalNavigationHref(provider.href)} data-route-semantic="outside-product">safe provider</a>',
    '  <area href={admin.href} data-route-semantic="outside-product" />',
    '  <area href={getRouteNavigationHref("map", admin.href)} data-route-semantic="outside-product" />',
    '</>);',
  ].join("\n");
  const violations = auditNativeAnchors(
    selfTest,
    "dynamic-native-href-provenance.self-test.tsx",
  );
  if (
    violations.length !== 2
    || violations.some((violation) => violation.kind !== "dynamic-provenance")
  ) {
    throw new Error("Dynamic native href provenance self-test failed: " + JSON.stringify(violations));
  }
}

function expressionContainsAuthorityCall(expression, bindings) {
  if (!expression) return false;
  if (
    ts.isCallExpression(expression)
    && ts.isIdentifier(expression.expression)
    && bindings.has(expression.expression.text)
  ) return true;

  let found = false;
  ts.forEachChild(expression, (child) => {
    if (!found && expressionContainsAuthorityCall(child, bindings)) found = true;
  });
  return found;
}

function declarativeAttributeExpression(attribute) {
  if (!attribute?.initializer) return null;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer;
  if (ts.isJsxExpression(attribute.initializer)) return attribute.initializer.expression ?? null;
  return null;
}

function staticNavigationLikeValues(attribute) {
  if (!attribute?.initializer) return [];
  if (ts.isStringLiteral(attribute.initializer)) return [attribute.initializer.text];
  if (
    ts.isJsxExpression(attribute.initializer)
    && attribute.initializer.expression
  ) {
    return staticHrefCandidates(attribute.initializer.expression);
  }
  return [];
}

function isServerActionReferenceExpression(expression) {
  if (!expression) return false;
  return (
    ts.isIdentifier(expression)
    || ts.isPropertyAccessExpression(expression)
    || ts.isElementAccessExpression(expression)
    || ts.isArrowFunction(expression)
    || ts.isFunctionExpression(expression)
  );
}

function auditDeclarativeNavigation(source, path) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations = [];
  const internalAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getRouteNavigationHref",
  );
  const productAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getProductRouteHref",
  );
  const externalAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getExternalNavigationHref",
  );

  function hasInternalAuthority(expression) {
    return expressionContainsAuthorityCall(expression, internalAuthorityBindings)
      || expressionContainsAuthorityCall(expression, productAuthorityBindings);
  }

  function hasExternalAuthority(expression) {
    return expressionContainsAuthorityCall(expression, externalAuthorityBindings);
  }

  function report(node, kind, targets = []) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({
      kind,
      path,
      line: position.line + 1,
      column: position.character + 1,
      targets: [...new Set(targets)],
    });
  }

  function validateUrlAttribute(node, attribute, kind) {
    if (!attribute?.initializer) return;
    const expression = declarativeAttributeExpression(attribute);
    const staticValues = staticNavigationLikeValues(attribute);
    const internalValues = staticValues.filter((value) => value.startsWith("/") || value.startsWith("#"));
    const externalValues = staticValues.filter((value) => /^https?:\/\//i.test(value));

    if (internalValues.length > 0 && !hasInternalAuthority(expression)) {
      report(node, kind, internalValues);
      return;
    }
    if (externalValues.length > 0 && !hasExternalAuthority(expression)) {
      report(node, kind, externalValues);
      return;
    }

    if (
      ts.isJsxExpression(attribute.initializer)
      && expression
      && staticValues.length === 0
      && !hasInternalAuthority(expression)
      && !hasExternalAuthority(expression)
      && !isServerActionReferenceExpression(expression)
    ) {
      report(node, kind);
    }
  }

  function metaRefreshTarget(contentValue) {
    if (!contentValue) return null;
    const match = contentValue.match(/(?:^|;)\s*url\s*=\s*([^;]+)\s*$/i);
    return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? null;
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile).toLowerCase();

      if (tag === "form") {
        validateUrlAttribute(node, jsxAttribute(node, "action"), "form-action");
      }

      if (tag === "button" || tag === "input") {
        validateUrlAttribute(node, jsxAttribute(node, "formAction"), "form-action");
      }

      if (tag === "base" && jsxAttribute(node, "href")) {
        report(node, "base-href");
      }

      if (tag === "meta") {
        const httpEquiv = literalJsxAttributeValue(jsxAttribute(node, "httpEquiv"))
          ?? literalJsxAttributeValue(jsxAttribute(node, "http-equiv"));
        if (httpEquiv?.toLowerCase() === "refresh") {
          const content = jsxAttribute(node, "content");
          const expression = declarativeAttributeExpression(content);
          const literalContent = literalJsxAttributeValue(content);
          const target = metaRefreshTarget(literalContent);

          if (
            target
            && (
              (target.startsWith("/") || target.startsWith("#"))
                ? !hasInternalAuthority(expression)
                : /^https?:\/\//i.test(target)
                  ? !hasExternalAuthority(expression)
                  : true
            )
          ) {
            report(node, "meta-refresh", [target]);
          } else if (
            !target
            && !hasInternalAuthority(expression)
            && !hasExternalAuthority(expression)
          ) {
            report(node, "meta-refresh");
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

{
  const selfTest = [
    'import { getExternalNavigationHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'const saveProfile = async (formData) => { "use server"; };',
    'const Fixture = () => (<>',
    '  <form action={saveProfile}><button>Server action</button></form>',
    '  <form action="/dashboard"><button>Raw internal URL</button></form>',
    '  <form action={getRouteNavigationHref("form", "/dashboard")}><button>Safe internal URL</button></form>',
    '  <form action="https://example.com/submit"><button>Raw external URL</button></form>',
    '  <form action={getExternalNavigationHref("https://example.com/submit")}><button>Safe external URL</button></form>',
    '  <button formAction="/earn">Raw button action</button>',
    '  <input formAction={getRouteNavigationHref("form", "/earn")} />',
    '  <meta httpEquiv="refresh" content="0; url=/wallet" />',
    '  <meta httpEquiv="refresh" content={"0; url=" + getRouteNavigationHref("meta", "/wallet")} />',
    '  <base href="/dashboard/" />',
    '</>);',
  ].join("\n");
  const violations = auditDeclarativeNavigation(
    selfTest,
    "declarative-navigation.self-test.tsx",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 5
    || counts["form-action"] !== 3
    || counts["meta-refresh"] !== 1
    || counts["base-href"] !== 1
  ) {
    throw new Error("Declarative navigation surface authority self-test failed: " + JSON.stringify(violations));
  }
}

function auditFormSubmissionTransport(source, path) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations = [];
  const safeEncodings = new Set([
    "application/x-www-form-urlencoded",
    "multipart/form-data",
  ]);

  function report(node, kind, value = null) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({
      kind,
      path,
      line: position.line + 1,
      column: position.character + 1,
      value,
    });
  }

  function literalAttribute(attribute) {
    const value = literalJsxAttributeValue(attribute);
    return value === null ? null : value.trim().toLowerCase();
  }

  function clearlyUrlBackedAction(openingElement) {
    const action = jsxAttribute(openingElement, "action");
    if (!action?.initializer) return false;
    if (ts.isStringLiteral(action.initializer)) return true;
    if (!ts.isJsxExpression(action.initializer)) return false;
    const expression = action.initializer.expression;
    if (!expression) return false;
    return !isServerActionReferenceExpression(expression);
  }

  function validateMethod(node, attribute, kind, required) {
    if (!attribute?.initializer) {
      if (required) report(node, kind + "-implicit");
      return;
    }
    const value = literalAttribute(attribute);
    if (value === null) {
      report(node, kind + "-dynamic");
      return;
    }
    if (value !== "post") report(node, kind, value);
  }

  function validateEncoding(node, attribute, kind) {
    if (!attribute?.initializer) return;
    const value = literalAttribute(attribute);
    if (value === null) {
      report(node, kind + "-dynamic");
      return;
    }
    if (!safeEncodings.has(value)) report(node, kind, value);
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile).toLowerCase();

      if (tag === "form") {
        validateMethod(
          node,
          jsxAttribute(node, "method"),
          "form-method",
          clearlyUrlBackedAction(node),
        );
        validateEncoding(
          node,
          jsxAttribute(node, "encType") ?? jsxAttribute(node, "enctype"),
          "form-enctype",
        );
      }

      if (tag === "button" || tag === "input") {
        validateMethod(
          node,
          jsxAttribute(node, "formMethod") ?? jsxAttribute(node, "formmethod"),
          "submitter-method",
          false,
        );
        validateEncoding(
          node,
          jsxAttribute(node, "formEncType") ?? jsxAttribute(node, "formenctype"),
          "submitter-enctype",
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

{
  const selfTest = [
    'import { getRouteNavigationHref } from "@/lib/route-semantics";',
    'const saveProfile = async (formData) => { "use server"; };',
    'const dynamicMethod = chooseMethod();',
    'const Fixture = () => (<>',
    '  <form action={saveProfile}>server action</form>',
    '  <form action={getRouteNavigationHref("form-mode", "/api/safe")} method="post" />',
    '  <form action={getRouteNavigationHref("form-mode", "/api/implicit")} />',
    '  <form action={getRouteNavigationHref("form-mode", "/api/get")} method="get" />',
    '  <form action={getRouteNavigationHref("form-mode", "/api/dynamic")} method={dynamicMethod} />',
    '  <form action={getRouteNavigationHref("form-mode", "/api/plain")} method="post" encType="text/plain" />',
    '  <form action={getRouteNavigationHref("form-mode", "/api/upload")} method="post" encType="multipart/form-data" />',
    '  <button formMethod="get">bad override</button>',
    '  <input formMethod={dynamicMethod} />',
    '  <button formEncType="text/plain">bad encoding</button>',
    '  <input formEncType="multipart/form-data" />',
    '</>);',
  ].join("\n");
  const violations = auditFormSubmissionTransport(
    selfTest,
    "form-submission-transport.self-test.tsx",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 7
    || counts["form-method-implicit"] !== 1
    || counts["form-method"] !== 1
    || counts["form-method-dynamic"] !== 1
    || counts["form-enctype"] !== 1
    || counts["submitter-method"] !== 1
    || counts["submitter-method-dynamic"] !== 1
    || counts["submitter-enctype"] !== 1
  ) {
    throw new Error("Form submission transport policy self-test failed: " + JSON.stringify(violations));
  }
}

function auditFormValidationBypass(source, path) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations = [];

  function report(node, kind) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({
      kind,
      path,
      line: position.line + 1,
      column: position.character + 1,
    });
  }

  function booleanAttributeState(attribute) {
    if (!attribute) return "absent";
    if (!attribute.initializer) return "enabled";
    if (ts.isStringLiteral(attribute.initializer)) return "enabled";
    if (
      !ts.isJsxExpression(attribute.initializer)
      || !attribute.initializer.expression
    ) return "dynamic";

    const expression = attribute.initializer.expression;
    if (expression.kind === ts.SyntaxKind.FalseKeyword) return "disabled";
    if (expression.kind === ts.SyntaxKind.TrueKeyword) return "enabled";
    return "dynamic";
  }

  function validateBypass(node, attribute, baseKind) {
    const state = booleanAttributeState(attribute);
    if (state === "enabled") {
      report(node, baseKind + "-bypass");
    } else if (state === "dynamic") {
      report(node, baseKind + "-dynamic");
    }
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile).toLowerCase();
      if (tag === "form") {
        validateBypass(
          node,
          jsxAttribute(node, "noValidate") ?? jsxAttribute(node, "novalidate"),
          "form-validation",
        );
      } else if (tag === "button" || tag === "input") {
        validateBypass(
          node,
          jsxAttribute(node, "formNoValidate") ?? jsxAttribute(node, "formnovalidate"),
          "submitter-validation",
        );
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

{
  const selfTest = [
    'const dynamicValidation = chooseValidationMode();',
    'const Fixture = () => (<>',
    '  <form noValidate />',
    '  <form noValidate={false} />',
    '  <form noValidate={true} />',
    '  <form noValidate={dynamicValidation} />',
    '  <form novalidate="false" />',
    '  <button formNoValidate />',
    '  <button formNoValidate={false} />',
    '  <input formNoValidate={true} />',
    '  <input formNoValidate={dynamicValidation} />',
    '</>);',
  ].join("\n");
  const violations = auditFormValidationBypass(
    selfTest,
    "form-validation-bypass.self-test.tsx",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 7
    || counts["form-validation-bypass"] !== 3
    || counts["form-validation-dynamic"] !== 1
    || counts["submitter-validation-bypass"] !== 2
    || counts["submitter-validation-dynamic"] !== 1
  ) {
    throw new Error("Form validation bypass authority self-test failed: " + JSON.stringify(violations));
  }
}

function auditVerifiedReplayForms(source, path) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations = [];
  const internalAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getRouteNavigationHref",
  );
  const productAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getProductRouteHref",
  );
  const externalAuthorityBindings = importedBindingNames(
    sourceFile,
    "@/lib/route-semantics",
    "getExternalNavigationHref",
  );
  const turnstileBindings = importedBindingNames(
    sourceFile,
    "@/components/turnstile-field",
    "TurnstileField",
  );
  const markerValue = "verified-replay";

  function report(node, kind) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({
      kind,
      path,
      line: position.line + 1,
      column: position.character + 1,
      targets: [],
    });
  }

  function jsxTagName(node) {
    if (!(ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) return null;
    return node.tagName.getText(sourceFile);
  }

  function replayMarker(openingElement) {
    return literalJsxAttributeValue(
      jsxAttribute(openingElement, "data-route-submit-authority"),
    );
  }

  function isGovernedFormAction(openingElement) {
    const actionAttribute = jsxAttribute(openingElement, "action");
    if (!actionAttribute?.initializer) return false;
    if (!ts.isJsxExpression(actionAttribute.initializer)) return false;
    const expression = actionAttribute.initializer.expression;
    if (!expression) return false;

    if (isServerActionReferenceExpression(expression)) return true;
    return (
      expressionContainsAuthorityCall(expression, internalAuthorityBindings)
      || expressionContainsAuthorityCall(expression, productAuthorityBindings)
      || expressionContainsAuthorityCall(expression, externalAuthorityBindings)
    );
  }

  function containsTurnstile(element) {
    let found = false;
    function scan(node) {
      if (found) return;
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
        && turnstileBindings.has(jsxTagName(node))
      ) {
        found = true;
        return;
      }
      ts.forEachChild(node, scan);
    }
    for (const child of element.children) scan(child);
    return found;
  }

  function nearestForm(node) {
    let current = node.parent;
    while (current) {
      if (
        ts.isJsxElement(current)
        && current.openingElement.tagName.getText(sourceFile).toLowerCase() === "form"
      ) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  function visit(node) {
    if (ts.isJsxElement(node)) {
      const opening = node.openingElement;
      if (opening.tagName.getText(sourceFile).toLowerCase() === "form") {
        const marker = replayMarker(opening);
        if (marker !== null) {
          if (marker !== markerValue) {
            report(opening, "verified-replay-marker");
          } else {
            if (!containsTurnstile(node)) report(opening, "verified-replay-orphan");
            if (!isGovernedFormAction(opening)) {
              report(opening, "verified-replay-action");
            }
          }
        }
      }
    }

    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && turnstileBindings.has(jsxTagName(node))
    ) {
      const form = nearestForm(node);
      if (!form || replayMarker(form.openingElement) !== markerValue) {
        report(node, "verified-replay-unmarked");
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

{
  const selfTest = [
    'import { TurnstileField } from "@/components/turnstile-field";',
    'import { getRouteNavigationHref } from "@/lib/route-semantics";',
    'const signIn = async (formData) => { "use server"; };',
    'const Fixture = () => (<>',
    '  <form action={signIn} data-route-submit-authority="verified-replay"><TurnstileField action="signin" /></form>',
    '  <form action={getRouteNavigationHref("replay", "/api/ads/interest")} data-route-submit-authority="verified-replay"><TurnstileField action="ads" /></form>',
    '  <form action="/api/raw" data-route-submit-authority="verified-replay"><TurnstileField action="raw" /></form>',
    '  <form action={signIn} data-route-submit-authority="verified-replay"><button>Missing Turnstile</button></form>',
    '  <form action={signIn}><TurnstileField action="unmarked" /></form>',
    '</>);',
  ].join("\n");
  const violations = auditVerifiedReplayForms(
    selfTest,
    "verified-replay-form.self-test.tsx",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 3
    || counts["verified-replay-action"] !== 1
    || counts["verified-replay-orphan"] !== 1
    || counts["verified-replay-unmarked"] !== 1
  ) {
    throw new Error("Verified replay form authority self-test failed: " + JSON.stringify(violations));
  }
}

function authorityCall(expression, bindings) {
  return Boolean(
    expression
    && ts.isCallExpression(expression)
    && ts.isIdentifier(expression.expression)
    && bindings.has(expression.expression.text)
  );
}

function auditImperativeNavigation(source, path, options = {}) {
  const enforceProgrammaticTargetContextPolicy = (
    options.programmaticTargetContextPolicy === true
  );
  const enforceFormSubmissionTransportPolicy = (
    options.formSubmissionTransportPolicy === true
  );
  const enforceFormValidationBypassPolicy = (
    options.formValidationBypassPolicy === true
  );
  const enforceFormConstraintIntegrityPolicy = (
    options.formConstraintIntegrityPolicy === true
  );
  const enforceFormControlParticipationPolicy = (
    options.formControlParticipationPolicy === true
  );
  const enforceFormOwnershipProvenancePolicy = (
    options.formOwnershipProvenancePolicy === true
  );
  const enforceFormOwnershipLifecyclePolicy = (
    options.formOwnershipLifecyclePolicy === true
  );
  const enforceFormOwnershipRelocationPolicy = (
    options.formOwnershipRelocationPolicy === true
  );
  const enforceProgrammaticFormOwnershipStatePolicy = (
    options.programmaticFormOwnershipStatePolicy === true
  );
  const enforceProgrammaticFormOwnershipControlFlowPolicy = (
    options.programmaticFormOwnershipControlFlowPolicy === true
  );
  const enforceProgrammaticFormOwnershipExecutionScopePolicy = (
    options.programmaticFormOwnershipExecutionScopePolicy === true
  );
  const enforceProgrammaticFormOwnershipCallbackSchedulingPolicy = (
    options.programmaticFormOwnershipCallbackSchedulingPolicy === true
  );
  const enforceProgrammaticFormOwnershipCallbackLifetimePolicy = (
    options.programmaticFormOwnershipCallbackLifetimePolicy === true
  );
  const enforceProgrammaticFormOwnershipCallbackTeardownPathPolicy = (
    options.programmaticFormOwnershipCallbackTeardownPathPolicy === true
  );
  const enforceProgrammaticFormOwnershipCallbackTeardownControlFlowPolicy = (
    options.programmaticFormOwnershipCallbackTeardownControlFlowPolicy === true
  );
  const enforceProgrammaticFormOwnershipCallbackTeardownLoopPolicy = (
    options.programmaticFormOwnershipCallbackTeardownLoopPolicy === true
  );
  const enforceProgrammaticFormOwnershipCallbackTeardownLabeledIterationPolicy = (
    options.programmaticFormOwnershipCallbackTeardownLabeledIterationPolicy === true
  );
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const violations = [];
  const reportedViolations = new Set();
  const useRouterBindings = importedBindingNames(sourceFile, "next/navigation", "useRouter");
  const redirectBindings = new Set([
    ...importedBindingNames(sourceFile, "next/navigation", "redirect"),
    ...importedBindingNames(sourceFile, "next/navigation", "permanentRedirect"),
  ]);
  const nextResponseBindings = importedBindingNames(sourceFile, "next/server", "NextResponse");
  const navigationBindings = importedBindingNames(sourceFile, "@/lib/route-semantics", "getRouteNavigationHref");
  const productHrefBindings = importedBindingNames(sourceFile, "@/lib/route-semantics", "getProductRouteHref");
  const externalHrefBindings = importedBindingNames(sourceFile, "@/lib/route-semantics", "getExternalNavigationHref");
  const projectImportBindings = new Set();
  const projectImportNamespaces = new Set();

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement)
      || !ts.isStringLiteral(statement.moduleSpecifier)
      || !statement.importClause
    ) continue;

    const moduleName = statement.moduleSpecifier.text;
    const isProjectModule = (
      moduleName.startsWith("@/")
      || moduleName.startsWith("./")
      || moduleName.startsWith("../")
    );
    if (!isProjectModule || moduleName === "@/lib/route-semantics") continue;

    if (statement.importClause.name) {
      projectImportBindings.add(statement.importClause.name.text);
    }
    const namedBindings = statement.importClause.namedBindings;
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        projectImportBindings.add(element.name.text);
      }
    }
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      projectImportNamespaces.add(namedBindings.name.text);
    }
  }

  const routerVariables = new Set();
  const routerMethodBindings = new Set();
  const routerTraversalMethodBindings = new Set();
  const responseRedirectBindings = new Set();
  const webResponseRedirectBindings = new Set();
  const browserContextVariables = new Set();
  const browserEventViewVariables = new Set();
  const browserMessageEventVariables = new Set();
  const browserLocationVariables = new Set();
  const browserLocationMethodBindings = new Set();
  const browserLocationReloadBindings = new Set();
  const browserHistoryVariables = new Set();
  const browserHistoryMethodBindings = new Set();
  const browserHistoryTraversalMethodBindings = new Set();
  const browserNavigationApiVariables = new Set();
  const browserNavigationApiMethodBindings = new Set();
  const browserNavigationTraversalMethodBindings = new Set();
  const browserWindowOpenBindings = new Set();
  const headerVariables = new Set();
  const headerMutationMethodBindings = new Set();
  const domNavigationElementKinds = new Map();
  const domTypedIdentifierKinds = new Map();
  const domEventCurrentTargetKinds = new Map();
  const domRefKinds = new Map();
  const domCollectionKinds = new Map();
  const domSetAttributeBindings = new Map();
  const domSetAttributeNSBindings = new Map();
  const domToggleAttributeBindings = new Map();
  const domRemoveAttributeBindings = new Map();
  const domRemoveAttributeNSBindings = new Map();
  const domSetCustomValidityBindings = new Map();
  const domMethodBindingOwners = new Map();
  const domActivationMethodBindings = new Map();
  const domVerifiedReplayForms = new Set();
  const domFormAssociatedControls = new Set();
  const domFormOwnedElementIds = new Map();
  const domFormOwnedElementKinds = new Map();
  const domFormOwnedElementOwners = new Map();
  const domFormOwnedElementAssociationModes = new Map();
  const domFormOwnedRefs = new Map();
  const domFormOwnedRefOwners = new Map();
  const domFormOwnedRefAssociationModes = new Map();
  const domFormOwnedEventScopes = new Map();
  const domScopedEventCurrentTargetKinds = new Map();
  const domFormOwnedEventScopeOwners = new Map();
  const domFormOwnedEventScopeAssociationModes = new Map();
  const domFormOwnerIds = new Set();
  const domFormLifecycleOwnedControls = new Set();
  const domFormLifecycleControlOwners = new Map();
  const domFormLifecycleControlAssociationModes = new Map();
  const programmaticOwnershipBindingCounts = new Map();
  const programmaticOwnershipBindingIdentities = new Map();
  const programmaticOwnershipStates = new Map();
  const programmaticOwnershipKinds = new Map();
  let programmaticOwnershipExecutionSuppressionDepth = 0;
  let programmaticOwnershipScheduledCallbackDepth = 0;
  const programmaticOwnershipScheduledMultiplicity = [];
  const programmaticOwnershipScheduledTeardown = [];
  const programmaticOwnershipCancelledScheduledCalls = new Set();
  const programmaticOwnershipBoundedScheduledCalls = new Set();
  const programmaticOwnershipPartialTeardownScheduledCalls = new Set();
  const programmaticOwnershipLoopPartialTeardownScheduledCalls = new Set();
  const declarations = [];
  const constInitializers = new Map();
  const localFunctions = new Map();

  function bindingSourceName(element) {
    if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) return null;
    if (element.propertyName && ts.isIdentifier(element.propertyName)) return element.propertyName.text;
    if (!element.propertyName) return element.name.text;
    if (ts.isStringLiteralLike(element.propertyName)) return element.propertyName.text;
    return null;
  }

  function bindingLocalName(element) {
    return ts.isBindingElement(element) && ts.isIdentifier(element.name)
      ? element.name.text
      : null;
  }

  function propertyName(expression) {
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    if (
      ts.isElementAccessExpression(expression)
      && expression.argumentExpression
      && ts.isStringLiteralLike(expression.argumentExpression)
    ) return expression.argumentExpression.text;
    return null;
  }

  function propertyOwner(expression) {
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      return expression.expression;
    }
    return null;
  }

  function addBinding(set, value) {
    if (!value || set.has(value)) return false;
    set.add(value);
    return true;
  }

  function addKindBinding(map, value, kind) {
    if (!value || !kind || map.get(value) === kind) return false;
    map.set(value, kind);
    return true;
  }

  function setMethodBindingOwner(name, method, owner) {
    if (!name || !method || !owner) return false;
    const existing = domMethodBindingOwners.get(name);
    if (existing && existing.method === method && existing.owner === owner) return false;
    domMethodBindingOwners.set(name, { method, owner });
    return true;
  }

  function registerLocalFunction(name, node) {
    if (!name) return;
    const definition = {
      key: name + "@" + node.pos,
      name,
      node,
      parameters: node.parameters ?? [],
      body: node.body,
    };
    if (!localFunctions.has(name)) localFunctions.set(name, definition);
    else localFunctions.set(name, null);
  }

  function domKindFromTypeNameText(text) {
    const normalized = text?.split(".").pop();
    if (normalized === "HTMLAnchorElement") return "a";
    if (normalized === "HTMLAreaElement") return "area";
    if (normalized === "HTMLBaseElement") return "base";
    if (normalized === "HTMLFormElement") return "form";
    if (normalized === "HTMLButtonElement") return "button";
    if (normalized === "HTMLInputElement") return "input";
    if (normalized === "HTMLSelectElement") return "select";
    if (normalized === "HTMLTextAreaElement") return "textarea";
    if (normalized === "HTMLFieldSetElement") return "fieldset";
    if (normalized === "HTMLIFrameElement") return "iframe";
    if (normalized === "HTMLFrameElement") return "frame";
    if (normalized === "HTMLFencedFrameElement") return "fencedframe";
    if (normalized === "HTMLObjectElement") return "object";
    if (normalized === "HTMLEmbedElement") return "embed";
    return null;
  }

  function domKindFromTypeNode(typeNode) {
    if (!typeNode) return null;
    if (ts.isParenthesizedTypeNode(typeNode)) return domKindFromTypeNode(typeNode.type);
    if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
      const kinds = [...new Set(typeNode.types.map(domKindFromTypeNode).filter(Boolean))];
      return kinds.length === 1 ? kinds[0] : null;
    }
    if (ts.isTypeReferenceNode(typeNode)) {
      return domKindFromTypeNameText(typeNode.typeName.getText(sourceFile));
    }
    return null;
  }

  function domEventCurrentTargetKindFromTypeNode(typeNode) {
    if (!typeNode) return null;
    if (ts.isParenthesizedTypeNode(typeNode)) {
      return domEventCurrentTargetKindFromTypeNode(typeNode.type);
    }
    if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
      const kinds = [...new Set(
        typeNode.types.map(domEventCurrentTargetKindFromTypeNode).filter(Boolean),
      )];
      return kinds.length === 1 ? kinds[0] : null;
    }
    if (!ts.isTypeReferenceNode(typeNode)) return null;
    const direct = domKindFromTypeNameText(typeNode.typeName.getText(sourceFile));
    if (direct) return null;
    const kinds = [...new Set(
      (typeNode.typeArguments ?? []).map(domKindFromTypeNode).filter(Boolean),
    )];
    return kinds.length === 1 ? kinds[0] : null;
  }

  function isWindowViewEventTypeNode(typeNode) {
    if (!typeNode) return false;
    if (ts.isParenthesizedTypeNode(typeNode)) return isWindowViewEventTypeNode(typeNode.type);
    if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
      return typeNode.types.some(isWindowViewEventTypeNode);
    }
    if (!ts.isTypeReferenceNode(typeNode)) return false;
    const name = typeNode.typeName.getText(sourceFile).split(".").pop();
    return (
      name === "UIEvent"
      || name === "MouseEvent"
      || name === "KeyboardEvent"
      || name === "FocusEvent"
      || name === "PointerEvent"
      || name === "WheelEvent"
      || name === "DragEvent"
      || name === "TouchEvent"
      || name === "CompositionEvent"
    );
  }

  function isMessageEventTypeNode(typeNode) {
    if (!typeNode) return false;
    if (ts.isParenthesizedTypeNode(typeNode)) return isMessageEventTypeNode(typeNode.type);
    if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
      return typeNode.types.some(isMessageEventTypeNode);
    }
    if (!ts.isTypeReferenceNode(typeNode)) return false;
    return typeNode.typeName.getText(sourceFile).split(".").pop() === "MessageEvent";
  }

  function setStableKind(map, name, kind) {
    if (!name || !kind) return;
    if (!map.has(name)) {
      map.set(name, kind);
      return;
    }
    if (map.get(name) !== kind) map.set(name, null);
  }

  function setStableOwnership(map, name, owned) {
    if (!name || typeof owned !== "boolean") return;
    if (!map.has(name)) {
      map.set(name, owned);
      return;
    }
    if (map.get(name) !== owned) map.set(name, null);
  }

  function setStableOwner(map, name, owner) {
    if (!name || !owner) return;
    if (!map.has(name)) {
      map.set(name, owner);
      return;
    }
    if (map.get(name) !== owner) map.set(name, null);
  }

  function setStableAssociationMode(map, name, mode) {
    if (!name || !mode) return;
    if (!map.has(name)) {
      map.set(name, mode);
      return;
    }
    if (map.get(name) !== mode) map.set(name, "unknown");
  }

  function eventScopeKey(functionNode, parameterName) {
    return functionNode && parameterName
      ? functionNode.pos + ":" + parameterName
      : null;
  }

  function nearestFunctionScope(node) {
    let current = node?.parent ?? null;
    while (current) {
      if (ts.isFunctionLike(current)) return current;
      current = current.parent;
    }
    return null;
  }

  function programmaticBindingKey(identifier) {
    if (!identifier || !ts.isIdentifier(identifier)) return null;
    const scope = nearestFunctionScope(identifier);
    return (scope ? "function:" + scope.pos : "root") + ":" + identifier.text;
  }

  function programmaticBindingIsUnambiguous(identifier) {
    const key = programmaticBindingKey(identifier);
    return Boolean(key && programmaticOwnershipBindingCounts.get(key) === 1);
  }

  function programmaticReferenceBindingKey(identifier) {
    if (!identifier || !ts.isIdentifier(identifier)) return null;
    let scope = nearestFunctionScope(identifier);
    while (scope) {
      const key = "function:" + scope.pos + ":" + identifier.text;
      if (programmaticOwnershipBindingCounts.has(key)) return key;
      scope = nearestFunctionScope(scope);
    }
    const rootKey = "root:" + identifier.text;
    return programmaticOwnershipBindingCounts.has(rootKey) ? rootKey : null;
  }

  function programmaticOwnershipExecutionActive() {
    return (
      !enforceProgrammaticFormOwnershipExecutionScopePolicy
      || programmaticOwnershipExecutionSuppressionDepth === 0
    );
  }

  function setScopedEventEvidence(
    functionNode,
    parameterName,
    owned,
    kind = null,
    owner = null,
    associationMode = null,
  ) {
    const key = eventScopeKey(functionNode, parameterName);
    if (!key) return;
    setStableOwnership(domFormOwnedEventScopes, key, owned);
    if (kind) setStableKind(domScopedEventCurrentTargetKinds, key, kind);
    if (owned === false) {
      domFormOwnedEventScopeOwners.set(key, null);
      domFormOwnedEventScopeAssociationModes.set(key, "unknown");
      return;
    }
    if (owner) setStableOwner(domFormOwnedEventScopeOwners, key, owner);
    if (associationMode) {
      setStableAssociationMode(
        domFormOwnedEventScopeAssociationModes,
        key,
        associationMode,
      );
    }
  }

  function scopedEventTargetInfo(expression) {
    if (
      !enforceFormOwnershipProvenancePolicy
      || !(ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))
      || propertyName(expression) !== "currentTarget"
      || !ts.isIdentifier(propertyOwner(expression))
    ) return null;

    const owner = propertyOwner(expression);
    const scope = nearestFunctionScope(expression);
    const key = eventScopeKey(scope, owner.text);
    if (!key) return null;
    return {
      owned: domFormOwnedEventScopes.get(key) ?? null,
      kind: domScopedEventCurrentTargetKinds.get(key) ?? null,
      owner: domFormOwnedEventScopeOwners.get(key) ?? null,
      associationMode: domFormOwnedEventScopeAssociationModes.get(key) ?? null,
    };
  }

  function collectDeclarations(node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      registerLocalFunction(node.name.text, node);
    }

    if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.type) {
      setStableKind(domTypedIdentifierKinds, node.name.text, domKindFromTypeNode(node.type));
      setStableKind(
        domEventCurrentTargetKinds,
        node.name.text,
        domEventCurrentTargetKindFromTypeNode(node.type),
      );
      if (isWindowViewEventTypeNode(node.type)) {
        browserEventViewVariables.add(node.name.text);
      }
      if (isMessageEventTypeNode(node.type)) {
        browserMessageEventVariables.add(node.name.text);
      }
    }

    if (ts.isVariableDeclaration(node)) {
      declarations.push(node);
      if (ts.isIdentifier(node.name)) {
        const bindingKey = programmaticBindingKey(node.name);
        if (bindingKey) {
          programmaticOwnershipBindingCounts.set(
            bindingKey,
            (programmaticOwnershipBindingCounts.get(bindingKey) ?? 0) + 1,
          );
        }
      }
      if (ts.isIdentifier(node.name) && node.type) {
        setStableKind(domTypedIdentifierKinds, node.name.text, domKindFromTypeNode(node.type));
        if (isWindowViewEventTypeNode(node.type)) {
          browserEventViewVariables.add(node.name.text);
        }
        if (isMessageEventTypeNode(node.type)) {
          browserMessageEventVariables.add(node.name.text);
        }
      }
      if (
        ts.isIdentifier(node.name)
        && node.initializer
        && ts.isVariableDeclarationList(node.parent)
        && (node.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        constInitializers.set(node.name.text, node.initializer);
      }
      if (
        ts.isIdentifier(node.name)
        && node.initializer
        && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        registerLocalFunction(node.name.text, node.initializer);
      }
    }
    ts.forEachChild(node, collectDeclarations);
  }

  collectDeclarations(sourceFile);

  function resolveDataExpression(expression, env = new Map(), seen = new Set()) {
    if (!expression) return expression;
    if (ts.isParenthesizedExpression(expression)) {
      return resolveDataExpression(expression.expression, env, seen);
    }
    if (ts.isIdentifier(expression)) {
      const envKey = "env:" + expression.text;
      if (env.has(expression.text) && !seen.has(envKey)) {
        const nextSeen = new Set(seen);
        nextSeen.add(envKey);
        return resolveDataExpression(env.get(expression.text), env, nextSeen);
      }
      const constKey = "const:" + expression.text;
      if (constInitializers.has(expression.text) && !seen.has(constKey)) {
        const initializer = constInitializers.get(expression.text);
        if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) return expression;
        const nextSeen = new Set(seen);
        nextSeen.add(constKey);
        return resolveDataExpression(initializer, env, nextSeen);
      }
    }
    return expression;
  }

  function isUseRouterCall(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    return Boolean(
      resolved
      && ts.isCallExpression(resolved)
      && ts.isIdentifier(resolved.expression)
      && useRouterBindings.has(resolved.expression.text)
    );
  }

  function isRouterObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    return Boolean(
      resolved
      && (
        (ts.isIdentifier(resolved) && routerVariables.has(resolved.text))
        || isUseRouterCall(resolved, env)
      )
    );
  }

  function isFramesCollectionObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && resolved.text === "frames") return true;
    if (
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "frames"
    ) {
      return isBrowsingContextObject(propertyOwner(resolved), env);
    }
    return false;
  }

  function isEventViewSource(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved)) {
      return browserEventViewVariables.has(resolved.text);
    }
    if (
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "nativeEvent"
    ) {
      return isEventViewSource(propertyOwner(resolved), env);
    }
    return false;
  }

  function isMessageEventSource(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved)) {
      return browserMessageEventVariables.has(resolved.text);
    }
    if (
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "nativeEvent"
    ) {
      return isMessageEventSource(propertyOwner(resolved), env);
    }
    return false;
  }

  function isBrowsingContextObject(expression, env = new Map(), seen = new Set()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;

    if (ts.isIdentifier(resolved)) {
      if (browserContextVariables.has(resolved.text)) return true;
      return (
        resolved.text === "window"
        || resolved.text === "globalThis"
        || resolved.text === "self"
        || resolved.text === "top"
        || resolved.text === "parent"
        || resolved.text === "opener"
      );
    }

    if (ts.isCallExpression(resolved)) {
      const callee = resolveDataExpression(resolved.expression, env);
      const directOpen = Boolean(
        callee
        && (
          (
            ts.isIdentifier(callee)
            && browserWindowOpenBindings.has(callee.text)
          )
          || (
            (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))
            && propertyName(callee) === "open"
            && isBrowsingContextObject(propertyOwner(callee), env, seen)
          )
        )
      );
      if (directOpen) return true;

      const definition = localFunctionFromCallee(resolved.expression, env);
      if (definition && !seen.has(definition.key)) {
        const nextSeen = new Set(seen);
        nextSeen.add(definition.key);
        const childEnv = functionEnvironment(definition, resolved, env);
        if (
          functionReturnExpressions(definition)
            .some((candidate) => isBrowsingContextObject(candidate, childEnv, nextSeen))
        ) {
          return true;
        }
      }
    }

    if (ts.isElementAccessExpression(resolved) && isFramesCollectionObject(resolved.expression, env)) {
      return true;
    }

    if (ts.isElementAccessExpression(resolved)) {
      const index = resolveDataExpression(resolved.argumentExpression, env);
      const numericIndex = Boolean(
        index
        && (
          ts.isNumericLiteral(index)
          || (ts.isStringLiteralLike(index) && /^\d+$/.test(index.text))
        )
      );
      if (
        numericIndex
        && isBrowsingContextObject(resolved.expression, env, seen)
      ) {
        return true;
      }
    }

    if (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved)) {
      const name = propertyName(resolved);
      if (name === "contentWindow") return true;
      if (name === "defaultView" && isDocumentObject(propertyOwner(resolved), env)) return true;
      if (name === "view" && isEventViewSource(propertyOwner(resolved), env)) return true;
      if (name === "source" && isMessageEventSource(propertyOwner(resolved), env)) return true;
      if (
        name === "self"
        || name === "top"
        || name === "parent"
        || name === "opener"
      ) {
        return isBrowsingContextObject(propertyOwner(resolved), env, seen);
      }
    }

    return false;
  }

  function isDocumentObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && resolved.text === "document") return true;
    if (!(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))) {
      return false;
    }
    const name = propertyName(resolved);
    if (name === "ownerDocument" || name === "contentDocument") return true;
    return name === "document" && isBrowsingContextObject(propertyOwner(resolved), env);
  }

  function isBrowserLocationObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved)) {
      return browserLocationVariables.has(resolved.text) || resolved.text === "location";
    }
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "location"
      && (
        isBrowsingContextObject(propertyOwner(resolved), env)
        || isDocumentObject(propertyOwner(resolved), env)
      )
    );
  }

  function isBrowserHistoryObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved)) {
      return browserHistoryVariables.has(resolved.text) || resolved.text === "history";
    }
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "history"
      && isBrowsingContextObject(propertyOwner(resolved), env)
    );
  }

  function isBrowserNavigationApiObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved)) {
      return browserNavigationApiVariables.has(resolved.text) || resolved.text === "navigation";
    }
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "navigation"
      && isBrowsingContextObject(propertyOwner(resolved), env)
    );
  }

  function isBrowserWindowObject(expression, env = new Map()) {
    return isBrowsingContextObject(expression, env);
  }

  function isWebResponseObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    const text = resolved.getText(sourceFile);
    return text === "Response" || text === "globalThis.Response";
  }

  function isHeadersObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && headerVariables.has(resolved.text)) return true;

    if (
      ts.isNewExpression(resolved)
      && (
        (ts.isIdentifier(resolved.expression) && resolved.expression.text === "Headers")
        || resolved.expression.getText(sourceFile) === "globalThis.Headers"
      )
    ) return true;

    if (
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "headers"
    ) return true;

    return false;
  }

  function domKindFromSelectorText(value) {
    if (typeof value !== "string") return null;
    const match = value.match(/^\s*(a|area|base|form|button|input|select|textarea|fieldset|iframe|frame|fencedframe|object|embed)(?=$|[.#:\[\s>+~])/i);
    return match ? match[1].toLowerCase() : null;
  }

  function domKindFromCallTypeArguments(callExpression) {
    if (!callExpression?.typeArguments?.length) return null;
    const kinds = [...new Set(
      callExpression.typeArguments.map(domKindFromTypeNode).filter(Boolean),
    )];
    return kinds.length === 1 ? kinds[0] : null;
  }

  function domCollectionElementKind(expression, env = new Map()) {
    if (!expression) return null;
    if (ts.isIdentifier(expression) && domCollectionKinds.has(expression.text)) {
      return domCollectionKinds.get(expression.text);
    }

    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return null;
    if (ts.isIdentifier(resolved) && domCollectionKinds.has(resolved.text)) {
      return domCollectionKinds.get(resolved.text);
    }

    if (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved)) {
      const text = resolved.getText(sourceFile);
      if (
        text === "document.forms"
        || text === "window.document.forms"
        || text === "globalThis.document.forms"
      ) return "form";
      if (
        text === "document.links"
        || text === "window.document.links"
        || text === "globalThis.document.links"
      ) return "a";
    }

    if (!ts.isCallExpression(resolved)) return null;
    const callee = resolved.expression;
    if (!(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))) {
      return null;
    }
    const method = propertyName(callee);
    if (method === "querySelectorAll") {
      const typed = domKindFromCallTypeArguments(resolved);
      if (typed) return typed;
      const selector = resolveDataExpression(resolved.arguments[0], env);
      return selector && ts.isStringLiteralLike(selector)
        ? domKindFromSelectorText(selector.text)
        : null;
    }
    if (method === "getElementsByTagName") {
      const tag = resolveDataExpression(resolved.arguments[0], env);
      if (!tag || !ts.isStringLiteralLike(tag)) return null;
      const kind = tag.text.toLowerCase();
      return ["a", "area", "base", "form", "button", "input", "select", "textarea", "fieldset", "iframe", "frame", "fencedframe", "object", "embed"].includes(kind)
        ? kind
        : null;
    }
    return null;
  }

  function domRefKindFromInitializer(initializer, env = new Map()) {
    const resolved = resolveDataExpression(initializer, env);
    if (!resolved || !ts.isCallExpression(resolved)) return null;
    const calleeText = resolved.expression.getText(sourceFile);
    if (
      calleeText !== "useRef"
      && calleeText !== "React.useRef"
      && calleeText !== "createRef"
      && calleeText !== "React.createRef"
    ) return null;
    return domKindFromCallTypeArguments(resolved);
  }

  function simpleOwnedSelectorId(value) {
    if (typeof value !== "string") return null;
    const match = value.match(/^\s*(?:[a-z][a-z0-9-]*)?#([A-Za-z_][A-Za-z0-9_:.-]*)\s*$/i);
    return match ? match[1] : null;
  }

  function explicitFormControlSelector(value) {
    if (typeof value !== "string") return null;
    const match = value.match(
      /^\s*(input|select|textarea|button|fieldset)\s*\[\s*form\s*=\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_:.-]*))\s*\]\s*$/i,
    );
    if (!match) return null;
    return {
      kind: match[1].toLowerCase(),
      formId: match[2] ?? match[3] ?? match[4] ?? null,
    };
  }

  function scopedBindingIdentity(identifier) {
    if (!identifier || !ts.isIdentifier(identifier)) return null;
    const scope = nearestFunctionScope(identifier);
    return "form-binding:" + (scope?.pos ?? "root") + ":" + identifier.text;
  }

  function formOwnerIdentity(expression, env = new Map(), seen = new Set()) {
    if (!expression) return null;

    if (
      ts.isAsExpression(expression)
      || ts.isTypeAssertionExpression(expression)
      || ts.isNonNullExpression(expression)
      || ts.isParenthesizedExpression(expression)
    ) {
      return formOwnerIdentity(expression.expression, env, seen);
    }

    if (ts.isIdentifier(expression)) {
      const envKey = "form-owner-env:" + expression.text;
      if (env.has(expression.text) && !seen.has(envKey)) {
        const nextSeen = new Set(seen);
        nextSeen.add(envKey);
        const envOwner = formOwnerIdentity(env.get(expression.text), env, nextSeen);
        if (envOwner) return envOwner;
      }

      const constKey = "form-owner-const:" + expression.text;
      if (constInitializers.has(expression.text) && !seen.has(constKey)) {
        const nextSeen = new Set(seen);
        nextSeen.add(constKey);
        const initializerOwner = formOwnerIdentity(
          constInitializers.get(expression.text),
          env,
          nextSeen,
        );
        if (initializerOwner) return initializerOwner;
      }

      if (domNavigationElementKind(expression, env) === "form") {
        return scopedBindingIdentity(expression);
      }
      return null;
    }

    const resolved = resolveDataExpression(expression, env, seen);
    if (!resolved) return null;
    if (resolved !== expression) {
      const resolvedOwner = formOwnerIdentity(resolved, env, seen);
      if (resolvedOwner) return resolvedOwner;
    }

    if (!ts.isCallExpression(resolved)) {
      return domNavigationElementKind(resolved, env) === "form"
        ? "form-node:" + resolved.pos + ":" + resolved.end
        : null;
    }

    const callee = resolved.expression;
    if (!(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))) {
      return domNavigationElementKind(resolved, env) === "form"
        ? "form-node:" + resolved.pos + ":" + resolved.end
        : null;
    }

    const method = propertyName(callee);
    const owner = propertyOwner(callee);

    if (isDocumentObject(owner, env) && method === "getElementById") {
      const idExpression = resolveDataExpression(resolved.arguments[0], env);
      if (
        idExpression
        && ts.isStringLiteralLike(idExpression)
        && domFormOwnerIds.has(idExpression.text)
      ) {
        return "form-id:" + idExpression.text;
      }
    }

    if (isDocumentObject(owner, env) && method === "querySelector") {
      const selectorExpression = resolveDataExpression(resolved.arguments[0], env);
      const id = selectorExpression && ts.isStringLiteralLike(selectorExpression)
        ? simpleOwnedSelectorId(selectorExpression.text)
        : null;
      if (id && domFormOwnerIds.has(id)) return "form-id:" + id;
    }

    if (
      method === "createElement"
      && isDocumentObject(owner, env)
      && domNavigationElementKind(resolved, env) === "form"
    ) {
      return "form-node:" + resolved.pos + ":" + resolved.end;
    }

    return domNavigationElementKind(resolved, env) === "form"
      ? "form-node:" + resolved.pos + ":" + resolved.end
      : null;
  }

  function domFormOwnedLookupInfo(expression, env = new Map()) {
    if (!enforceFormOwnershipProvenancePolicy || !expression) return null;
    const resolved = resolveDataExpression(expression, env);
    if (!resolved || !ts.isCallExpression(resolved)) return null;
    const callee = resolved.expression;
    if (!(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))) {
      return null;
    }

    const owner = propertyOwner(callee);
    if (!isDocumentObject(owner, env)) return null;
    const method = propertyName(callee);

    if (method === "getElementById") {
      const idExpression = resolveDataExpression(resolved.arguments[0], env);
      if (!idExpression || !ts.isStringLiteralLike(idExpression)) return null;
      const id = idExpression.text;
      if (domFormOwnedElementIds.get(id) !== true) return null;
      return {
        owned: true,
        kind: domFormOwnedElementKinds.get(id) ?? null,
        owner: domFormOwnedElementOwners.get(id) ?? null,
        associationMode: domFormOwnedElementAssociationModes.get(id) ?? null,
      };
    }

    if (method !== "querySelector") return null;
    const selectorExpression = resolveDataExpression(resolved.arguments[0], env);
    if (!selectorExpression || !ts.isStringLiteralLike(selectorExpression)) return null;
    const selector = selectorExpression.text;

    const ownedId = simpleOwnedSelectorId(selector);
    if (ownedId && domFormOwnedElementIds.get(ownedId) === true) {
      return {
        owned: true,
        kind: domFormOwnedElementKinds.get(ownedId) ?? null,
        owner: domFormOwnedElementOwners.get(ownedId) ?? null,
        associationMode: domFormOwnedElementAssociationModes.get(ownedId) ?? null,
      };
    }

    const explicitForm = explicitFormControlSelector(selector);
    if (
      explicitForm
      && explicitForm.formId
      && domFormOwnerIds.has(explicitForm.formId)
    ) {
      return {
        owned: true,
        kind: explicitForm.kind,
        owner: "form-id:" + explicitForm.formId,
        associationMode: "explicit",
      };
    }

    return null;
  }

  function domNavigationElementKind(expression, env = new Map()) {
    if (!expression) return null;

    if (ts.isIdentifier(expression)) {
      if (domNavigationElementKinds.has(expression.text)) {
        return domNavigationElementKinds.get(expression.text);
      }
      if (domTypedIdentifierKinds.has(expression.text)) {
        return domTypedIdentifierKinds.get(expression.text);
      }
    }

    if (
      (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))
      && propertyName(expression) === "current"
      && ts.isIdentifier(propertyOwner(expression))
      && domRefKinds.has(propertyOwner(expression).text)
    ) {
      return domRefKinds.get(propertyOwner(expression).text);
    }

    if (
      (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))
      && propertyName(expression) === "currentTarget"
    ) {
      const scopedEvent = scopedEventTargetInfo(expression);
      if (scopedEvent?.kind) return scopedEvent.kind;
      if (
        ts.isIdentifier(propertyOwner(expression))
        && domEventCurrentTargetKinds.has(propertyOwner(expression).text)
      ) {
        return domEventCurrentTargetKinds.get(propertyOwner(expression).text);
      }
    }

    if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
      return domKindFromTypeNode(expression.type)
        || domNavigationElementKind(expression.expression, env);
    }
    if (ts.isNonNullExpression(expression)) {
      return domNavigationElementKind(expression.expression, env);
    }

    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return null;
    if (resolved !== expression) {
      const resolvedKind = domNavigationElementKind(resolved, env);
      if (resolvedKind) return resolvedKind;
    }

    if (ts.isIdentifier(resolved)) {
      if (domNavigationElementKinds.has(resolved.text)) {
        return domNavigationElementKinds.get(resolved.text);
      }
      if (domTypedIdentifierKinds.has(resolved.text)) {
        return domTypedIdentifierKinds.get(resolved.text);
      }
    }

    if (
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "current"
      && ts.isIdentifier(propertyOwner(resolved))
      && domRefKinds.has(propertyOwner(resolved).text)
    ) {
      return domRefKinds.get(propertyOwner(resolved).text);
    }

    if (
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "currentTarget"
    ) {
      const scopedEvent = scopedEventTargetInfo(resolved);
      if (scopedEvent?.kind) return scopedEvent.kind;
      if (
        ts.isIdentifier(propertyOwner(resolved))
        && domEventCurrentTargetKinds.has(propertyOwner(resolved).text)
      ) {
        return domEventCurrentTargetKinds.get(propertyOwner(resolved).text);
      }
    }

    if (ts.isElementAccessExpression(resolved)) {
      const collectionKind = domCollectionElementKind(resolved.expression, env);
      if (collectionKind) return collectionKind;
    }

    if (!ts.isCallExpression(resolved)) return null;
    const callee = resolved.expression;
    if (!(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))) {
      return null;
    }
    const method = propertyName(callee);

    const ownedLookup = domFormOwnedLookupInfo(resolved, env);
    if (ownedLookup?.kind) return ownedLookup.kind;

    if (method === "item") {
      const collectionKind = domCollectionElementKind(propertyOwner(callee), env);
      if (collectionKind) return collectionKind;
    }

    if (method === "querySelector" || method === "closest") {
      const typed = domKindFromCallTypeArguments(resolved);
      if (typed) return typed;
      const selector = resolveDataExpression(resolved.arguments[0], env);
      return selector && ts.isStringLiteralLike(selector)
        ? domKindFromSelectorText(selector.text)
        : null;
    }

    if (method !== "createElement") return null;
    const ownerText = propertyOwner(callee)?.getText(sourceFile);
    if (
      ownerText !== "document"
      && ownerText !== "window.document"
      && ownerText !== "globalThis.document"
    ) return null;

    const tag = resolveDataExpression(resolved.arguments[0], env);
    if (!tag || !ts.isStringLiteralLike(tag)) return null;
    const kind = tag.text.toLowerCase();
    return ["a", "area", "base", "form", "button", "input", "select", "textarea", "fieldset", "iframe", "frame", "fencedframe", "object", "embed"].includes(kind)
      ? kind
      : null;
  }

  function domSetAttributeElementKind(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return null;
    if (ts.isIdentifier(resolved) && domSetAttributeBindings.has(resolved.text)) {
      return domSetAttributeBindings.get(resolved.text);
    }
    if (
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "setAttribute"
    ) {
      return domNavigationElementKind(propertyOwner(resolved), env);
    }
    return null;
  }

  function isDomSetAttributeReference(expression, env = new Map()) {
    return Boolean(domSetAttributeElementKind(expression, env));
  }

  function domAttributeMethodElementKind(expression, methodName, bindings, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return null;
    if (ts.isIdentifier(resolved) && bindings.has(resolved.text)) {
      return bindings.get(resolved.text);
    }
    if (
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === methodName
    ) {
      return domNavigationElementKind(propertyOwner(resolved), env);
    }
    return null;
  }

  function domSetAttributeNSElementKind(expression, env = new Map()) {
    return domAttributeMethodElementKind(
      expression,
      "setAttributeNS",
      domSetAttributeNSBindings,
      env,
    );
  }

  function isDomSetAttributeNSReference(expression, env = new Map()) {
    return Boolean(domSetAttributeNSElementKind(expression, env));
  }

  function domToggleAttributeElementKind(expression, env = new Map()) {
    return domAttributeMethodElementKind(
      expression,
      "toggleAttribute",
      domToggleAttributeBindings,
      env,
    );
  }

  function isDomToggleAttributeReference(expression, env = new Map()) {
    return Boolean(domToggleAttributeElementKind(expression, env));
  }

  function domRemoveAttributeElementKind(expression, env = new Map()) {
    return domAttributeMethodElementKind(
      expression,
      "removeAttribute",
      domRemoveAttributeBindings,
      env,
    );
  }

  function isDomRemoveAttributeReference(expression, env = new Map()) {
    return Boolean(domRemoveAttributeElementKind(expression, env));
  }

  function domRemoveAttributeNSElementKind(expression, env = new Map()) {
    return domAttributeMethodElementKind(
      expression,
      "removeAttributeNS",
      domRemoveAttributeNSBindings,
      env,
    );
  }

  function isDomRemoveAttributeNSReference(expression, env = new Map()) {
    return Boolean(domRemoveAttributeNSElementKind(expression, env));
  }

  function domSetCustomValidityElementKind(expression, env = new Map()) {
    return domAttributeMethodElementKind(
      expression,
      "setCustomValidity",
      domSetCustomValidityBindings,
      env,
    );
  }

  function isDomSetCustomValidityReference(expression, env = new Map()) {
    return Boolean(domSetCustomValidityElementKind(expression, env));
  }

  function domMethodTargetExpression(expression, methodName, env = new Map()) {
    if (!expression) return null;
    if (ts.isIdentifier(expression) && domMethodBindingOwners.has(expression.text)) {
      const binding = domMethodBindingOwners.get(expression.text);
      if (binding?.method === methodName) return binding.owner;
    }
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return null;
    if (ts.isIdentifier(resolved) && domMethodBindingOwners.has(resolved.text)) {
      const binding = domMethodBindingOwners.get(resolved.text);
      if (binding?.method === methodName) return binding.owner;
    }
    if (
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === methodName
    ) {
      return propertyOwner(resolved);
    }
    return null;
  }

  function domNavigationPropertyForKind(kind, property) {
    const normalized = property?.toLowerCase();
    if ((kind === "a" || kind === "area" || kind === "base") && normalized === "href") {
      return "href";
    }
    if (kind === "form" && normalized === "action") return "action";
    if ((kind === "button" || kind === "input") && normalized === "formaction") {
      return "formaction";
    }
    if (
      (kind === "iframe" || kind === "frame" || kind === "fencedframe" || kind === "embed")
      && normalized === "src"
    ) return "src";
    if (kind === "object" && normalized === "data") return "data";
    if (kind === "iframe" && normalized === "srcdoc") return "srcdoc";
    return null;
  }

  function isEmbeddedContextKind(kind) {
    return (
      kind === "iframe"
      || kind === "frame"
      || kind === "fencedframe"
      || kind === "object"
      || kind === "embed"
    );
  }

  function isEmbeddedInlineDocumentProperty(kind, property) {
    return kind === "iframe" && property === "srcdoc";
  }

  function domTargetContextPropertyForKind(kind, property) {
    const normalized = property?.toLowerCase();
    if ((kind === "a" || kind === "area" || kind === "form") && normalized === "target") {
      return "target";
    }
    if ((kind === "button" || kind === "input") && normalized === "formtarget") {
      return "formtarget";
    }
    return null;
  }

  function domSubmissionTransportPropertyForKind(kind, property) {
    const normalized = property?.toLowerCase();
    if (kind === "form" && normalized === "method") return "method";
    if (kind === "form" && (normalized === "enctype" || normalized === "encoding")) {
      return "enctype";
    }
    if ((kind === "button" || kind === "input") && normalized === "formmethod") {
      return "method";
    }
    if ((kind === "button" || kind === "input") && normalized === "formenctype") {
      return "enctype";
    }
    return null;
  }

  function domValidationBypassPropertyForKind(kind, property) {
    const normalized = property?.toLowerCase();
    if (kind === "form" && normalized === "novalidate") return "novalidate";
    if (
      (kind === "button" || kind === "input")
      && normalized === "formnovalidate"
    ) return "formnovalidate";
    return null;
  }

  function domParticipationPropertyForKind(kind, property) {
    const normalized = property?.toLowerCase();
    if (!normalized) return null;

    if (kind === "input" || kind === "textarea") {
      if (
        normalized === "disabled"
        || normalized === "readonly"
        || normalized === "name"
        || normalized === "form"
      ) return normalized;
    }
    if (kind === "select" || kind === "button") {
      if (
        normalized === "disabled"
        || normalized === "name"
        || normalized === "form"
      ) return normalized;
    }
    if (kind === "fieldset" && normalized === "form") return normalized;
    return null;
  }

  function literalStaticString(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    return resolved && ts.isStringLiteralLike(resolved) ? resolved.text : null;
  }

  function reportProgrammaticFormParticipationMutation(
    node,
    targetExpression,
    kind,
    property,
    value,
    env = new Map(),
    mode = "property",
  ) {
    if (!enforceFormControlParticipationPolicy) return false;
    if (!isProvenFormAssociatedControl(targetExpression, env)) return false;
    const participationProperty = domParticipationPropertyForKind(kind, property);
    if (!participationProperty) return false;

    if (
      reportProgrammaticOwnershipSchedulingUncertainty(
        node,
        targetExpression,
        participationProperty,
        env,
      )
      || reportProgrammaticOwnershipControlFlowUncertainty(
        node,
        targetExpression,
        participationProperty,
        env,
      )
    ) return true;

    if (participationProperty === "name") {
      report(node, "programmatic-participation-identity", ["name"]);
      return true;
    }
    if (participationProperty === "form") {
      report(node, "programmatic-participation-association", ["form"]);
      return true;
    }
    if (mode === "set-attribute") {
      report(node, "programmatic-participation-weaken", [participationProperty]);
      return true;
    }
    if (mode === "remove-attribute") return true;

    const state = literalValidationBoolean(value, env);
    if (state === null) {
      report(node, "programmatic-participation-dynamic", [participationProperty]);
      return true;
    }
    if (state === true) {
      report(node, "programmatic-participation-weaken", [participationProperty]);
    }
    return true;
  }

  function reportProgrammaticFormOwnershipLifecycle(
    node,
    targetExpression,
    lifecycleKind,
    method,
    env = new Map(),
  ) {
    if (!enforceFormOwnershipLifecyclePolicy) return false;
    if (!isCurrentFormOwnershipProof(targetExpression, env)) return false;
    if (lifecycleKind !== "detach" && lifecycleKind !== "replace") return false;
    if (
      reportProgrammaticOwnershipSchedulingUncertainty(
        node,
        targetExpression,
        method ?? lifecycleKind,
        env,
      )
      || reportProgrammaticOwnershipControlFlowUncertainty(
        node,
        targetExpression,
        method ?? lifecycleKind,
        env,
      )
    ) return true;
    report(
      node,
      "programmatic-ownership-" + lifecycleKind,
      method ? [method] : [],
    );
    return true;
  }

  function reportProgrammaticCustomValidityMutation(
    node,
    targetExpression,
    kind,
    value,
    env = new Map(),
  ) {
    if (!enforceFormControlParticipationPolicy) return false;
    if (
      !["input", "textarea", "select", "button", "fieldset"].includes(kind)
      || !isProvenFormAssociatedControl(targetExpression, env)
    ) return false;

    if (
      reportProgrammaticOwnershipSchedulingUncertainty(
        node,
        targetExpression,
        "custom-validity",
        env,
      )
      || reportProgrammaticOwnershipControlFlowUncertainty(
        node,
        targetExpression,
        "custom-validity",
        env,
      )
    ) return true;

    const literal = literalStaticString(value, env);
    if (literal === null) {
      report(node, "programmatic-participation-dynamic", ["custom-validity"]);
    } else if (literal.length === 0) {
      report(node, "programmatic-participation-validity-clear", ["custom-validity"]);
    }
    return true;
  }

  function domConstraintPropertyForKind(kind, property) {
    const normalized = property?.toLowerCase();
    if (!normalized) return null;

    if (kind === "input") {
      if (
        normalized === "required"
        || normalized === "pattern"
        || normalized === "min"
        || normalized === "max"
        || normalized === "minlength"
        || normalized === "maxlength"
        || normalized === "step"
        || normalized === "type"
      ) return normalized;
    }

    if (kind === "textarea") {
      if (
        normalized === "required"
        || normalized === "minlength"
        || normalized === "maxlength"
      ) return normalized;
    }

    if (kind === "select") {
      if (normalized === "required") return normalized;
    }

    if (kind === "fieldset" && normalized === "disabled") return normalized;
    return null;
  }

  function literalValidationBoolean(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return null;
    if (resolved.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (resolved.kind === ts.SyntaxKind.TrueKeyword) return true;
    return null;
  }

  function reportProgrammaticFormConstraintMutation(
    node,
    kind,
    property,
    value,
    env = new Map(),
    mode = "property",
  ) {
    if (!enforceFormConstraintIntegrityPolicy) return false;
    const constraintProperty = domConstraintPropertyForKind(kind, property);
    if (!constraintProperty) return false;

    const booleanConstraint = (
      constraintProperty === "required"
      || constraintProperty === "disabled"
      || constraintProperty === "readonly"
    );

    if (!booleanConstraint) {
      report(node, "programmatic-constraint-mutation", [constraintProperty]);
      return true;
    }

    if (mode === "set-attribute") {
      if (constraintProperty === "required") return true;
      report(node, "programmatic-constraint-weaken", [constraintProperty]);
      return true;
    }

    if (mode === "remove-attribute") {
      if (constraintProperty === "disabled" || constraintProperty === "readonly") return true;
      report(node, "programmatic-constraint-weaken", [constraintProperty]);
      return true;
    }

    const state = literalValidationBoolean(value, env);
    if (mode === "toggle-attribute") {
      if (state === null) {
        report(node, "programmatic-constraint-dynamic", [constraintProperty]);
        return true;
      }
      const safe = (
        (constraintProperty === "required" && state === true)
        || (
          (constraintProperty === "disabled" || constraintProperty === "readonly")
          && state === false
        )
      );
      if (!safe) report(node, "programmatic-constraint-weaken", [constraintProperty]);
      return true;
    }

    if (state === null) {
      report(node, "programmatic-constraint-dynamic", [constraintProperty]);
      return true;
    }

    const safe = (
      (constraintProperty === "required" && state === true)
      || (
        (constraintProperty === "disabled" || constraintProperty === "readonly")
        && state === false
      )
    );
    if (!safe) report(node, "programmatic-constraint-weaken", [constraintProperty]);
    return true;
  }

  function reportProgrammaticFormValidationBypass(
    node,
    kind,
    property,
    value,
    env = new Map(),
    attributePresence = false,
  ) {
    if (!enforceFormValidationBypassPolicy) return false;
    const validationProperty = domValidationBypassPropertyForKind(kind, property);
    if (!validationProperty) return false;

    if (attributePresence) {
      report(node, "programmatic-validation-bypass", [validationProperty]);
      return true;
    }

    const state = literalValidationBoolean(value, env);
    if (state === false) return true;
    if (state === true) {
      report(node, "programmatic-validation-bypass", [validationProperty]);
    } else {
      report(node, "programmatic-validation-dynamic", [validationProperty]);
    }
    return true;
  }

  function reportProgrammaticFormValidationToggle(
    node,
    kind,
    property,
    force,
    env = new Map(),
  ) {
    if (!enforceFormValidationBypassPolicy) return false;
    const validationProperty = domValidationBypassPropertyForKind(kind, property);
    if (!validationProperty) return false;

    if (!force) {
      report(node, "programmatic-validation-dynamic", [validationProperty]);
      return true;
    }
    return reportProgrammaticFormValidationBypass(
      node,
      kind,
      validationProperty,
      force,
      env,
    );
  }

  function standardAttributeNamespace(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return "dynamic";
    if (resolved.kind === ts.SyntaxKind.NullKeyword) return "standard";
    if (ts.isStringLiteralLike(resolved)) {
      return resolved.text === "" ? "standard" : "namespaced";
    }
    return "dynamic";
  }

  function literalSubmissionTransport(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    return resolved && ts.isStringLiteralLike(resolved)
      ? resolved.text.trim().toLowerCase()
      : null;
  }

  function reportProgrammaticDomSubmissionTransport(
    node,
    kind,
    property,
    value,
    env = new Map(),
  ) {
    if (!enforceFormSubmissionTransportPolicy) return false;
    const normalizedProperty = property?.toLowerCase();
    const transportProperty = (
      normalizedProperty === "method" || normalizedProperty === "enctype"
    )
      ? normalizedProperty
      : domSubmissionTransportPropertyForKind(kind, property);
    if (!transportProperty) return false;

    const literal = literalSubmissionTransport(value, env);
    if (literal === null) {
      report(node, "programmatic-form-transport-dynamic");
      return true;
    }

    if (transportProperty === "method" && literal !== "post") {
      report(node, "programmatic-form-method", [literal]);
      return true;
    }

    if (
      transportProperty === "enctype"
      && literal !== "application/x-www-form-urlencoded"
      && literal !== "multipart/form-data"
    ) {
      report(node, "programmatic-form-enctype", [literal]);
      return true;
    }

    return true;
  }

  function literalTargetContext(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    return resolved && ts.isStringLiteralLike(resolved)
      ? resolved.text.trim().toLowerCase()
      : null;
  }

  function runtimeDomTargetContextSafe(expression, env = new Map()) {
    const target = literalTargetContext(expression, env);
    return target === "" || target === "_self";
  }

  function windowOpenFeaturesProtectOpener(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved || !ts.isStringLiteralLike(resolved)) return false;
    const tokens = resolved.text
      .toLowerCase()
      .split(/[,\s]+/)
      .map((token) => token.trim().split("=", 1)[0])
      .filter(Boolean);
    return tokens.includes("noopener") || tokens.includes("noreferrer");
  }

  function reportProgrammaticDomTarget(
    node,
    kind,
    property,
    value,
    env = new Map(),
  ) {
    if (!enforceProgrammaticTargetContextPolicy) return false;
    const targetProperty = domTargetContextPropertyForKind(kind, property);
    if (!targetProperty) return false;

    const target = literalTargetContext(value, env);
    if (target === null) {
      report(node, "programmatic-target-dynamic");
    } else if (!runtimeDomTargetContextSafe(value, env)) {
      report(node, "programmatic-target-context", [target]);
    }
    return true;
  }

  function reportProgrammaticWindowOpenTarget(
    node,
    args,
    env = new Map(),
  ) {
    if (!enforceProgrammaticTargetContextPolicy) return;
    const targetExpression = args[1];
    const featuresExpression = args[2];

    if (!targetExpression) {
      report(node, "programmatic-target-implicit");
      return;
    }

    const target = literalTargetContext(targetExpression, env);
    if (target === null) {
      report(node, "programmatic-target-dynamic");
      return;
    }

    if (target === "_self") return;

    if (target === "_blank") {
      if (!windowOpenFeaturesProtectOpener(featuresExpression, env)) {
        report(node, "programmatic-target-blank-opener", [target]);
      }
      return;
    }

    report(node, "programmatic-target-context", [target]);
  }

  const VERIFIED_REPLAY_SELECTOR = 'form[data-route-submit-authority="verified-replay"]';

  function isVerifiedReplayFormSource(expression, env = new Map(), seen = new Set()) {
    if (!expression) return false;

    if (ts.isIdentifier(expression) && domVerifiedReplayForms.has(expression.text)) {
      return true;
    }
    if (
      ts.isAsExpression(expression)
      || ts.isTypeAssertionExpression(expression)
      || ts.isNonNullExpression(expression)
    ) {
      return isVerifiedReplayFormSource(expression.expression, env, seen);
    }

    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (resolved !== expression) {
      const key = resolved.pos + ":" + resolved.end;
      if (seen.has(key)) return false;
      const nextSeen = new Set(seen);
      nextSeen.add(key);
      if (isVerifiedReplayFormSource(resolved, env, nextSeen)) return true;
    }

    if (!ts.isCallExpression(resolved)) return false;
    const callee = resolved.expression;
    if (!(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))) {
      return false;
    }
    const method = propertyName(callee);
    if (method !== "closest" && method !== "querySelector") return false;
    const selector = resolveDataExpression(resolved.arguments[0], env);
    return Boolean(
      selector
      && ts.isStringLiteralLike(selector)
      && selector.text === VERIFIED_REPLAY_SELECTOR
    );
  }

  function domActivationMethodForKind(kind, method) {
    if (kind === "form" && (method === "submit" || method === "requestSubmit")) {
      return method;
    }
    if (
      (kind === "a" || kind === "area" || kind === "button" || kind === "input")
      && method === "click"
    ) {
      return method;
    }
    return null;
  }

  function domActivationBinding(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return null;

    if (ts.isIdentifier(resolved) && domActivationMethodBindings.has(resolved.text)) {
      return domActivationMethodBindings.get(resolved.text);
    }

    if (
      ts.isPropertyAccessExpression(resolved)
      || ts.isElementAccessExpression(resolved)
    ) {
      const method = propertyName(resolved);
      const owner = propertyOwner(resolved);
      const ownerKind = domNavigationElementKind(owner, env);
      const activationMethod = domActivationMethodForKind(ownerKind, method);
      if (activationMethod) {
        return {
          kind: ownerKind,
          method: activationMethod,
          verifiedReplay: (
            activationMethod === "requestSubmit"
            && isVerifiedReplayFormSource(owner, env)
          ),
        };
      }

      // requestSubmit is unique to forms. Treat an untyped owner as unresolved
      // form capability instead of allowing it to bypass typed/ref tracking.
      if (method === "requestSubmit") {
        return {
          kind: ownerKind ?? null,
          method,
          unresolved: !ownerKind,
          verifiedReplay: isVerifiedReplayFormSource(owner, env),
        };
      }
    }

    return null;
  }

  function nativeDomActivationInfo(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (
      !resolved
      || !(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
    ) return null;

    const method = propertyName(resolved);
    const owner = propertyOwner(resolved);
    if (!owner) return null;

    const prototypeKind = nativeDomPrototypeKind(owner, env);
    const activationMethod = domActivationMethodForKind(prototypeKind, method);
    if (activationMethod) {
      return { kind: prototypeKind, method: activationMethod, generic: false };
    }

    const ownerText = owner.getText(sourceFile);
    if (
      method === "click"
      && (
        ownerText === "HTMLElement.prototype"
        || ownerText === "globalThis.HTMLElement.prototype"
      )
    ) {
      return { kind: null, method: "click", generic: true };
    }

    return null;
  }

  function syntheticActivationEventName(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved || !ts.isNewExpression(resolved)) return null;
    const constructorText = resolved.expression.getText(sourceFile);
    if (
      constructorText !== "Event"
      && constructorText !== "SubmitEvent"
      && constructorText !== "MouseEvent"
      && constructorText !== "PointerEvent"
    ) return null;

    const eventName = resolveDataExpression(resolved.arguments?.[0], env);
    if (!eventName || !ts.isStringLiteralLike(eventName)) return null;
    const normalized = eventName.text.toLowerCase();
    return normalized === "submit" || normalized === "click" ? normalized : null;
  }

  function syntheticActivationTargetKind(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (
      !resolved
      || !(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      || propertyName(resolved) !== "dispatchEvent"
    ) return null;
    return domNavigationElementKind(propertyOwner(resolved), env);
  }

  function discoverDeclaration(node) {
    if (!ts.isVariableDeclaration(node)) return false;
    let changed = false;
    const initializer = node.initializer;

    if (ts.isIdentifier(node.name)) {
      const local = node.name.text;
      if (isUseRouterCall(initializer)) changed = addBinding(routerVariables, local) || changed;
      if (initializer && ts.isIdentifier(initializer) && routerVariables.has(initializer.text)) {
        changed = addBinding(routerVariables, local) || changed;
      }
      if (initializer) {
        if (isBrowsingContextObject(initializer)) {
          changed = addBinding(browserContextVariables, local) || changed;
        }
        if (isBrowserLocationObject(initializer)) {
          changed = addBinding(browserLocationVariables, local) || changed;
        }
        if (isBrowserHistoryObject(initializer)) {
          changed = addBinding(browserHistoryVariables, local) || changed;
        }
        if (isBrowserNavigationApiObject(initializer)) {
          changed = addBinding(browserNavigationApiVariables, local) || changed;
        }
      }
      if (initializer && ts.isIdentifier(initializer) && browserContextVariables.has(initializer.text)) {
        changed = addBinding(browserContextVariables, local) || changed;
      }
      if (initializer && ts.isIdentifier(initializer) && browserLocationVariables.has(initializer.text)) {
        changed = addBinding(browserLocationVariables, local) || changed;
      }
      if (initializer && ts.isIdentifier(initializer) && browserHistoryVariables.has(initializer.text)) {
        changed = addBinding(browserHistoryVariables, local) || changed;
      }
      if (initializer && ts.isIdentifier(initializer) && browserNavigationApiVariables.has(initializer.text)) {
        changed = addBinding(browserNavigationApiVariables, local) || changed;
      }
      if (initializer && ts.isIdentifier(initializer) && domRefKinds.has(initializer.text)) {
        changed = addKindBinding(domRefKinds, local, domRefKinds.get(initializer.text)) || changed;
      }
      if (initializer && ts.isIdentifier(initializer) && domCollectionKinds.has(initializer.text)) {
        changed = addKindBinding(
          domCollectionKinds,
          local,
          domCollectionKinds.get(initializer.text),
        ) || changed;
      }
      if (isHeadersObject(initializer)) {
        changed = addBinding(headerVariables, local) || changed;
      }

      const refKind = domRefKindFromInitializer(initializer);
      if (refKind && domRefKinds.get(local) !== refKind) {
        domRefKinds.set(local, refKind);
        changed = true;
      }

      const collectionKind = domCollectionElementKind(initializer);
      if (collectionKind && domCollectionKinds.get(local) !== collectionKind) {
        domCollectionKinds.set(local, collectionKind);
        changed = true;
      }

      const domKind = domNavigationElementKind(initializer);
      if (domKind && domNavigationElementKinds.get(local) !== domKind) {
        domNavigationElementKinds.set(local, domKind);
        changed = true;
      }

      if (isVerifiedReplayFormSource(initializer) && !domVerifiedReplayForms.has(local)) {
        domVerifiedReplayForms.add(local);
        changed = true;
      }

      if (initializer && (ts.isPropertyAccessExpression(initializer) || ts.isElementAccessExpression(initializer))) {
        const owner = propertyOwner(initializer);
        const method = propertyName(initializer);
        if (isRouterObject(owner) && (method === "push" || method === "replace")) {
          changed = addBinding(routerMethodBindings, local) || changed;
        }
        if (isRouterObject(owner) && (method === "back" || method === "forward")) {
          changed = addBinding(routerTraversalMethodBindings, local) || changed;
        }
        if (
          owner
          && ts.isIdentifier(owner)
          && nextResponseBindings.has(owner.text)
          && method === "redirect"
        ) {
          changed = addBinding(responseRedirectBindings, local) || changed;
        }
        if (isWebResponseObject(owner) && method === "redirect") {
          changed = addBinding(webResponseRedirectBindings, local) || changed;
        }
        if (isBrowserLocationObject(owner) && (method === "assign" || method === "replace")) {
          changed = addBinding(browserLocationMethodBindings, local) || changed;
        }
        if (isBrowserLocationObject(owner) && method === "reload") {
          changed = addBinding(browserLocationReloadBindings, local) || changed;
        }
        if (isBrowserHistoryObject(owner) && (method === "pushState" || method === "replaceState")) {
          changed = addBinding(browserHistoryMethodBindings, local) || changed;
        }
        if (isBrowserHistoryObject(owner) && (method === "back" || method === "forward" || method === "go")) {
          changed = addBinding(browserHistoryTraversalMethodBindings, local) || changed;
        }
        if (isBrowserNavigationApiObject(owner) && method === "navigate") {
          changed = addBinding(browserNavigationApiMethodBindings, local) || changed;
        }
        if (
          isBrowserNavigationApiObject(owner)
          && (method === "back" || method === "forward" || method === "reload" || method === "traverseTo")
        ) {
          changed = addBinding(browserNavigationTraversalMethodBindings, local) || changed;
        }
        if (isBrowserWindowObject(owner) && method === "open") {
          changed = addBinding(browserWindowOpenBindings, local) || changed;
        }
        if (isHeadersObject(owner) && (method === "set" || method === "append")) {
          changed = addBinding(headerMutationMethodBindings, local) || changed;
        }
        const domOwnerKind = domNavigationElementKind(owner);
        if (domOwnerKind && method === "setAttribute") {
          changed = addKindBinding(domSetAttributeBindings, local, domOwnerKind) || changed;
        }
        if (domOwnerKind && method === "setAttributeNS") {
          changed = addKindBinding(domSetAttributeNSBindings, local, domOwnerKind) || changed;
        }
        if (domOwnerKind && method === "toggleAttribute") {
          changed = addKindBinding(domToggleAttributeBindings, local, domOwnerKind) || changed;
        }
        if (domOwnerKind && method === "removeAttribute") {
          changed = addKindBinding(domRemoveAttributeBindings, local, domOwnerKind) || changed;
        }
        if (domOwnerKind && method === "removeAttributeNS") {
          changed = addKindBinding(domRemoveAttributeNSBindings, local, domOwnerKind) || changed;
        }
        if (domOwnerKind && method === "setCustomValidity") {
          changed = addKindBinding(domSetCustomValidityBindings, local, domOwnerKind) || changed;
        }
        if (
          domOwnerKind
          && ["setAttribute", "setAttributeNS", "toggleAttribute", "removeAttribute", "removeAttributeNS", "setCustomValidity"].includes(method)
        ) {
          changed = setMethodBindingOwner(local, method, owner) || changed;
        }
        const activationMethod = domActivationMethodForKind(domOwnerKind, method);
        if (activationMethod) {
          const existing = domActivationMethodBindings.get(local);
          if (
            !existing
            || existing.kind !== domOwnerKind
            || existing.method !== activationMethod
          ) {
            domActivationMethodBindings.set(local, { kind: domOwnerKind, method: activationMethod });
            changed = true;
          }
        }
      }

      if (initializer && ts.isIdentifier(initializer)) {
        if (routerMethodBindings.has(initializer.text)) {
          changed = addBinding(routerMethodBindings, local) || changed;
        }
        if (routerTraversalMethodBindings.has(initializer.text)) {
          changed = addBinding(routerTraversalMethodBindings, local) || changed;
        }
        if (responseRedirectBindings.has(initializer.text)) {
          changed = addBinding(responseRedirectBindings, local) || changed;
        }
        if (webResponseRedirectBindings.has(initializer.text)) {
          changed = addBinding(webResponseRedirectBindings, local) || changed;
        }
        if (browserLocationMethodBindings.has(initializer.text)) {
          changed = addBinding(browserLocationMethodBindings, local) || changed;
        }
        if (browserLocationReloadBindings.has(initializer.text)) {
          changed = addBinding(browserLocationReloadBindings, local) || changed;
        }
        if (browserHistoryMethodBindings.has(initializer.text)) {
          changed = addBinding(browserHistoryMethodBindings, local) || changed;
        }
        if (browserHistoryTraversalMethodBindings.has(initializer.text)) {
          changed = addBinding(browserHistoryTraversalMethodBindings, local) || changed;
        }
        if (browserNavigationApiMethodBindings.has(initializer.text)) {
          changed = addBinding(browserNavigationApiMethodBindings, local) || changed;
        }
        if (browserNavigationTraversalMethodBindings.has(initializer.text)) {
          changed = addBinding(browserNavigationTraversalMethodBindings, local) || changed;
        }
        if (browserWindowOpenBindings.has(initializer.text)) {
          changed = addBinding(browserWindowOpenBindings, local) || changed;
        }
        if (headerVariables.has(initializer.text)) {
          changed = addBinding(headerVariables, local) || changed;
        }
        if (headerMutationMethodBindings.has(initializer.text)) {
          changed = addBinding(headerMutationMethodBindings, local) || changed;
        }
        if (domSetAttributeBindings.has(initializer.text)) {
          changed = addKindBinding(
            domSetAttributeBindings,
            local,
            domSetAttributeBindings.get(initializer.text),
          ) || changed;
        }
        if (domSetAttributeNSBindings.has(initializer.text)) {
          changed = addKindBinding(
            domSetAttributeNSBindings,
            local,
            domSetAttributeNSBindings.get(initializer.text),
          ) || changed;
        }
        if (domToggleAttributeBindings.has(initializer.text)) {
          changed = addKindBinding(
            domToggleAttributeBindings,
            local,
            domToggleAttributeBindings.get(initializer.text),
          ) || changed;
        }
        if (domRemoveAttributeBindings.has(initializer.text)) {
          changed = addKindBinding(
            domRemoveAttributeBindings,
            local,
            domRemoveAttributeBindings.get(initializer.text),
          ) || changed;
        }
        if (domRemoveAttributeNSBindings.has(initializer.text)) {
          changed = addKindBinding(
            domRemoveAttributeNSBindings,
            local,
            domRemoveAttributeNSBindings.get(initializer.text),
          ) || changed;
        }
        if (domSetCustomValidityBindings.has(initializer.text)) {
          changed = addKindBinding(
            domSetCustomValidityBindings,
            local,
            domSetCustomValidityBindings.get(initializer.text),
          ) || changed;
        }
        if (domMethodBindingOwners.has(initializer.text)) {
          const binding = domMethodBindingOwners.get(initializer.text);
          changed = setMethodBindingOwner(local, binding.method, binding.owner) || changed;
        }
        if (domVerifiedReplayForms.has(initializer.text)) {
          changed = addBinding(domVerifiedReplayForms, local) || changed;
        }
        if (domActivationMethodBindings.has(initializer.text)) {
          const binding = domActivationMethodBindings.get(initializer.text);
          const existing = domActivationMethodBindings.get(local);
          if (
            binding
            && (!existing || existing.kind !== binding.kind || existing.method !== binding.method)
          ) {
            domActivationMethodBindings.set(local, binding);
            changed = true;
          }
        }
      }
    }

    if (ts.isObjectBindingPattern(node.name) && initializer) {
      const fromRouter = isRouterObject(initializer);
      const fromResponse = ts.isIdentifier(initializer) && nextResponseBindings.has(initializer.text);
      const fromWebResponse = isWebResponseObject(initializer);
      const fromLocation = isBrowserLocationObject(initializer);
      const fromHistory = isBrowserHistoryObject(initializer);
      const fromNavigationApi = isBrowserNavigationApiObject(initializer);
      const fromWindow = isBrowserWindowObject(initializer);
      const fromHeaders = isHeadersObject(initializer);
      const fromDomNavigationElement = Boolean(domNavigationElementKind(initializer));

      for (const element of node.name.elements) {
        const sourceName = bindingSourceName(element);
        const localName = bindingLocalName(element);
        if (!sourceName || !localName) continue;
        if (fromRouter && (sourceName === "push" || sourceName === "replace")) {
          changed = addBinding(routerMethodBindings, localName) || changed;
        }
        if (fromRouter && (sourceName === "back" || sourceName === "forward")) {
          changed = addBinding(routerTraversalMethodBindings, localName) || changed;
        }
        if (fromResponse && sourceName === "redirect") {
          changed = addBinding(responseRedirectBindings, localName) || changed;
        }
        if (fromWebResponse && sourceName === "redirect") {
          changed = addBinding(webResponseRedirectBindings, localName) || changed;
        }
        if (fromLocation && (sourceName === "assign" || sourceName === "replace")) {
          changed = addBinding(browserLocationMethodBindings, localName) || changed;
        }
        if (fromLocation && sourceName === "reload") {
          changed = addBinding(browserLocationReloadBindings, localName) || changed;
        }
        if (fromHistory && (sourceName === "pushState" || sourceName === "replaceState")) {
          changed = addBinding(browserHistoryMethodBindings, localName) || changed;
        }
        if (fromHistory && (sourceName === "back" || sourceName === "forward" || sourceName === "go")) {
          changed = addBinding(browserHistoryTraversalMethodBindings, localName) || changed;
        }
        if (fromNavigationApi && sourceName === "navigate") {
          changed = addBinding(browserNavigationApiMethodBindings, localName) || changed;
        }
        if (
          fromNavigationApi
          && (sourceName === "back" || sourceName === "forward" || sourceName === "reload" || sourceName === "traverseTo")
        ) {
          changed = addBinding(browserNavigationTraversalMethodBindings, localName) || changed;
        }
        if (fromWindow && sourceName === "open") {
          changed = addBinding(browserWindowOpenBindings, localName) || changed;
        }
        if (fromHeaders && (sourceName === "set" || sourceName === "append")) {
          changed = addBinding(headerMutationMethodBindings, localName) || changed;
        }
        if (fromDomNavigationElement && sourceName === "setAttribute") {
          changed = addKindBinding(
            domSetAttributeBindings,
            localName,
            domNavigationElementKind(initializer),
          ) || changed;
        }
        if (fromDomNavigationElement && sourceName === "setAttributeNS") {
          changed = addKindBinding(
            domSetAttributeNSBindings,
            localName,
            domNavigationElementKind(initializer),
          ) || changed;
        }
        if (fromDomNavigationElement && sourceName === "toggleAttribute") {
          changed = addKindBinding(
            domToggleAttributeBindings,
            localName,
            domNavigationElementKind(initializer),
          ) || changed;
        }
        if (fromDomNavigationElement && sourceName === "removeAttribute") {
          changed = addKindBinding(
            domRemoveAttributeBindings,
            localName,
            domNavigationElementKind(initializer),
          ) || changed;
        }
        if (fromDomNavigationElement && sourceName === "removeAttributeNS") {
          changed = addKindBinding(
            domRemoveAttributeNSBindings,
            localName,
            domNavigationElementKind(initializer),
          ) || changed;
        }
        if (fromDomNavigationElement && sourceName === "setCustomValidity") {
          changed = addKindBinding(
            domSetCustomValidityBindings,
            localName,
            domNavigationElementKind(initializer),
          ) || changed;
        }
        if (
          fromDomNavigationElement
          && ["setAttribute", "setAttributeNS", "toggleAttribute", "removeAttribute", "removeAttributeNS", "setCustomValidity"].includes(sourceName)
        ) {
          changed = setMethodBindingOwner(localName, sourceName, initializer) || changed;
        }
        if (fromDomNavigationElement) {
          const kind = domNavigationElementKind(initializer);
          const activationMethod = domActivationMethodForKind(kind, sourceName);
          if (activationMethod) {
            const existing = domActivationMethodBindings.get(localName);
            if (
              !existing
              || existing.kind !== kind
              || existing.method !== activationMethod
            ) {
              domActivationMethodBindings.set(localName, { kind, method: activationMethod });
              changed = true;
            }
          }
        }
      }
    }

    return changed;
  }

  for (let pass = 0; pass < declarations.length + 1; pass += 1) {
    let changed = false;
    for (const declaration of declarations) {
      changed = discoverDeclaration(declaration) || changed;
    }
    if (!changed) break;
  }

  function isFormParticipatingControlKind(kind) {
    return ["input", "textarea", "select", "button", "fieldset"].includes(kind);
  }

  function staticJsxString(attribute) {
    const literal = literalJsxAttributeValue(attribute);
    if (literal !== null) return literal;
    if (
      attribute?.initializer
      && ts.isJsxExpression(attribute.initializer)
      && attribute.initializer.expression
    ) {
      const resolved = resolveDataExpression(attribute.initializer.expression);
      return resolved && ts.isStringLiteralLike(resolved) ? resolved.text : null;
    }
    return null;
  }

  function jsxIntrinsicTagName(node) {
    if (!(ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) return null;
    const value = node.tagName.getText(sourceFile);
    return /^[a-z]/.test(value) ? value.toLowerCase() : null;
  }

  function nearestJsxForm(node) {
    let current = node.parent;
    while (current) {
      if (
        ts.isJsxElement(current)
        && current.openingElement.tagName.getText(sourceFile).toLowerCase() === "form"
      ) {
        return current.openingElement;
      }
      current = current.parent;
    }
    return null;
  }

  function jsxFormOwnerIdentity(openingElement) {
    if (!openingElement) return null;
    const id = staticJsxString(jsxAttribute(openingElement, "id"));
    return id
      ? "form-id:" + id
      : "jsx-form:" + openingElement.pos + ":" + openingElement.end;
  }

  function jsxExpressionValue(attribute) {
    if (
      !attribute?.initializer
      || !ts.isJsxExpression(attribute.initializer)
      || !attribute.initializer.expression
    ) return null;
    return attribute.initializer.expression;
  }

  function collectFormOwnershipProvenance() {
    if (!enforceFormOwnershipProvenancePolicy) return;

    function collectFormIds(node) {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
        && jsxIntrinsicTagName(node) === "form"
      ) {
        const id = staticJsxString(jsxAttribute(node, "id"));
        if (id) domFormOwnerIds.add(id);
      }
      ts.forEachChild(node, collectFormIds);
    }
    collectFormIds(sourceFile);

    const handlerOwnership = new Map();
    const handlerKinds = new Map();
    const handlerOwners = new Map();
    const handlerAssociationModes = new Map();

    function recordHandler(
      attribute,
      associated,
      kind,
      owner = null,
      associationMode = null,
    ) {
      const expression = jsxExpressionValue(attribute);
      if (!expression) return;

      if (ts.isIdentifier(expression)) {
        setStableOwnership(handlerOwnership, expression.text, associated);
        if (kind) setStableKind(handlerKinds, expression.text, kind);
        if (associated && owner) setStableOwner(handlerOwners, expression.text, owner);
        if (associated && associationMode) {
          setStableAssociationMode(
            handlerAssociationModes,
            expression.text,
            associationMode,
          );
        }
        return;
      }

      if (
        (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression))
        && expression.parameters.length > 0
        && ts.isIdentifier(expression.parameters[0].name)
      ) {
        const parameterName = expression.parameters[0].name.text;
        setScopedEventEvidence(
          expression,
          parameterName,
          associated,
          kind,
          associated ? owner : null,
          associated ? associationMode : null,
        );
      }
    }

    function collectOwnership(node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = jsxIntrinsicTagName(node);
        const control = isFormParticipatingControlKind(tag);
        const explicitFormId = control ? staticJsxString(jsxAttribute(node, "form")) : null;
        const nestedForm = control ? nearestJsxForm(node) : null;
        const explicitOwner = (
          explicitFormId && domFormOwnerIds.has(explicitFormId)
            ? "form-id:" + explicitFormId
            : null
        );
        const nestedOwner = nestedForm ? jsxFormOwnerIdentity(nestedForm) : null;
        const owner = explicitOwner ?? nestedOwner;
        const associationMode = explicitOwner
          ? "explicit"
          : nestedOwner
            ? "ancestor"
            : null;
        const associated = Boolean(control && owner);

        if (control) {
          const id = staticJsxString(jsxAttribute(node, "id"));
          if (id) {
            setStableOwnership(domFormOwnedElementIds, id, associated);
            setStableKind(domFormOwnedElementKinds, id, tag);
            if (associated && owner) setStableOwner(domFormOwnedElementOwners, id, owner);
            if (associated && associationMode) {
              setStableAssociationMode(
                domFormOwnedElementAssociationModes,
                id,
                associationMode,
              );
            }
          }

          const refExpression = jsxExpressionValue(jsxAttribute(node, "ref"));
          if (refExpression && ts.isIdentifier(refExpression)) {
            setStableOwnership(domFormOwnedRefs, refExpression.text, associated);
            if (associated && owner) {
              setStableOwner(domFormOwnedRefOwners, refExpression.text, owner);
            }
            if (associated && associationMode) {
              setStableAssociationMode(
                domFormOwnedRefAssociationModes,
                refExpression.text,
                associationMode,
              );
            }
          }
        }

        for (const property of node.attributes.properties) {
          if (!ts.isJsxAttribute(property)) continue;
          const name = property.name.getText(sourceFile);
          if (!/^on[A-Z]/.test(name)) continue;
          recordHandler(
            property,
            associated,
            control ? tag : null,
            associated ? owner : null,
            associated ? associationMode : null,
          );
        }
      }
      ts.forEachChild(node, collectOwnership);
    }
    collectOwnership(sourceFile);

    function invalidateManualHandlerCalls(node) {
      if (
        ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && handlerOwnership.has(node.expression.text)
      ) {
        setStableOwnership(handlerOwnership, node.expression.text, false);
      }

      if (
        ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
        && propertyName(node.left) === "current"
        && ts.isIdentifier(propertyOwner(node.left))
        && domFormOwnedRefs.has(propertyOwner(node.left).text)
      ) {
        const refName = propertyOwner(node.left).text;
        setStableOwnership(domFormOwnedRefs, refName, false);
        domFormOwnedRefOwners.set(refName, null);
        domFormOwnedRefAssociationModes.set(refName, "unknown");
      }

      ts.forEachChild(node, invalidateManualHandlerCalls);
    }
    invalidateManualHandlerCalls(sourceFile);

    for (const [handlerName, owned] of handlerOwnership) {
      if (typeof owned !== "boolean") continue;
      const definition = localFunctions.get(handlerName);
      const parameter = definition?.parameters?.[0];
      if (!definition?.node || !parameter || !ts.isIdentifier(parameter.name)) continue;
      setScopedEventEvidence(
        definition.node,
        parameter.name.text,
        owned,
        handlerKinds.get(handlerName) ?? null,
        owned ? (handlerOwners.get(handlerName) ?? null) : null,
        owned ? (handlerAssociationModes.get(handlerName) ?? null) : null,
      );
    }
  }

  collectFormOwnershipProvenance();

  if (enforceFormOwnershipProvenancePolicy) {
    for (let pass = 0; pass < declarations.length + 1; pass += 1) {
      let changed = false;
      for (const declaration of declarations) {
        changed = discoverDeclaration(declaration) || changed;
      }
      if (!changed) break;
    }
  }

  function isFormElementsExpression(expression, env = new Map()) {
    if (!expression) return false;
    const resolved = resolveDataExpression(expression, env);
    if (
      !resolved
      || !(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      || propertyName(resolved) !== "elements"
    ) return false;
    return domNavigationElementKind(propertyOwner(resolved), env) === "form";
  }

  function formElementsOwnerIdentity(expression, env = new Map()) {
    if (!expression) return null;
    const resolved = resolveDataExpression(expression, env);
    if (
      !resolved
      || !(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      || propertyName(resolved) !== "elements"
    ) return null;
    return formOwnerIdentity(propertyOwner(resolved), env);
  }

  function programmaticFormControlCreationKind(expression, env = new Map()) {
    if (!enforceProgrammaticFormOwnershipStatePolicy || !expression) return null;
    const resolved = resolveDataExpression(expression, env);
    if (!resolved || !ts.isCallExpression(resolved)) return null;
    const callee = resolved.expression;
    if (!(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))) {
      return null;
    }
    if (
      propertyName(callee) !== "createElement"
      || !isDocumentObject(propertyOwner(callee), env)
    ) return null;
    const tag = resolveDataExpression(resolved.arguments[0], env);
    if (!tag || !ts.isStringLiteralLike(tag)) return null;
    const kind = tag.text.toLowerCase();
    return isFormParticipatingControlKind(kind) ? kind : null;
  }

  function programmaticOwnershipIdentity(expression, env = new Map(), seen = new Set()) {
    if (!enforceProgrammaticFormOwnershipStatePolicy || !expression) return null;

    if (
      ts.isAsExpression(expression)
      || ts.isTypeAssertionExpression(expression)
      || ts.isNonNullExpression(expression)
      || ts.isParenthesizedExpression(expression)
    ) {
      return programmaticOwnershipIdentity(expression.expression, env, seen);
    }

    if (!ts.isIdentifier(expression)) return null;

    const envKey = "programmatic-state-env:" + expression.text;
    if (env.has(expression.text) && !seen.has(envKey)) {
      const nextSeen = new Set(seen);
      nextSeen.add(envKey);
      const fromEnv = programmaticOwnershipIdentity(
        env.get(expression.text),
        env,
        nextSeen,
      );
      if (fromEnv) return fromEnv;
    }

    const bindingKey = programmaticReferenceBindingKey(expression);
    if (!bindingKey || programmaticOwnershipBindingCounts.get(bindingKey) !== 1) {
      return null;
    }
    return programmaticOwnershipBindingIdentities.get(bindingKey) ?? null;
  }

  function programmaticOwnershipStateInfo(expression, env = new Map()) {
    const identity = programmaticOwnershipIdentity(expression, env);
    if (
      enforceProgrammaticFormOwnershipExecutionScopePolicy
      && !programmaticOwnershipExecutionActive()
      && (
        identity
        || Boolean(programmaticFormControlCreationKind(expression, env))
      )
    ) {
      return {
        known: true,
        identity: identity ?? null,
        owned: false,
        owner: null,
        associationMode: "execution-suppressed",
        uncertain: false,
        executionSuppressed: true,
      };
    }
    if (!identity || !programmaticOwnershipStates.has(identity)) {
      return {
        known: false,
        identity: null,
        owned: false,
        owner: null,
        associationMode: null,
      };
    }
    const state = programmaticOwnershipStates.get(identity);
    return {
      known: true,
      identity,
      owned: state.owned === true,
      owner: state.owner ?? null,
      associationMode: state.associationMode ?? "programmatic",
      uncertain: state.uncertain === true,
    };
  }

  function setProgrammaticOwnershipState(identity, state) {
    if (
      !identity
      || !enforceProgrammaticFormOwnershipStatePolicy
      || !programmaticOwnershipExecutionActive()
    ) return false;
    programmaticOwnershipStates.set(identity, {
      owned: state.owned === true,
      owner: state.owner ?? null,
      associationMode: state.associationMode ?? "programmatic",
      uncertain: state.uncertain === true,
    });
    return true;
  }

  function cloneProgrammaticOwnershipStates() {
    return new Map(
      [...programmaticOwnershipStates.entries()]
        .map(([identity, state]) => [identity, { ...state }]),
    );
  }

  function restoreProgrammaticOwnershipStates(snapshot) {
    programmaticOwnershipStates.clear();
    for (const [identity, state] of snapshot) {
      programmaticOwnershipStates.set(identity, { ...state });
    }
  }

  function programmaticOwnershipStateEquivalent(left, right) {
    if (!left || !right) return false;
    return (
      (left.owned === true) === (right.owned === true)
      && (left.owner ?? null) === (right.owner ?? null)
      && (left.associationMode ?? "programmatic")
        === (right.associationMode ?? "programmatic")
      && (left.uncertain === true) === (right.uncertain === true)
    );
  }

  function mergeProgrammaticOwnershipStateSnapshots(snapshots) {
    if (
      !enforceProgrammaticFormOwnershipControlFlowPolicy
      || snapshots.length === 0
    ) return false;

    const identities = new Set(
      snapshots.flatMap((snapshot) => [...snapshot.keys()]),
    );
    programmaticOwnershipStates.clear();

    for (const identity of identities) {
      const states = snapshots.map((snapshot) => snapshot.get(identity) ?? null);
      const present = states.filter(Boolean);

      if (
        present.length === states.length
        && present.every((state) => programmaticOwnershipStateEquivalent(state, present[0]))
      ) {
        programmaticOwnershipStates.set(identity, { ...present[0] });
        continue;
      }

      const ownedStates = present.filter((state) => state.owned === true);
      if (ownedStates.length === 0) {
        programmaticOwnershipStates.set(identity, {
          owned: false,
          owner: null,
          associationMode: "programmatic",
          uncertain: false,
        });
        continue;
      }

      const commonOwner = (
        ownedStates.length === states.length
        && ownedStates.every(
          (state) => (state.owner ?? null) === (ownedStates[0].owner ?? null),
        )
      )
        ? (ownedStates[0].owner ?? null)
        : null;

      programmaticOwnershipStates.set(identity, {
        owned: true,
        owner: commonOwner,
        associationMode: "control-flow",
        uncertain: true,
      });
    }
    return true;
  }

  function markProgrammaticOwnershipStatesScheduled() {
    if (!enforceProgrammaticFormOwnershipCallbackSchedulingPolicy) return false;
    for (const [identity, state] of programmaticOwnershipStates) {
      programmaticOwnershipStates.set(identity, {
        ...state,
        owned: true,
        owner: null,
        associationMode: "scheduled",
        uncertain: true,
      });
    }
    return true;
  }

  function reportProgrammaticOwnershipSchedulingUncertainty(
    node,
    targetExpression,
    operation,
    env = new Map(),
  ) {
    if (
      !enforceProgrammaticFormOwnershipCallbackSchedulingPolicy
      || programmaticOwnershipScheduledCallbackDepth === 0
    ) return false;
    const state = programmaticOwnershipStateInfo(targetExpression, env);
    if (!state.known || state.uncertain !== true || state.owned !== true) {
      return false;
    }
    const multiplicity = (
      programmaticOwnershipScheduledMultiplicity[
        programmaticOwnershipScheduledMultiplicity.length - 1
      ] ?? "one-shot"
    );
    const teardown = (
      programmaticOwnershipScheduledTeardown[
        programmaticOwnershipScheduledTeardown.length - 1
      ] ?? null
    );
    report(
      node,
      enforceProgrammaticFormOwnershipCallbackTeardownLoopPolicy
        && teardown === "loop-partial"
        ? "programmatic-ownership-scheduled-teardown-loop-dynamic"
        : enforceProgrammaticFormOwnershipCallbackTeardownControlFlowPolicy
          && teardown === "partial"
          ? "programmatic-ownership-scheduled-teardown-path-dynamic"
          : enforceProgrammaticFormOwnershipCallbackTeardownPathPolicy
            && teardown === "bounded"
            ? "programmatic-ownership-scheduled-bounded-dynamic"
            : multiplicity === "repeat"
              ? "programmatic-ownership-scheduled-repeat-dynamic"
              : "programmatic-ownership-scheduled-dynamic",
      operation ? [operation] : [],
    );
    return true;
  }

  function reportProgrammaticOwnershipControlFlowUncertainty(
    node,
    targetExpression,
    operation,
    env = new Map(),
  ) {
    if (
      !enforceProgrammaticFormOwnershipControlFlowPolicy
      || programmaticOwnershipScheduledCallbackDepth > 0
    ) return false;
    const state = programmaticOwnershipStateInfo(targetExpression, env);
    if (!state.known || state.uncertain !== true || state.owned !== true) {
      return false;
    }
    report(
      node,
      "programmatic-ownership-control-flow-dynamic",
      operation ? [operation] : [],
    );
    return true;
  }

  function registerProgrammaticOwnershipDeclaration(node, env = new Map()) {
    if (
      !enforceProgrammaticFormOwnershipStatePolicy
      || !programmaticOwnershipExecutionActive()
      || !ts.isVariableDeclaration(node)
      || !ts.isIdentifier(node.name)
      || !node.initializer
      || !programmaticBindingIsUnambiguous(node.name)
    ) return false;

    const bindingKey = programmaticBindingKey(node.name);
    if (!bindingKey || programmaticOwnershipBindingIdentities.has(bindingKey)) {
      return false;
    }

    const aliasIdentity = programmaticOwnershipIdentity(node.initializer, env);
    if (aliasIdentity) {
      programmaticOwnershipBindingIdentities.set(bindingKey, aliasIdentity);
      return true;
    }

    const kind = programmaticFormControlCreationKind(node.initializer, env);
    if (!kind) return false;

    const identity = "programmatic-control:" + node.pos + ":" + node.end;
    programmaticOwnershipBindingIdentities.set(bindingKey, identity);
    programmaticOwnershipKinds.set(identity, kind);
    setProgrammaticOwnershipState(identity, {
      owned: false,
      owner: null,
      associationMode: "programmatic",
    });
    return true;
  }

  function currentFormOwnershipInfo(expression, env = new Map(), seen = new Set()) {
    if (!expression || !enforceFormOwnershipLifecyclePolicy) {
      return { owned: false, owner: null, associationMode: null };
    }

    if (
      ts.isAsExpression(expression)
      || ts.isTypeAssertionExpression(expression)
      || ts.isNonNullExpression(expression)
      || ts.isParenthesizedExpression(expression)
    ) {
      return currentFormOwnershipInfo(expression.expression, env, seen);
    }

    const programmaticState = programmaticOwnershipStateInfo(expression, env);
    if (programmaticState.known) {
      return {
        owned: programmaticState.owned,
        owner: programmaticState.owner,
        associationMode: programmaticState.associationMode,
        uncertain: programmaticState.uncertain === true,
      };
    }

    if (
      (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))
      && propertyName(expression) === "current"
      && ts.isIdentifier(propertyOwner(expression))
    ) {
      const refName = propertyOwner(expression).text;
      if (domFormOwnedRefs.get(refName) === true) {
        return {
          owned: true,
          owner: domFormOwnedRefOwners.get(refName) ?? null,
          associationMode: domFormOwnedRefAssociationModes.get(refName) ?? "unknown",
        };
      }
    }

    const scopedEvent = scopedEventTargetInfo(expression);
    if (scopedEvent?.owned === true) {
      return {
        owned: true,
        owner: scopedEvent.owner ?? null,
        associationMode: scopedEvent.associationMode ?? "unknown",
      };
    }

    const resolved = resolveDataExpression(expression, env, seen);
    if (!resolved) return { owned: false, owner: null, associationMode: null };
    if (resolved !== expression) {
      return currentFormOwnershipInfo(resolved, env, seen);
    }

    if (
      ts.isIdentifier(resolved)
      && domFormLifecycleOwnedControls.has(resolved.text)
    ) {
      return {
        owned: true,
        owner: domFormLifecycleControlOwners.get(resolved.text) ?? null,
        associationMode: (
          domFormLifecycleControlAssociationModes.get(resolved.text) ?? "unknown"
        ),
      };
    }

    const lookup = domFormOwnedLookupInfo(resolved, env);
    if (lookup?.owned === true) {
      return {
        owned: true,
        owner: lookup.owner ?? null,
        associationMode: lookup.associationMode ?? "unknown",
      };
    }

    if (ts.isElementAccessExpression(resolved)) {
      const owner = formElementsOwnerIdentity(resolved.expression, env);
      if (owner) return { owned: true, owner, associationMode: "unknown" };
    }

    if (!ts.isCallExpression(resolved)) {
      return { owned: false, owner: null, associationMode: null };
    }
    const callee = resolved.expression;
    if (!(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))) {
      return { owned: false, owner: null, associationMode: null };
    }
    const method = propertyName(callee);
    if (method !== "item" && method !== "namedItem") {
      return { owned: false, owner: null, associationMode: null };
    }
    const owner = formElementsOwnerIdentity(propertyOwner(callee), env);
    return owner
      ? { owned: true, owner, associationMode: "unknown" }
      : { owned: false, owner: null, associationMode: null };
  }

  function isCurrentFormOwnershipProof(expression, env = new Map(), seen = new Set()) {
    return currentFormOwnershipInfo(expression, env, seen).owned === true;
  }

  function discoverFormLifecycleOwnedControls(node) {
    let changed = false;
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && isFormParticipatingControlKind(domNavigationElementKind(node.name))
      && isCurrentFormOwnershipProof(node.initializer)
    ) {
      const info = currentFormOwnershipInfo(node.initializer);
      changed = addBinding(domFormLifecycleOwnedControls, node.name.text) || changed;
      if (info.owner) {
        setStableOwner(domFormLifecycleControlOwners, node.name.text, info.owner);
      }
      if (info.associationMode) {
        setStableAssociationMode(
          domFormLifecycleControlAssociationModes,
          node.name.text,
          info.associationMode,
        );
      }
    }

    ts.forEachChild(node, (child) => {
      changed = discoverFormLifecycleOwnedControls(child) || changed;
    });
    return changed;
  }

  if (enforceFormOwnershipLifecyclePolicy) {
    for (let pass = 0; pass < declarations.length + 2; pass += 1) {
      const changed = discoverFormLifecycleOwnedControls(sourceFile);
      if (!changed) break;
    }
  }

  function isProvenFormAssociatedControl(expression, env = new Map(), seen = new Set()) {
    if (!expression) return false;
    const programmaticState = programmaticOwnershipStateInfo(expression, env);
    if (programmaticState.known) return programmaticState.owned;
    if (ts.isIdentifier(expression) && domFormAssociatedControls.has(expression.text)) return true;

    if (
      ts.isAsExpression(expression)
      || ts.isTypeAssertionExpression(expression)
      || ts.isNonNullExpression(expression)
      || ts.isParenthesizedExpression(expression)
    ) {
      return isProvenFormAssociatedControl(expression.expression, env, seen);
    }

    if (
      enforceFormOwnershipProvenancePolicy
      && (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))
      && propertyName(expression) === "current"
      && ts.isIdentifier(propertyOwner(expression))
      && domFormOwnedRefs.get(propertyOwner(expression).text) === true
    ) {
      return true;
    }

    if (
      enforceFormOwnershipProvenancePolicy
      && scopedEventTargetInfo(expression)?.owned === true
    ) {
      return true;
    }

    const resolved = resolveDataExpression(expression, env, seen);
    if (!resolved) return false;
    if (resolved !== expression) return isProvenFormAssociatedControl(resolved, env, seen);
    if (ts.isIdentifier(resolved)) return domFormAssociatedControls.has(resolved.text);

    if (
      enforceFormOwnershipProvenancePolicy
      && domFormOwnedLookupInfo(resolved, env)?.owned === true
    ) {
      return true;
    }

    if (ts.isElementAccessExpression(resolved)) {
      return isFormElementsExpression(resolved.expression, env);
    }

    if (!ts.isCallExpression(resolved)) return false;
    const callee = resolved.expression;
    if (!(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))) return false;
    const method = propertyName(callee);
    return (
      (method === "item" || method === "namedItem")
      && isFormElementsExpression(propertyOwner(callee), env)
    );
  }

  function markFormAssociatedExpression(expression, env = new Map()) {
    if (!expression) return false;
    let target = expression;
    while (
      target
      && (
        ts.isAsExpression(target)
        || ts.isTypeAssertionExpression(target)
        || ts.isNonNullExpression(target)
        || ts.isParenthesizedExpression(target)
      )
    ) target = target.expression;
    if (!ts.isIdentifier(target)) return false;
    if (!isFormParticipatingControlKind(domNavigationElementKind(target, env))) return false;
    return addBinding(domFormAssociatedControls, target.text);
  }

  function discoverFormControlAssociations(node) {
    let changed = false;

    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && isFormParticipatingControlKind(domNavigationElementKind(node.name))
      && isProvenFormAssociatedControl(node.initializer)
    ) {
      changed = addBinding(domFormAssociatedControls, node.name.text) || changed;
    }

    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) {
        const method = propertyName(callee);
        const owner = propertyOwner(callee);
        if (
          domNavigationElementKind(owner) === "form"
          && ["append", "appendChild", "prepend", "insertBefore", "replaceChildren"].includes(method)
        ) {
          for (const argument of node.arguments) {
            changed = markFormAssociatedExpression(argument) || changed;
          }
        }
      }
    }

    ts.forEachChild(node, (child) => {
      changed = discoverFormControlAssociations(child) || changed;
    });
    return changed;
  }

  for (let pass = 0; pass < declarations.length + 2; pass += 1) {
    const changed = discoverFormControlAssociations(sourceFile);
    if (!changed) break;
  }

  function localFunctionFromCallee(callee, env = new Map(), seen = new Set()) {
    if (!callee) return null;
    if (ts.isParenthesizedExpression(callee)) {
      return localFunctionFromCallee(callee.expression, env, seen);
    }
    if (ts.isIdentifier(callee)) {
      const envKey = "envfn:" + callee.text;
      if (env.has(callee.text) && !seen.has(envKey)) {
        const nextSeen = new Set(seen);
        nextSeen.add(envKey);
        return localFunctionFromCallee(env.get(callee.text), env, nextSeen);
      }
      if (localFunctions.has(callee.text)) return localFunctions.get(callee.text);
      const constKey = "constfn:" + callee.text;
      if (constInitializers.has(callee.text) && !seen.has(constKey)) {
        const nextSeen = new Set(seen);
        nextSeen.add(constKey);
        return localFunctionFromCallee(constInitializers.get(callee.text), env, nextSeen);
      }
    }
    if (ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)) {
      for (const definition of localFunctions.values()) {
        if (definition?.node === callee) return definition;
      }
      return {
        key: "inline-function@" + callee.pos,
        name: callee.name?.text ?? null,
        node: callee,
        parameters: callee.parameters ?? [],
        body: callee.body,
      };
    }
    return null;
  }

  function functionReturnExpressions(definition) {
    if (!definition?.body) return [];
    if (!ts.isBlock(definition.body)) return [definition.body];
    const returns = [];
    function collect(node) {
      if (node !== definition.body && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression) {
        returns.push(node.expression);
        return;
      }
      ts.forEachChild(node, collect);
    }
    collect(definition.body);
    return returns;
  }

  function functionEnvironment(definition, callExpression, parentEnv) {
    const env = new Map();
    for (let index = 0; index < definition.parameters.length; index += 1) {
      const parameter = definition.parameters[index];
      if (!ts.isIdentifier(parameter.name)) continue;
      const argument = callExpression.arguments[index];
      if (!argument) continue;
      env.set(parameter.name.text, resolveDataExpression(argument, parentEnv));
    }
    return env;
  }

  function isGlobalCallbackSchedulerReference(expression, name, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved)) return resolved.text === name;
    if (!(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))) {
      return false;
    }
    if (propertyName(resolved) !== name) return false;
    const ownerText = propertyOwner(resolved)?.getText(sourceFile);
    return ownerText === "window" || ownerText === "globalThis";
  }

  function isPromiseSchedulingOwner(expression, env = new Map(), seen = new Set()) {
    if (!expression) return false;
    const resolved = resolveDataExpression(expression, env, seen);
    if (!resolved) return false;

    if (ts.isNewExpression(resolved)) {
      const constructor = resolveDataExpression(resolved.expression, env);
      return Boolean(
        constructor
        && ts.isIdentifier(constructor)
        && constructor.text === "Promise"
      );
    }

    if (!ts.isCallExpression(resolved)) return false;
    const callee = resolveDataExpression(resolved.expression, env);
    if (!(callee && (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)))) {
      return false;
    }

    const method = propertyName(callee);
    const owner = propertyOwner(callee);
    const ownerText = owner?.getText(sourceFile);
    if (
      ownerText === "Promise"
      || ownerText === "globalThis.Promise"
    ) {
      return ["resolve", "reject", "all", "allSettled", "race", "any"].includes(method);
    }

    if (
      ["then", "catch", "finally"].includes(method)
      && owner
    ) {
      const key = owner.pos + ":" + owner.end;
      if (seen.has(key)) return false;
      const nextSeen = new Set(seen);
      nextSeen.add(key);
      return isPromiseSchedulingOwner(owner, env, nextSeen);
    }

    return false;
  }

  function eventListenerOptionsInfo(expression, env = new Map()) {
    if (!expression) {
      return { capture: false, once: false, signalController: null };
    }
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) {
      return { capture: null, once: null, signalController: null };
    }

    if (
      resolved.kind === ts.SyntaxKind.TrueKeyword
      || resolved.kind === ts.SyntaxKind.FalseKeyword
    ) {
      return {
        capture: resolved.kind === ts.SyntaxKind.TrueKeyword,
        once: false,
        signalController: null,
      };
    }

    if (!ts.isObjectLiteralExpression(resolved)) {
      return { capture: null, once: null, signalController: null };
    }

    const captureExpression = propertyAssignmentByName(resolved, "capture");
    const onceExpression = propertyAssignmentByName(resolved, "once");
    const signalExpression = resolveDataExpression(
      propertyAssignmentByName(resolved, "signal"),
      env,
    );

    const capture = captureExpression
      ? literalValidationBoolean(captureExpression, env)
      : false;
    const once = onceExpression
      ? literalValidationBoolean(onceExpression, env)
      : false;

    let signalController = null;
    if (
      signalExpression
      && (
        ts.isPropertyAccessExpression(signalExpression)
        || ts.isElementAccessExpression(signalExpression)
      )
      && propertyName(signalExpression) === "signal"
      && ts.isIdentifier(propertyOwner(signalExpression))
    ) {
      signalController = propertyOwner(signalExpression).text;
    }

    return { capture, once, signalController };
  }

  function eventListenerCallInfo(callExpression, env = new Map()) {
    if (!ts.isCallExpression(callExpression)) return null;
    const callee = resolveDataExpression(callExpression.expression, env);
    if (
      !callee
      || !(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))
    ) return null;

    const method = propertyName(callee);
    if (method !== "addEventListener" && method !== "removeEventListener") {
      return null;
    }

    const eventType = resolveDataExpression(callExpression.arguments[0], env);
    const callback = callExpression.arguments[1];
    if (!eventType || !ts.isStringLiteralLike(eventType) || !callback) return null;

    const options = eventListenerOptionsInfo(callExpression.arguments[2], env);
    return {
      method,
      targetText: propertyOwner(callee)?.getText(sourceFile) ?? null,
      eventType: eventType.text,
      callbackText: callback.getText(sourceFile),
      capture: options.capture,
      once: options.once,
      signalController: options.signalController,
    };
  }

  function scheduledHandleCallKind(callExpression, env = new Map()) {
    if (!callExpression || !ts.isCallExpression(callExpression)) return null;
    const timerKind = dynamicCodeTimerKind(callExpression.expression, env);
    if (timerKind === "setTimeout" || timerKind === "setInterval") return timerKind;

    if (!enforceProgrammaticFormOwnershipCallbackTeardownPathPolicy) return null;
    for (const name of ["requestAnimationFrame", "requestIdleCallback"]) {
      if (isGlobalCallbackSchedulerReference(callExpression.expression, name, env)) {
        return name;
      }
    }
    return null;
  }

  function timerScheduledDeclarationInfo(statement, env = new Map()) {
    if (
      !ts.isVariableStatement(statement)
      || statement.declarationList.declarations.length !== 1
    ) return null;
    const declaration = statement.declarationList.declarations[0];
    if (
      !ts.isIdentifier(declaration.name)
      || !declaration.initializer
      || !ts.isCallExpression(declaration.initializer)
    ) return null;

    const kind = scheduledHandleCallKind(declaration.initializer, env);
    if (!kind) return null;
    return {
      handle: declaration.name.text,
      kind,
      call: declaration.initializer,
    };
  }

  function directCallStatement(statement) {
    return (
      ts.isExpressionStatement(statement)
      && ts.isCallExpression(statement.expression)
    )
      ? statement.expression
      : null;
  }

  function isTimerCancellationFor(callExpression, timerInfo, env = new Map()) {
    if (!callExpression || !timerInfo) return false;
    const callee = resolveDataExpression(callExpression.expression, env);
    const required = timerInfo.kind === "setInterval" ? "clearInterval" : "clearTimeout";
    if (!isGlobalCallbackSchedulerReference(callee, required, env)) return false;
    const handle = callExpression.arguments[0];
    return Boolean(
      handle
      && ts.isIdentifier(handle)
      && handle.text === timerInfo.handle
    );
  }

  function directIdentifierAlias(statement) {
    if (
      !ts.isVariableStatement(statement)
      || statement.declarationList.declarations.length !== 1
    ) return null;
    const declaration = statement.declarationList.declarations[0];
    if (
      !ts.isIdentifier(declaration.name)
      || !declaration.initializer
      || !ts.isIdentifier(declaration.initializer)
    ) return null;
    return {
      local: declaration.name.text,
      source: declaration.initializer.text,
    };
  }

  function resolveScheduledAlias(name, aliases) {
    let current = name;
    const seen = new Set();
    while (aliases.has(current) && !seen.has(current)) {
      seen.add(current);
      current = aliases.get(current);
    }
    return current;
  }

  function scheduledCancellationName(kind) {
    if (kind === "setTimeout") return "clearTimeout";
    if (kind === "setInterval") return "clearInterval";
    if (kind === "requestAnimationFrame") return "cancelAnimationFrame";
    if (kind === "requestIdleCallback") return "cancelIdleCallback";
    return null;
  }

  function isScheduledHandleCancellationFor(
    callExpression,
    scheduledInfo,
    aliases = new Map(),
    env = new Map(),
  ) {
    if (!callExpression || !scheduledInfo) return false;
    const cancellation = scheduledCancellationName(scheduledInfo.kind);
    if (!cancellation) return false;
    const callee = resolveDataExpression(callExpression.expression, env);
    if (!isGlobalCallbackSchedulerReference(callee, cancellation, env)) return false;
    const handle = callExpression.arguments[0];
    return Boolean(
      handle
      && ts.isIdentifier(handle)
      && resolveScheduledAlias(handle.text, aliases) === scheduledInfo.handle
    );
  }

  function eventListenerRemovalMatches(addInfo, removeInfo) {
    if (!addInfo || !removeInfo) return false;
    if (addInfo.method !== "addEventListener" || removeInfo.method !== "removeEventListener") {
      return false;
    }
    if (
      addInfo.capture === null
      || removeInfo.capture === null
    ) return false;
    return (
      addInfo.targetText === removeInfo.targetText
      && addInfo.eventType === removeInfo.eventType
      && addInfo.callbackText === removeInfo.callbackText
      && addInfo.capture === removeInfo.capture
    );
  }

  function isAbortCallForController(callExpression, controllerName, env = new Map()) {
    if (!callExpression || !controllerName) return false;
    const callee = resolveDataExpression(callExpression.expression, env);
    if (
      !callee
      || !(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))
      || propertyName(callee) !== "abort"
    ) return false;
    const owner = propertyOwner(callee);
    return Boolean(ts.isIdentifier(owner) && owner.text === controllerName);
  }

  function isKnownTeardownOnlyCall(callExpression, env = new Map()) {
    if (!callExpression || !ts.isCallExpression(callExpression)) return false;
    const callee = resolveDataExpression(callExpression.expression, env);
    for (const name of [
      "clearTimeout",
      "clearInterval",
      "cancelAnimationFrame",
      "cancelIdleCallback",
    ]) {
      if (isGlobalCallbackSchedulerReference(callee, name, env)) return true;
    }
    if (
      callee
      && (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))
    ) {
      const method = propertyName(callee);
      return method === "removeEventListener" || method === "abort";
    }
    return false;
  }

  function teardownFlowClassify(statuses) {
    if (!statuses.length) return "none";
    if (statuses.every((status) => status === true)) return "guaranteed";
    if (statuses.some((status) => status === true)) return "partial";
    return "none";
  }

  function teardownFlowTransferMapMerge(...maps) {
    const merged = new Map();
    for (const map of maps) {
      if (!(map instanceof Map)) continue;
      for (const [label, statuses] of map) {
        const existing = merged.get(label) ?? [];
        existing.push(...statuses);
        merged.set(label, existing);
      }
    }
    return merged;
  }

  function teardownFlowTransferMapWithout(map, labels) {
    const removed = [];
    const remaining = new Map();
    const consumed = new Set(labels);
    if (!(map instanceof Map)) return { removed, remaining };
    for (const [label, statuses] of map) {
      if (consumed.has(label)) {
        removed.push(...statuses);
      } else {
        remaining.set(label, [...statuses]);
      }
    }
    return { removed, remaining };
  }

  function teardownFlowMerge(...results) {
    return {
      continuing: results.flatMap((result) => result.continuing ?? []),
      exits: results.flatMap((result) => result.exits ?? []),
      breaks: results.flatMap((result) => result.breaks ?? []),
      continues: results.flatMap((result) => result.continues ?? []),
      labeledBreaks: teardownFlowTransferMapMerge(
        ...results.map((result) => result.labeledBreaks),
      ),
      labeledContinues: teardownFlowTransferMapMerge(
        ...results.map((result) => result.labeledContinues),
      ),
      loopUncertainty: results.some((result) => result.loopUncertainty === true),
    };
  }

  function teardownFlowEmptyResult() {
    return {
      continuing: [],
      exits: [],
      breaks: [],
      continues: [],
      labeledBreaks: new Map(),
      labeledContinues: new Map(),
      loopUncertainty: false,
    };
  }

  function teardownFlowUnknownStatement(states) {
    return {
      continuing: [...states],
      exits: states.filter((status) => status !== true),
      breaks: [],
      continues: [],
      labeledBreaks: new Map(),
      labeledContinues: new Map(),
      loopUncertainty: false,
    };
  }

  function teardownFlowSequence(
    statements,
    states,
    matchCall,
    env = new Map(),
    callStack = new Set(),
  ) {
    let continuing = [...states];
    const accumulated = teardownFlowEmptyResult();

    for (const statement of statements) {
      if (continuing.length === 0) break;
      const result = teardownFlowStatement(
        statement,
        continuing,
        matchCall,
        env,
        callStack,
      );
      continuing = result.continuing ?? [];
      accumulated.exits.push(...(result.exits ?? []));
      accumulated.breaks.push(...(result.breaks ?? []));
      accumulated.continues.push(...(result.continues ?? []));
      accumulated.labeledBreaks = teardownFlowTransferMapMerge(
        accumulated.labeledBreaks,
        result.labeledBreaks,
      );
      accumulated.labeledContinues = teardownFlowTransferMapMerge(
        accumulated.labeledContinues,
        result.labeledContinues,
      );
      accumulated.loopUncertainty ||= result.loopUncertainty === true;
    }

    accumulated.continuing = continuing;
    return accumulated;
  }

  function teardownStaticBoolean(expression, env = new Map()) {
    if (!expression) return null;
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return null;
    if (resolved.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (resolved.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isParenthesizedExpression(resolved)) {
      return teardownStaticBoolean(resolved.expression, env);
    }
    if (
      ts.isPrefixUnaryExpression(resolved)
      && resolved.operator === ts.SyntaxKind.ExclamationToken
    ) {
      const value = teardownStaticBoolean(resolved.operand, env);
      return value === null ? null : !value;
    }
    return null;
  }

  function teardownStaticNumber(expression, env = new Map()) {
    if (!expression) return null;
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return null;
    if (ts.isNumericLiteral(resolved)) {
      const value = Number(resolved.text);
      return Number.isFinite(value) ? value : null;
    }
    if (
      ts.isPrefixUnaryExpression(resolved)
      && (
        resolved.operator === ts.SyntaxKind.PlusToken
        || resolved.operator === ts.SyntaxKind.MinusToken
      )
    ) {
      const operand = teardownStaticNumber(resolved.operand, env);
      if (operand === null) return null;
      return resolved.operator === ts.SyntaxKind.MinusToken ? -operand : operand;
    }
    if (ts.isParenthesizedExpression(resolved)) {
      return teardownStaticNumber(resolved.expression, env);
    }
    return null;
  }

  function teardownForInitializerInfo(initializer, env = new Map()) {
    if (!initializer) return null;
    if (ts.isVariableDeclarationList(initializer)) {
      if (initializer.declarations.length !== 1) return null;
      const declaration = initializer.declarations[0];
      if (!ts.isIdentifier(declaration.name)) return null;
      const value = teardownStaticNumber(declaration.initializer, env);
      return value === null
        ? null
        : { name: declaration.name.text, value };
    }
    if (
      ts.isBinaryExpression(initializer)
      && initializer.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isIdentifier(initializer.left)
    ) {
      const value = teardownStaticNumber(initializer.right, env);
      return value === null
        ? null
        : { name: initializer.left.text, value };
    }
    return null;
  }

  function teardownForConditionInfo(condition, variableName, env = new Map()) {
    if (!condition || !ts.isBinaryExpression(condition)) return null;
    const supported = new Set([
      ts.SyntaxKind.LessThanToken,
      ts.SyntaxKind.LessThanEqualsToken,
      ts.SyntaxKind.GreaterThanToken,
      ts.SyntaxKind.GreaterThanEqualsToken,
    ]);
    if (!supported.has(condition.operatorToken.kind)) return null;

    if (ts.isIdentifier(condition.left) && condition.left.text === variableName) {
      const bound = teardownStaticNumber(condition.right, env);
      return bound === null
        ? null
        : { operator: condition.operatorToken.kind, bound };
    }

    if (ts.isIdentifier(condition.right) && condition.right.text === variableName) {
      const bound = teardownStaticNumber(condition.left, env);
      if (bound === null) return null;
      const inverse = new Map([
        [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken],
        [ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanEqualsToken],
        [ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.LessThanToken],
        [ts.SyntaxKind.GreaterThanEqualsToken, ts.SyntaxKind.LessThanEqualsToken],
      ]);
      return { operator: inverse.get(condition.operatorToken.kind), bound };
    }

    return null;
  }

  function teardownForStepInfo(incrementor, variableName, env = new Map()) {
    if (!incrementor) return null;
    if (
      (ts.isPostfixUnaryExpression(incrementor) || ts.isPrefixUnaryExpression(incrementor))
      && ts.isIdentifier(incrementor.operand)
      && incrementor.operand.text === variableName
    ) {
      if (incrementor.operator === ts.SyntaxKind.PlusPlusToken) return 1;
      if (incrementor.operator === ts.SyntaxKind.MinusMinusToken) return -1;
    }

    if (
      ts.isBinaryExpression(incrementor)
      && ts.isIdentifier(incrementor.left)
      && incrementor.left.text === variableName
    ) {
      if (
        incrementor.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken
        || incrementor.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken
      ) {
        const amount = teardownStaticNumber(incrementor.right, env);
        if (amount === null) return null;
        return incrementor.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken
          ? -amount
          : amount;
      }

      if (
        incrementor.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isBinaryExpression(incrementor.right)
        && ts.isIdentifier(incrementor.right.left)
        && incrementor.right.left.text === variableName
      ) {
        const amount = teardownStaticNumber(incrementor.right.right, env);
        if (amount === null) return null;
        if (incrementor.right.operatorToken.kind === ts.SyntaxKind.PlusToken) {
          return amount;
        }
        if (incrementor.right.operatorToken.kind === ts.SyntaxKind.MinusToken) {
          return -amount;
        }
      }
    }

    return null;
  }

  function teardownNumericConditionHolds(value, condition) {
    if (!condition) return null;
    if (condition.operator === ts.SyntaxKind.LessThanToken) {
      return value < condition.bound;
    }
    if (condition.operator === ts.SyntaxKind.LessThanEqualsToken) {
      return value <= condition.bound;
    }
    if (condition.operator === ts.SyntaxKind.GreaterThanToken) {
      return value > condition.bound;
    }
    if (condition.operator === ts.SyntaxKind.GreaterThanEqualsToken) {
      return value >= condition.bound;
    }
    return null;
  }

  function teardownStaticForIterationClass(statement, env = new Map()) {
    const initializer = teardownForInitializerInfo(statement.initializer, env);
    if (!initializer) return null;
    const condition = teardownForConditionInfo(
      statement.condition,
      initializer.name,
      env,
    );
    if (!condition) return null;

    const enters = teardownNumericConditionHolds(initializer.value, condition);
    if (enters === false) return "zero-only";
    if (enters !== true) return null;

    const step = teardownForStepInfo(statement.incrementor, initializer.name, env);
    if (step === null || step === 0) return "one-or-more-indefinite";

    const movesTowardExit = (
      (
        condition.operator === ts.SyntaxKind.LessThanToken
        || condition.operator === ts.SyntaxKind.LessThanEqualsToken
      )
        ? step > 0
        : step < 0
    );
    return movesTowardExit ? "one-or-more" : "one-or-more-indefinite";
  }

  function teardownLoopIterationClass(statement, env = new Map()) {
    if (ts.isDoStatement(statement)) {
      const condition = teardownStaticBoolean(statement.expression, env);
      if (condition === true) return "one-or-more-indefinite";
      if (condition === false) return "one-or-more";
      return enforceProgrammaticFormOwnershipCallbackTeardownLabeledIterationPolicy
        ? "one-or-more-unknown"
        : "one-or-more";
    }

    if (ts.isWhileStatement(statement)) {
      const condition = teardownStaticBoolean(statement.expression, env);
      if (condition === false) return "zero-only";
      if (condition === true) return "one-or-more-indefinite";
      return enforceProgrammaticFormOwnershipCallbackTeardownLabeledIterationPolicy
        ? "zero-or-more-unknown"
        : "zero-or-more";
    }

    if (ts.isForStatement(statement)) {
      if (!statement.condition) return "one-or-more-indefinite";
      const condition = teardownStaticBoolean(statement.condition, env);
      if (condition === false) return "zero-only";
      if (condition === true) return "one-or-more-indefinite";
      if (enforceProgrammaticFormOwnershipCallbackTeardownLabeledIterationPolicy) {
        const staticClass = teardownStaticForIterationClass(statement, env);
        if (staticClass) return staticClass;
        return "zero-or-more-unknown";
      }
      return "zero-or-more";
    }

    if (ts.isForOfStatement(statement)) {
      const iterable = resolveDataExpression(statement.expression, env);
      if (iterable && ts.isArrayLiteralExpression(iterable)) {
        const guaranteedElements = iterable.elements.filter((element) =>
          !ts.isSpreadElement(element) && !ts.isOmittedExpression(element)
        );
        if (iterable.elements.length === 0) return "zero-only";
        if (guaranteedElements.length > 0) return "one-or-more";
        return enforceProgrammaticFormOwnershipCallbackTeardownLabeledIterationPolicy
          ? "zero-or-more-unknown"
          : "zero-or-more";
      }
      if (
        iterable
        && (ts.isStringLiteral(iterable) || ts.isNoSubstitutionTemplateLiteral(iterable))
      ) {
        return iterable.text.length > 0 ? "one-or-more" : "zero-only";
      }
      return enforceProgrammaticFormOwnershipCallbackTeardownLabeledIterationPolicy
        ? "zero-or-more-unknown"
        : "zero-or-more";
    }

    if (ts.isForInStatement(statement)) {
      const object = resolveDataExpression(statement.expression, env);
      if (object && ts.isObjectLiteralExpression(object)) {
        const guaranteedProperties = object.properties.filter((property) =>
          !ts.isSpreadAssignment(property)
        );
        if (object.properties.length === 0) return "zero-only";
        if (guaranteedProperties.length > 0) return "one-or-more";
      }
      return enforceProgrammaticFormOwnershipCallbackTeardownLabeledIterationPolicy
        ? "zero-or-more-unknown"
        : "zero-or-more";
    }

    return enforceProgrammaticFormOwnershipCallbackTeardownLabeledIterationPolicy
      ? "zero-or-more-unknown"
      : "zero-or-more";
  }

  function teardownFlowLoop(
    statement,
    states,
    matchCall,
    env,
    callStack,
    labelNames = [],
  ) {
    const iterationClass = teardownLoopIterationClass(statement, env);
    if (iterationClass === "zero-only") {
      return {
        continuing: [...states],
        exits: [],
        breaks: [],
        continues: [],
        labeledBreaks: new Map(),
        labeledContinues: new Map(),
        loopUncertainty: false,
      };
    }

    const bodyResult = teardownFlowStatement(
      statement.statement,
      states,
      matchCall,
      env,
      callStack,
    );
    const ownBreaks = teardownFlowTransferMapWithout(
      bodyResult.labeledBreaks,
      labelNames,
    );
    const ownContinues = teardownFlowTransferMapWithout(
      bodyResult.labeledContinues,
      labelNames,
    );
    const loopBreaks = [
      ...(bodyResult.breaks ?? []),
      ...ownBreaks.removed,
    ];
    const loopContinues = [
      ...(bodyResult.continues ?? []),
      ...ownContinues.removed,
    ];
    const bodyStatuses = [
      ...(bodyResult.continuing ?? []),
      ...(bodyResult.exits ?? []),
      ...loopBreaks,
      ...loopContinues,
      ...[...ownBreaks.remaining.values()].flat(),
      ...[...ownContinues.remaining.values()].flat(),
    ];
    const bodyCanTeardown = bodyStatuses.some((status) => status === true);
    const maySkip = (
      iterationClass === "zero-or-more"
      || iterationClass === "zero-or-more-unknown"
    );
    const zeroIterationUncertainty = (
      maySkip
      && states.some((status) => status !== true)
      && bodyCanTeardown
    );

    const continuing = [...loopBreaks];
    const exits = [...(bodyResult.exits ?? [])];
    let terminationUncertainty = false;

    if (
      iterationClass === "zero-or-more"
      || iterationClass === "zero-or-more-unknown"
    ) {
      continuing.unshift(...states);
      continuing.push(
        ...(bodyResult.continuing ?? []),
        ...loopContinues,
      );
      if (iterationClass === "zero-or-more-unknown") {
        exits.push(
          ...(bodyResult.continuing ?? []),
          ...loopContinues,
        );
        terminationUncertainty = true;
      }
    } else if (iterationClass === "one-or-more") {
      continuing.push(
        ...(bodyResult.continuing ?? []),
        ...loopContinues,
      );
    } else if (iterationClass === "one-or-more-unknown") {
      continuing.push(
        ...(bodyResult.continuing ?? []),
        ...loopContinues,
      );
      exits.push(
        ...(bodyResult.continuing ?? []),
        ...loopContinues,
      );
      terminationUncertainty = true;
    } else {
      exits.push(
        ...(bodyResult.continuing ?? []),
        ...loopContinues,
      );
    }

    return {
      continuing,
      exits,
      breaks: [],
      continues: [],
      labeledBreaks: ownBreaks.remaining,
      labeledContinues: ownContinues.remaining,
      loopUncertainty: (
        bodyResult.loopUncertainty === true
        || zeroIterationUncertainty
        || terminationUncertainty
      ),
    };
  }

  function teardownFlowLabeledStatement(
    statement,
    states,
    matchCall,
    env,
    callStack,
  ) {
    const labels = [];
    let target = statement;
    while (ts.isLabeledStatement(target)) {
      labels.push(target.label.text);
      target = target.statement;
    }

    if (
      ts.isDoStatement(target)
      || ts.isWhileStatement(target)
      || ts.isForStatement(target)
      || ts.isForOfStatement(target)
      || ts.isForInStatement(target)
    ) {
      return teardownFlowLoop(
        target,
        states,
        matchCall,
        env,
        callStack,
        labels,
      );
    }

    const result = teardownFlowStatement(
      target,
      states,
      matchCall,
      env,
      callStack,
    );
    const capturedBreaks = teardownFlowTransferMapWithout(
      result.labeledBreaks,
      labels,
    );
    return {
      ...result,
      continuing: [
        ...(result.continuing ?? []),
        ...capturedBreaks.removed,
      ],
      labeledBreaks: capturedBreaks.remaining,
    };
  }

  function teardownFlowSwitch(
    statement,
    states,
    matchCall,
    env,
    callStack,
  ) {
    const clauses = statement.caseBlock.clauses;

    if (!enforceProgrammaticFormOwnershipCallbackTeardownLoopPolicy) {
      const hasDefault = clauses.some((clause) => ts.isDefaultClause(clause));
      const results = [];

      if (!hasDefault) {
        results.push({ continuing: [...states], exits: [] });
      }

      for (const clause of clauses) {
        results.push(
          teardownFlowSequence(
            clause.statements,
            states,
            matchCall,
            env,
            callStack,
          ),
        );
      }

      return teardownFlowMerge(...results);
    }

    const hasDefault = clauses.some((clause) => ts.isDefaultClause(clause));
    const results = [];
    if (!hasDefault) {
      results.push({
        continuing: [...states],
        exits: [],
        breaks: [],
        continues: [],
        labeledBreaks: new Map(),
        labeledContinues: new Map(),
        loopUncertainty: false,
      });
    }

    for (let index = 0; index < clauses.length; index += 1) {
      const statements = clauses
        .slice(index)
        .flatMap((clause) => [...clause.statements]);
      const clauseResult = teardownFlowSequence(
        statements,
        states,
        matchCall,
        env,
        callStack,
      );
      results.push({
        continuing: [
          ...(clauseResult.continuing ?? []),
          ...(clauseResult.breaks ?? []),
        ],
        exits: [...(clauseResult.exits ?? [])],
        breaks: [],
        continues: [...(clauseResult.continues ?? [])],
        labeledBreaks: clauseResult.labeledBreaks ?? new Map(),
        labeledContinues: clauseResult.labeledContinues ?? new Map(),
        loopUncertainty: clauseResult.loopUncertainty === true,
      });
    }

    return teardownFlowMerge(...results);
  }

  function teardownFlowResumeFinallyResult(finalResult, channel, label = null) {
    const resumed = {
      continuing: [],
      exits: [...(finalResult.exits ?? [])],
      breaks: [...(finalResult.breaks ?? [])],
      continues: [...(finalResult.continues ?? [])],
      labeledBreaks: teardownFlowTransferMapMerge(finalResult.labeledBreaks),
      labeledContinues: teardownFlowTransferMapMerge(finalResult.labeledContinues),
      loopUncertainty: finalResult.loopUncertainty === true,
    };
    const statuses = finalResult.continuing ?? [];
    if (channel === "continuing") resumed.continuing.push(...statuses);
    if (channel === "exits") resumed.exits.push(...statuses);
    if (channel === "breaks") resumed.breaks.push(...statuses);
    if (channel === "continues") resumed.continues.push(...statuses);
    if (channel === "labeledBreaks" && label) {
      resumed.labeledBreaks = teardownFlowTransferMapMerge(
        resumed.labeledBreaks,
        new Map([[label, statuses]]),
      );
    }
    if (channel === "labeledContinues" && label) {
      resumed.labeledContinues = teardownFlowTransferMapMerge(
        resumed.labeledContinues,
        new Map([[label, statuses]]),
      );
    }
    return resumed;
  }

  function teardownFlowTry(
    statement,
    states,
    matchCall,
    env,
    callStack,
  ) {
    if (!enforceProgrammaticFormOwnershipCallbackTeardownLoopPolicy) {
      const tryResult = teardownFlowSequence(
        statement.tryBlock.statements,
        states,
        matchCall,
        env,
        callStack,
      );

      const preFinallyStatuses = [
        ...tryResult.continuing,
        ...tryResult.exits,
      ];

      if (statement.catchClause) {
        const catchResult = teardownFlowSequence(
          statement.catchClause.block.statements,
          states,
          matchCall,
          env,
          callStack,
        );
        preFinallyStatuses.push(
          ...catchResult.continuing,
          ...catchResult.exits,
        );
      } else {
        preFinallyStatuses.push(
          ...states.filter((status) => status !== true),
        );
      }

      if (!statement.finallyBlock) {
        return {
          continuing: preFinallyStatuses,
          exits: [],
          breaks: [],
          continues: [],
          labeledBreaks: new Map(),
          labeledContinues: new Map(),
          loopUncertainty: false,
        };
      }

      return teardownFlowSequence(
        statement.finallyBlock.statements,
        preFinallyStatuses,
        matchCall,
        env,
        callStack,
      );
    }

    const tryResult = teardownFlowSequence(
      statement.tryBlock.statements,
      states,
      matchCall,
      env,
      callStack,
    );
    const results = [tryResult];

    if (statement.catchClause) {
      results.push(
        teardownFlowSequence(
          statement.catchClause.block.statements,
          states,
          matchCall,
          env,
          callStack,
        ),
      );
    } else {
      results.push({
        continuing: [],
        exits: states.filter((status) => status !== true),
        breaks: [],
        continues: [],
        labeledBreaks: new Map(),
        labeledContinues: new Map(),
        loopUncertainty: false,
      });
    }

    const merged = teardownFlowMerge(...results);
    if (!statement.finallyBlock) return merged;

    const finalResults = [];
    for (const [channel, statuses] of [
      ["continuing", merged.continuing],
      ["exits", merged.exits],
      ["breaks", merged.breaks],
      ["continues", merged.continues],
    ]) {
      if (!statuses.length) continue;
      const finalResult = teardownFlowSequence(
        statement.finallyBlock.statements,
        statuses,
        matchCall,
        env,
        callStack,
      );
      finalResults.push(
        teardownFlowResumeFinallyResult(finalResult, channel),
      );
    }

    for (const [label, statuses] of merged.labeledBreaks ?? []) {
      if (!statuses.length) continue;
      const finalResult = teardownFlowSequence(
        statement.finallyBlock.statements,
        statuses,
        matchCall,
        env,
        callStack,
      );
      finalResults.push(
        teardownFlowResumeFinallyResult(finalResult, "labeledBreaks", label),
      );
    }
    for (const [label, statuses] of merged.labeledContinues ?? []) {
      if (!statuses.length) continue;
      const finalResult = teardownFlowSequence(
        statement.finallyBlock.statements,
        statuses,
        matchCall,
        env,
        callStack,
      );
      finalResults.push(
        teardownFlowResumeFinallyResult(finalResult, "labeledContinues", label),
      );
    }

    return teardownFlowMerge(...finalResults);
  }

  function teardownFlowStatement(
    statement,
    states,
    matchCall,
    env = new Map(),
    callStack = new Set(),
  ) {
    if (ts.isBlock(statement)) {
      return teardownFlowSequence(
        statement.statements,
        states,
        matchCall,
        env,
        callStack,
      );
    }

    if (
      enforceProgrammaticFormOwnershipCallbackTeardownLabeledIterationPolicy
      && ts.isLabeledStatement(statement)
    ) {
      return teardownFlowLabeledStatement(
        statement,
        states,
        matchCall,
        env,
        callStack,
      );
    }

    if (ts.isIfStatement(statement)) {
      const thenResult = teardownFlowStatement(
        statement.thenStatement,
        states,
        matchCall,
        env,
        callStack,
      );
      const elseResult = statement.elseStatement
        ? teardownFlowStatement(
          statement.elseStatement,
          states,
          matchCall,
          env,
          callStack,
        )
        : {
          continuing: [...states],
          exits: [],
          breaks: [],
          continues: [],
          labeledBreaks: new Map(),
          labeledContinues: new Map(),
          loopUncertainty: false,
        };
      return teardownFlowMerge(thenResult, elseResult);
    }

    if (
      enforceProgrammaticFormOwnershipCallbackTeardownLoopPolicy
      && (
        ts.isDoStatement(statement)
        || ts.isWhileStatement(statement)
        || ts.isForStatement(statement)
        || ts.isForOfStatement(statement)
        || ts.isForInStatement(statement)
      )
    ) {
      return teardownFlowLoop(
        statement,
        states,
        matchCall,
        env,
        callStack,
      );
    }

    if (ts.isSwitchStatement(statement)) {
      return teardownFlowSwitch(
        statement,
        states,
        matchCall,
        env,
        callStack,
      );
    }

    if (ts.isTryStatement(statement)) {
      return teardownFlowTry(
        statement,
        states,
        matchCall,
        env,
        callStack,
      );
    }

    if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) {
      return {
        continuing: [],
        exits: [...states],
        breaks: [],
        continues: [],
        labeledBreaks: new Map(),
        labeledContinues: new Map(),
        loopUncertainty: false,
      };
    }

    if (ts.isBreakStatement(statement)) {
      if (
        enforceProgrammaticFormOwnershipCallbackTeardownLabeledIterationPolicy
        && statement.label
      ) {
        return {
          continuing: [],
          exits: [],
          breaks: [],
          continues: [],
          labeledBreaks: new Map([[statement.label.text, [...states]]]),
          labeledContinues: new Map(),
          loopUncertainty: false,
        };
      }
      if (
        enforceProgrammaticFormOwnershipCallbackTeardownLoopPolicy
        && !statement.label
      ) {
        return {
          continuing: [],
          exits: [],
          breaks: [...states],
          continues: [],
          labeledBreaks: new Map(),
          labeledContinues: new Map(),
          loopUncertainty: false,
        };
      }
      return {
        continuing: [],
        exits: [...states],
        breaks: [],
        continues: [],
        labeledBreaks: new Map(),
        labeledContinues: new Map(),
        loopUncertainty: false,
      };
    }

    if (ts.isContinueStatement(statement)) {
      if (
        enforceProgrammaticFormOwnershipCallbackTeardownLabeledIterationPolicy
        && statement.label
      ) {
        return {
          continuing: [],
          exits: [],
          breaks: [],
          continues: [],
          labeledBreaks: new Map(),
          labeledContinues: new Map([[statement.label.text, [...states]]]),
          loopUncertainty: false,
        };
      }
      if (
        enforceProgrammaticFormOwnershipCallbackTeardownLoopPolicy
        && !statement.label
      ) {
        return {
          continuing: [],
          exits: [],
          breaks: [],
          continues: [...states],
          labeledBreaks: new Map(),
          labeledContinues: new Map(),
          loopUncertainty: false,
        };
      }
      return {
        continuing: [],
        exits: [...states],
        breaks: [],
        continues: [],
        labeledBreaks: new Map(),
        labeledContinues: new Map(),
        loopUncertainty: false,
      };
    }

    const call = directCallStatement(statement);
    if (call) {
      const matched = matchCall(call, env, callStack);
      if (matched === true) {
        return {
          continuing: states.map(() => true),
          exits: [],
          breaks: [],
          continues: [],
          labeledBreaks: new Map(),
          labeledContinues: new Map(),
          loopUncertainty: false,
        };
      }
      if (matched === "loop-partial-teardown") {
        return {
          continuing: states.flatMap((status) =>
            status === true ? [true] : [true, false]
          ),
          exits: [],
          breaks: [],
          continues: [],
          labeledBreaks: new Map(),
          labeledContinues: new Map(),
          loopUncertainty: true,
        };
      }
      if (matched === "partial-teardown") {
        return {
          continuing: states.flatMap((status) =>
            status === true ? [true] : [true, false]
          ),
          exits: [],
          breaks: [],
          continues: [],
          labeledBreaks: new Map(),
          labeledContinues: new Map(),
          loopUncertainty: false,
        };
      }
      if (matched === "safe-teardown") {
        return {
          continuing: [...states],
          exits: [],
          breaks: [],
          continues: [],
          labeledBreaks: new Map(),
          labeledContinues: new Map(),
          loopUncertainty: false,
        };
      }
      return teardownFlowUnknownStatement(states);
    }

    if (
      directIdentifierAlias(statement)
      || ts.isFunctionDeclaration(statement)
      || ts.isEmptyStatement(statement)
      || ts.isVariableStatement(statement)
    ) {
      return {
        continuing: [...states],
        exits: [],
        breaks: [],
        continues: [],
        labeledBreaks: new Map(),
        labeledContinues: new Map(),
        loopUncertainty: false,
      };
    }

    return teardownFlowUnknownStatement(states);
  }

  function teardownControlFlowStatus(
    definitionOrBlock,
    matchCall,
    env = new Map(),
    callStack = new Set(),
  ) {
    if (!definitionOrBlock) return "none";
    const body = definitionOrBlock.body ?? definitionOrBlock;
    if (!body || !ts.isBlock(body)) return "none";
    const result = teardownFlowSequence(
      body.statements,
      [false],
      matchCall,
      env,
      callStack,
    );
    const status = teardownFlowClassify([
      ...result.continuing,
      ...result.exits,
      ...(result.breaks ?? []),
      ...(result.continues ?? []),
      ...[...(result.labeledBreaks ?? new Map()).values()].flat(),
      ...[...(result.labeledContinues ?? new Map()).values()].flat(),
    ]);
    if (
      enforceProgrammaticFormOwnershipCallbackTeardownLoopPolicy
      && status === "partial"
      && result.loopUncertainty === true
    ) return "loop-partial";
    return status;
  }

  function scheduledHandleTeardownControlFlowStatus(
    definitionOrBlock,
    scheduledInfo,
    env = new Map(),
    callStack = new Set(),
  ) {
    const matchCall = (call, callEnv, stack) => {
      if (
        isScheduledHandleCancellationFor(
          call,
          scheduledInfo,
          new Map(),
          callEnv,
        )
      ) return true;

      if (isKnownTeardownOnlyCall(call, callEnv)) {
        return "safe-teardown";
      }

      const definition = localFunctionFromCallee(call.expression, callEnv);
      if (!definition || stack.has(definition.key)) return false;
      const nextStack = new Set(stack);
      nextStack.add(definition.key);
      const childEnv = functionEnvironment(definition, call, callEnv);
      const status = scheduledHandleTeardownControlFlowStatus(
        definition,
        scheduledInfo,
        childEnv,
        nextStack,
      );
      if (status === "guaranteed") return true;
      if (status === "loop-partial") return "loop-partial-teardown";
      if (status === "partial") return "partial-teardown";
      return false;
    };

    return teardownControlFlowStatus(
      definitionOrBlock,
      matchCall,
      env,
      callStack,
    );
  }

  function listenerTeardownControlFlowStatus(
    definitionOrBlock,
    addInfo,
    env = new Map(),
    callStack = new Set(),
  ) {
    const matchCall = (call, callEnv, stack) => {
      const removeInfo = eventListenerCallInfo(call, callEnv);
      if (eventListenerRemovalMatches(addInfo, removeInfo)) return true;
      if (
        addInfo?.signalController
        && isAbortCallForController(call, addInfo.signalController, callEnv)
      ) return true;

      if (isKnownTeardownOnlyCall(call, callEnv)) {
        return "safe-teardown";
      }

      const definition = localFunctionFromCallee(call.expression, callEnv);
      if (!definition || stack.has(definition.key)) return false;
      const nextStack = new Set(stack);
      nextStack.add(definition.key);
      const childEnv = functionEnvironment(definition, call, callEnv);
      const status = listenerTeardownControlFlowStatus(
        definition,
        addInfo,
        childEnv,
        nextStack,
      );
      if (status === "guaranteed") return true;
      if (status === "loop-partial") return "loop-partial-teardown";
      if (status === "partial") return "partial-teardown";
      return false;
    };

    return teardownControlFlowStatus(
      definitionOrBlock,
      matchCall,
      env,
      callStack,
    );
  }

  function functionBodyUnconditionallyCancelsScheduledHandle(
    definition,
    scheduledInfo,
    inheritedAliases = new Map(),
    env = new Map(),
  ) {
    if (!definition?.body || !ts.isBlock(definition.body)) return false;
    const aliases = new Map(inheritedAliases);
    for (const statement of definition.body.statements) {
      const alias = directIdentifierAlias(statement);
      if (alias) {
        aliases.set(alias.local, resolveScheduledAlias(alias.source, aliases));
        continue;
      }
      const call = directCallStatement(statement);
      if (call && isScheduledHandleCancellationFor(call, scheduledInfo, aliases, env)) {
        return true;
      }
      if (call && isKnownTeardownOnlyCall(call, env)) continue;
      if (ts.isFunctionDeclaration(statement) || ts.isEmptyStatement(statement)) continue;
      return false;
    }
    return false;
  }

  function functionBodyUnconditionallyRemovesListener(
    definition,
    addInfo,
    env = new Map(),
  ) {
    if (!definition?.body || !ts.isBlock(definition.body)) return false;
    for (const statement of definition.body.statements) {
      const call = directCallStatement(statement);
      if (call) {
        const removeInfo = eventListenerCallInfo(call, env);
        if (eventListenerRemovalMatches(addInfo, removeInfo)) return true;
        if (
          addInfo?.signalController
          && isAbortCallForController(call, addInfo.signalController, env)
        ) return true;
        if (isKnownTeardownOnlyCall(call, env)) continue;
      }
      if (ts.isFunctionDeclaration(statement) || ts.isEmptyStatement(statement)) continue;
      return false;
    }
    return false;
  }

  function containsTeardownAsyncBoundary(node) {
    let found = false;
    function scan(current) {
      if (found || !current) return;
      if (
        ts.isAwaitExpression(current)
        || ts.isYieldExpression(current)
      ) {
        found = true;
        return;
      }
      if (current !== node && ts.isFunctionLike(current)) return;
      ts.forEachChild(current, scan);
    }
    scan(node);
    return found;
  }

  function finallyUnconditionallyCancelsScheduledHandle(
    tryStatement,
    scheduledInfo,
    aliases = new Map(),
    env = new Map(),
  ) {
    if (
      !ts.isTryStatement(tryStatement)
      || !tryStatement.finallyBlock
      || containsTeardownAsyncBoundary(tryStatement.tryBlock)
    ) return false;
    const synthetic = {
      body: tryStatement.finallyBlock,
    };
    return functionBodyUnconditionallyCancelsScheduledHandle(
      synthetic,
      scheduledInfo,
      aliases,
      env,
    );
  }

  function isTransparentTeardownStatement(statement) {
    if (
      ts.isFunctionDeclaration(statement)
      || ts.isEmptyStatement(statement)
    ) return true;
    const alias = directIdentifierAlias(statement);
    return Boolean(alias);
  }

  function collectTeardownPathCancellations(node) {
    if (!enforceProgrammaticFormOwnershipCallbackTeardownPathPolicy || !node) return;

    const statements = (
      ts.isSourceFile(node) || ts.isBlock(node)
    )
      ? [...node.statements]
      : null;

    if (statements) {
      for (let index = 0; index < statements.length; index += 1) {
        const scheduledInfo = timerScheduledDeclarationInfo(statements[index]);
        if (scheduledInfo) {
          const aliases = new Map();
          for (let cursor = index + 1; cursor < statements.length; cursor += 1) {
            const statement = statements[cursor];
            const alias = directIdentifierAlias(statement);
            if (alias) {
              aliases.set(alias.local, resolveScheduledAlias(alias.source, aliases));
              continue;
            }

            if (
              ts.isTryStatement(statement)
              && finallyUnconditionallyCancelsScheduledHandle(
                statement,
                scheduledInfo,
                aliases,
              )
            ) {
              programmaticOwnershipCancelledScheduledCalls.add(scheduledInfo.call.pos);
              break;
            }

            const call = directCallStatement(statement);
            if (call) {
              if (isScheduledHandleCancellationFor(call, scheduledInfo, aliases)) {
                programmaticOwnershipCancelledScheduledCalls.add(scheduledInfo.call.pos);
                break;
              }
              const definition = localFunctionFromCallee(call.expression);
              if (
                definition
                && functionBodyUnconditionallyCancelsScheduledHandle(
                  definition,
                  scheduledInfo,
                  aliases,
                )
              ) {
                programmaticOwnershipCancelledScheduledCalls.add(scheduledInfo.call.pos);
                break;
              }
              break;
            }

            if (!isTransparentTeardownStatement(statement)) break;
          }
        }

        const addCall = directCallStatement(statements[index]);
        const addInfo = addCall ? eventListenerCallInfo(addCall) : null;
        if (addCall && addInfo?.method === "addEventListener") {
          for (let cursor = index + 1; cursor < statements.length; cursor += 1) {
            const statement = statements[cursor];
            if (ts.isFunctionDeclaration(statement) || ts.isEmptyStatement(statement)) continue;
            const call = directCallStatement(statement);
            if (!call) break;

            const removeInfo = eventListenerCallInfo(call);
            if (
              eventListenerRemovalMatches(addInfo, removeInfo)
              || (
                addInfo.signalController
                && isAbortCallForController(call, addInfo.signalController)
              )
            ) {
              programmaticOwnershipCancelledScheduledCalls.add(addCall.pos);
              break;
            }

            const definition = localFunctionFromCallee(call.expression);
            if (
              definition
              && functionBodyUnconditionallyRemovesListener(definition, addInfo)
            ) {
              programmaticOwnershipCancelledScheduledCalls.add(addCall.pos);
            }
            break;
          }
        }
      }
    }

    ts.forEachChild(node, collectTeardownPathCancellations);
  }

  function collectTeardownControlFlowCancellations(node) {
    if (
      !enforceProgrammaticFormOwnershipCallbackTeardownControlFlowPolicy
      || !node
    ) return;

    const statements = (
      ts.isSourceFile(node) || ts.isBlock(node)
    )
      ? [...node.statements]
      : null;

    if (statements) {
      for (let index = 0; index < statements.length; index += 1) {
        const scheduledInfo = timerScheduledDeclarationInfo(statements[index]);
        if (scheduledInfo) {
          const synthetic = {
            body: ts.factory.createBlock(statements.slice(index + 1), true),
          };
          const status = scheduledHandleTeardownControlFlowStatus(
            synthetic,
            scheduledInfo,
          );
          if (status === "guaranteed") {
            programmaticOwnershipCancelledScheduledCalls.add(
              scheduledInfo.call.pos,
            );
          } else if (status === "loop-partial") {
            programmaticOwnershipLoopPartialTeardownScheduledCalls.add(
              scheduledInfo.call.pos,
            );
          } else if (status === "partial") {
            programmaticOwnershipPartialTeardownScheduledCalls.add(
              scheduledInfo.call.pos,
            );
          }
        }

        const addCall = directCallStatement(statements[index]);
        const addInfo = addCall ? eventListenerCallInfo(addCall) : null;
        if (addCall && addInfo?.method === "addEventListener") {
          const synthetic = {
            body: ts.factory.createBlock(statements.slice(index + 1), true),
          };
          const status = listenerTeardownControlFlowStatus(
            synthetic,
            addInfo,
          );
          if (status === "guaranteed") {
            programmaticOwnershipCancelledScheduledCalls.add(addCall.pos);
          } else if (status === "loop-partial") {
            programmaticOwnershipLoopPartialTeardownScheduledCalls.add(addCall.pos);
          } else if (status === "partial") {
            programmaticOwnershipPartialTeardownScheduledCalls.add(addCall.pos);
          }
        }
      }
    }

    ts.forEachChild(node, collectTeardownControlFlowCancellations);
  }

  function isReactEffectReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (
      ts.isIdentifier(resolved)
      && (resolved.text === "useEffect" || resolved.text === "useLayoutEffect")
    ) return true;
    if (!(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))) {
      return false;
    }
    const name = propertyName(resolved);
    if (name !== "useEffect" && name !== "useLayoutEffect") return false;
    const ownerText = propertyOwner(resolved)?.getText(sourceFile);
    return ownerText === "React";
  }

  function reactEffectMultiplicity(callExpression, env = new Map()) {
    const dependencies = resolveDataExpression(callExpression.arguments[1], env);
    if (
      dependencies
      && ts.isArrayLiteralExpression(dependencies)
      && dependencies.elements.length === 0
    ) return "one-shot";
    return "repeat";
  }

  function effectCleanupDefinition(effectDefinition, env = new Map()) {
    const returns = functionReturnExpressions(effectDefinition);
    if (returns.length !== 1) return null;
    return localFunctionFromCallee(returns[0], env);
  }

  function collectEffectTeardownControlFlowScheduledCallbacks(node) {
    if (
      !enforceProgrammaticFormOwnershipCallbackTeardownControlFlowPolicy
      || !node
    ) return;

    if (ts.isCallExpression(node) && isReactEffectReference(node.expression)) {
      const effectDefinition = localFunctionFromCallee(node.arguments[0]);
      const cleanupDefinition = effectCleanupDefinition(effectDefinition);
      if (
        effectDefinition?.body
        && ts.isBlock(effectDefinition.body)
        && cleanupDefinition
      ) {
        for (const statement of effectDefinition.body.statements) {
          const scheduledInfo = timerScheduledDeclarationInfo(statement);
          if (scheduledInfo) {
            const status = scheduledHandleTeardownControlFlowStatus(
              cleanupDefinition,
              scheduledInfo,
            );
            if (status === "guaranteed") {
              programmaticOwnershipBoundedScheduledCalls.add(
                scheduledInfo.call.pos,
              );
            } else if (status === "loop-partial") {
              programmaticOwnershipLoopPartialTeardownScheduledCalls.add(
                scheduledInfo.call.pos,
              );
            } else if (status === "partial") {
              programmaticOwnershipPartialTeardownScheduledCalls.add(
                scheduledInfo.call.pos,
              );
            }
          }

          const addCall = directCallStatement(statement);
          const addInfo = addCall ? eventListenerCallInfo(addCall) : null;
          if (addCall && addInfo?.method === "addEventListener") {
            const status = listenerTeardownControlFlowStatus(
              cleanupDefinition,
              addInfo,
            );
            if (status === "guaranteed") {
              programmaticOwnershipBoundedScheduledCalls.add(addCall.pos);
            } else if (status === "loop-partial") {
              programmaticOwnershipLoopPartialTeardownScheduledCalls.add(addCall.pos);
            } else if (status === "partial") {
              programmaticOwnershipPartialTeardownScheduledCalls.add(
                addCall.pos,
              );
            }
          }
        }
      }
    }

    ts.forEachChild(node, collectEffectTeardownControlFlowScheduledCallbacks);
  }

  function collectEffectBoundedScheduledCallbacks(node) {
    if (!enforceProgrammaticFormOwnershipCallbackTeardownPathPolicy || !node) return;

    if (ts.isCallExpression(node) && isReactEffectReference(node.expression)) {
      const effectDefinition = localFunctionFromCallee(node.arguments[0]);
      const cleanupDefinition = effectCleanupDefinition(effectDefinition);
      if (
        effectDefinition?.body
        && ts.isBlock(effectDefinition.body)
        && cleanupDefinition
      ) {
        for (const statement of effectDefinition.body.statements) {
          const scheduledInfo = timerScheduledDeclarationInfo(statement);
          if (
            scheduledInfo
            && functionBodyUnconditionallyCancelsScheduledHandle(
              cleanupDefinition,
              scheduledInfo,
            )
          ) {
            programmaticOwnershipBoundedScheduledCalls.add(scheduledInfo.call.pos);
          }

          const addCall = directCallStatement(statement);
          const addInfo = addCall ? eventListenerCallInfo(addCall) : null;
          if (
            addCall
            && addInfo?.method === "addEventListener"
            && functionBodyUnconditionallyRemovesListener(cleanupDefinition, addInfo)
          ) {
            programmaticOwnershipBoundedScheduledCalls.add(addCall.pos);
          }
        }
      }
    }

    ts.forEachChild(node, collectEffectBoundedScheduledCallbacks);
  }

  function collectDefinitelyCancelledScheduledCallbacks(node) {
    if (!enforceProgrammaticFormOwnershipCallbackLifetimePolicy || !node) return;

    const statements = (
      ts.isSourceFile(node) || ts.isBlock(node)
    )
      ? [...node.statements]
      : null;

    if (statements) {
      for (let index = 0; index < statements.length - 1; index += 1) {
        const statement = statements[index];
        const nextStatement = statements[index + 1];
        const nextCall = directCallStatement(nextStatement);

        const timer = timerScheduledDeclarationInfo(statement);
        if (
          timer
          && nextCall
          && isTimerCancellationFor(nextCall, timer)
        ) {
          programmaticOwnershipCancelledScheduledCalls.add(timer.call.pos);
        }

        const addCall = directCallStatement(statement);
        const addInfo = addCall ? eventListenerCallInfo(addCall) : null;
        if (addCall && addInfo?.method === "addEventListener" && nextCall) {
          const removeInfo = eventListenerCallInfo(nextCall);
          if (eventListenerRemovalMatches(addInfo, removeInfo)) {
            programmaticOwnershipCancelledScheduledCalls.add(addCall.pos);
          } else if (
            addInfo.signalController
            && isAbortCallForController(nextCall, addInfo.signalController)
          ) {
            programmaticOwnershipCancelledScheduledCalls.add(addCall.pos);
          }
        }
      }
    }

    ts.forEachChild(node, collectDefinitelyCancelledScheduledCallbacks);
  }

  function ownershipScheduledCallbackInfo(callExpression, env = new Map()) {
    if (
      !enforceProgrammaticFormOwnershipCallbackSchedulingPolicy
      || !ts.isCallExpression(callExpression)
    ) return null;

    const callee = resolveDataExpression(callExpression.expression, env);
    if (!callee) return null;

    if (
      enforceProgrammaticFormOwnershipCallbackTeardownPathPolicy
      && isReactEffectReference(callee, env)
    ) {
      return {
        kind: propertyName(callee) ?? (ts.isIdentifier(callee) ? callee.text : "react-effect"),
        callbackIndexes: [0],
        multiplicity: reactEffectMultiplicity(callExpression, env),
      };
    }

    const timerKind = dynamicCodeTimerKind(callee, env);
    if (timerKind) {
      return {
        kind: timerKind === "setInterval" ? "timer-repeat" : "timer",
        callbackIndexes: [0],
        multiplicity: timerKind === "setInterval" ? "repeat" : "one-shot",
      };
    }

    for (const name of [
      "queueMicrotask",
      "requestAnimationFrame",
      "requestIdleCallback",
    ]) {
      if (isGlobalCallbackSchedulerReference(callee, name, env)) {
        return { kind: name, callbackIndexes: [0], multiplicity: "one-shot" };
      }
    }

    if (
      (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))
      && propertyName(callee) === "addEventListener"
    ) {
      const options = eventListenerOptionsInfo(callExpression.arguments[2], env);
      return {
        kind: "event-listener",
        callbackIndexes: [1],
        multiplicity: options.once === true ? "one-shot" : "repeat",
      };
    }

    if (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) {
      const method = propertyName(callee);
      const owner = propertyOwner(callee);
      if (
        owner
        && ["then", "catch", "finally"].includes(method)
        && isPromiseSchedulingOwner(owner, env)
      ) {
        return {
          kind: "promise-" + method,
          callbackIndexes: method === "then" ? [0, 1] : [0],
          multiplicity: "one-shot",
        };
      }
    }

    return null;
  }

  function visitScheduledOwnershipCallbacks(
    callExpression,
    env,
    callStack,
    visitChild,
  ) {
    const scheduled = ownershipScheduledCallbackInfo(callExpression, env);
    if (!scheduled) return false;
    if (
      enforceProgrammaticFormOwnershipCallbackLifetimePolicy
      && programmaticOwnershipCancelledScheduledCalls.has(callExpression.pos)
    ) {
      return true;
    }

    let analyzed = false;
    for (const index of scheduled.callbackIndexes) {
      const callbackExpression = callExpression.arguments[index];
      if (!callbackExpression) continue;
      const definition = localFunctionFromCallee(callbackExpression, env);
      if (!definition || callStack.has(definition.key)) continue;

      const snapshot = cloneProgrammaticOwnershipStates();
      const nextStack = new Set(callStack);
      nextStack.add(definition.key);
      const childEnv = new Map(env);

      markProgrammaticOwnershipStatesScheduled();
      programmaticOwnershipScheduledCallbackDepth += 1;
      programmaticOwnershipScheduledMultiplicity.push(
        enforceProgrammaticFormOwnershipCallbackLifetimePolicy
          ? (scheduled.multiplicity ?? "one-shot")
          : "one-shot",
      );
      programmaticOwnershipScheduledTeardown.push(
        enforceProgrammaticFormOwnershipCallbackTeardownLoopPolicy
          && programmaticOwnershipLoopPartialTeardownScheduledCalls.has(
            callExpression.pos,
          )
          ? "loop-partial"
          : enforceProgrammaticFormOwnershipCallbackTeardownControlFlowPolicy
            && programmaticOwnershipPartialTeardownScheduledCalls.has(
              callExpression.pos,
            )
            ? "partial"
            : enforceProgrammaticFormOwnershipCallbackTeardownPathPolicy
              && programmaticOwnershipBoundedScheduledCalls.has(
                callExpression.pos,
              )
              ? "bounded"
              : null,
      );
      try {
        visitChild(definition.body, childEnv, nextStack);
      } finally {
        programmaticOwnershipScheduledTeardown.pop();
        programmaticOwnershipScheduledMultiplicity.pop();
        programmaticOwnershipScheduledCallbackDepth -= 1;
        restoreProgrammaticOwnershipStates(snapshot);
      }
      analyzed = true;
    }
    return analyzed;
  }

  collectDefinitelyCancelledScheduledCallbacks(sourceFile);
  collectTeardownPathCancellations(sourceFile);
  collectEffectBoundedScheduledCallbacks(sourceFile);
  collectTeardownControlFlowCancellations(sourceFile);
  collectEffectTeardownControlFlowScheduledCallbacks(sourceFile);

  function staticHrefCandidatesResolved(expression, env = new Map(), callStack = new Set(), seen = new Set()) {
    if (!expression) return [];
    const resolved = resolveDataExpression(expression, env, seen);
    if (!resolved) return [];
    if (ts.isStringLiteralLike(resolved)) return [resolved.text];
    if (ts.isConditionalExpression(resolved)) {
      return [
        ...staticHrefCandidatesResolved(resolved.whenTrue, env, callStack, seen),
        ...staticHrefCandidatesResolved(resolved.whenFalse, env, callStack, seen),
      ];
    }
    if (
      ts.isBinaryExpression(resolved)
      && resolved.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      return [
        ...staticHrefCandidatesResolved(resolved.left, env, callStack, seen),
        ...staticHrefCandidatesResolved(resolved.right, env, callStack, seen),
      ];
    }
    if (ts.isTemplateExpression(resolved)) return [resolved.head.text];
    if (ts.isCallExpression(resolved)) {
      const definition = localFunctionFromCallee(resolved.expression, env);
      if (definition && !callStack.has(definition.key)) {
        const nextStack = new Set(callStack);
        nextStack.add(definition.key);
        const childEnv = functionEnvironment(definition, resolved, env);
        return functionReturnExpressions(definition)
          .flatMap((candidate) => staticHrefCandidatesResolved(candidate, childEnv, nextStack, seen));
      }
    }
    return [];
  }

  function authorityExpressionResolved(expression, bindings, env = new Map(), callStack = new Set()) {
    if (!expression) return false;
    const resolved = resolveDataExpression(expression, env);
    if (authorityCall(resolved, bindings)) return true;
    if (ts.isConditionalExpression(resolved)) {
      return authorityExpressionResolved(resolved.whenTrue, bindings, env, callStack)
        && authorityExpressionResolved(resolved.whenFalse, bindings, env, callStack);
    }
    if (ts.isCallExpression(resolved)) {
      const definition = localFunctionFromCallee(resolved.expression, env);
      if (definition && !callStack.has(definition.key)) {
        const nextStack = new Set(callStack);
        nextStack.add(definition.key);
        const childEnv = functionEnvironment(definition, resolved, env);
        const returns = functionReturnExpressions(definition);
        return returns.length > 0
          && returns.every((candidate) => authorityExpressionResolved(candidate, bindings, childEnv, nextStack));
      }
    }
    return false;
  }

  function routeRedirectTargetExpressions(expression, env = new Map(), callStack = new Set()) {
    if (!expression) return [];
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return [];
    if (
      ts.isNewExpression(resolved)
      && ts.isIdentifier(resolved.expression)
      && resolved.expression.text === "URL"
    ) {
      return resolved.arguments?.[0] ? [resolved.arguments[0]] : [];
    }
    if (ts.isConditionalExpression(resolved)) {
      return [
        ...routeRedirectTargetExpressions(resolved.whenTrue, env, callStack),
        ...routeRedirectTargetExpressions(resolved.whenFalse, env, callStack),
      ];
    }
    if (ts.isCallExpression(resolved)) {
      const definition = localFunctionFromCallee(resolved.expression, env);
      if (definition && !callStack.has(definition.key)) {
        const nextStack = new Set(callStack);
        nextStack.add(definition.key);
        const childEnv = functionEnvironment(definition, resolved, env);
        return functionReturnExpressions(definition)
          .flatMap((candidate) => routeRedirectTargetExpressions(candidate, childEnv, nextStack));
      }
    }
    return [resolved];
  }

  function isRouterMethodReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && routerMethodBindings.has(resolved.text)) return true;
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && isRouterObject(propertyOwner(resolved), env)
      && (propertyName(resolved) === "push" || propertyName(resolved) === "replace")
    );
  }

  function isRouterTraversalReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && routerTraversalMethodBindings.has(resolved.text)) return true;
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && isRouterObject(propertyOwner(resolved), env)
      && (propertyName(resolved) === "back" || propertyName(resolved) === "forward")
    );
  }

  function isServerRedirectReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    return Boolean(
      resolved
      && ts.isIdentifier(resolved)
      && redirectBindings.has(resolved.text)
    );
  }

  function isResponseRedirectReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (
      ts.isIdentifier(resolved)
      && (
        responseRedirectBindings.has(resolved.text)
        || webResponseRedirectBindings.has(resolved.text)
      )
    ) return true;

    if (!(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))) {
      return false;
    }
    if (propertyName(resolved) !== "redirect") return false;
    const owner = propertyOwner(resolved);
    if (!owner) return false;
    if (isWebResponseObject(owner, env)) return true;
    return Boolean(
      ts.isIdentifier(owner)
      && nextResponseBindings.has(owner.text)
    );
  }

  function isBrowserLocationMethodReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && browserLocationMethodBindings.has(resolved.text)) return true;
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && isBrowserLocationObject(propertyOwner(resolved), env)
      && (propertyName(resolved) === "assign" || propertyName(resolved) === "replace")
    );
  }

  function isBrowserLocationReloadReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && browserLocationReloadBindings.has(resolved.text)) return true;
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && isBrowserLocationObject(propertyOwner(resolved), env)
      && propertyName(resolved) === "reload"
    );
  }

  function isBrowserHistoryMethodReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && browserHistoryMethodBindings.has(resolved.text)) return true;
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && isBrowserHistoryObject(propertyOwner(resolved), env)
      && (propertyName(resolved) === "pushState" || propertyName(resolved) === "replaceState")
    );
  }

  function isBrowserHistoryTraversalReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && browserHistoryTraversalMethodBindings.has(resolved.text)) return true;
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && isBrowserHistoryObject(propertyOwner(resolved), env)
      && (
        propertyName(resolved) === "back"
        || propertyName(resolved) === "forward"
        || propertyName(resolved) === "go"
      )
    );
  }

  function isBrowserNavigationApiMethodReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && browserNavigationApiMethodBindings.has(resolved.text)) return true;
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && isBrowserNavigationApiObject(propertyOwner(resolved), env)
      && propertyName(resolved) === "navigate"
    );
  }

  function isBrowserNavigationTraversalReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (
      ts.isIdentifier(resolved)
      && browserNavigationTraversalMethodBindings.has(resolved.text)
    ) return true;
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && isBrowserNavigationApiObject(propertyOwner(resolved), env)
      && (
        propertyName(resolved) === "back"
        || propertyName(resolved) === "forward"
        || propertyName(resolved) === "reload"
        || propertyName(resolved) === "traverseTo"
      )
    );
  }

  function isBrowserWindowOpenReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && browserWindowOpenBindings.has(resolved.text)) return true;
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && isBrowserWindowObject(propertyOwner(resolved), env)
      && propertyName(resolved) === "open"
    );
  }

  function isLocationHeaderMutationReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && headerMutationMethodBindings.has(resolved.text)) return true;
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && isHeadersObject(propertyOwner(resolved), env)
      && (propertyName(resolved) === "set" || propertyName(resolved) === "append")
    );
  }

  function staticInvocationArguments(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved || !ts.isArrayLiteralExpression(resolved)) {
      return { args: [], dynamic: true };
    }
    if (resolved.elements.some((element) => ts.isSpreadElement(element))) {
      return { args: [], dynamic: true };
    }
    return { args: [...resolved.elements], dynamic: false };
  }

  function boundCallableInfo(expression, env = new Map(), seen = new Set()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved || !ts.isCallExpression(resolved)) return null;

    const key = resolved.pos + ":" + resolved.end;
    if (seen.has(key)) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(key);

    const bindCallee = resolveDataExpression(resolved.expression, env);
    if (
      !bindCallee
      || !(ts.isPropertyAccessExpression(bindCallee) || ts.isElementAccessExpression(bindCallee))
      || propertyName(bindCallee) !== "bind"
    ) return null;

    const target = propertyOwner(bindCallee);
    if (!target) return null;

    const boundArgs = resolved.arguments.slice(1);
    const dynamic = boundArgs.some((argument) => ts.isSpreadElement(argument));
    const nested = boundCallableInfo(target, env, nextSeen);
    if (nested) {
      return {
        target: nested.target,
        thisArg: nested.thisArg,
        args: dynamic || nested.dynamic ? [] : [...nested.args, ...boundArgs],
        dynamic: dynamic || nested.dynamic,
      };
    }

    return {
      target,
      thisArg: resolved.arguments[0] ?? null,
      args: dynamic ? [] : boundArgs,
      dynamic,
    };
  }

  function mergeBoundInvocation(invocation, env = new Map()) {
    if (!invocation?.target) return invocation;
    const bound = boundCallableInfo(invocation.target, env);
    if (!bound) return invocation;
    return {
      target: bound.target,
      thisArg: bound.thisArg,
      args: invocation.dynamic || bound.dynamic
        ? []
        : [...bound.args, ...invocation.args],
      dynamic: invocation.dynamic || bound.dynamic,
    };
  }

  function indirectInvocationInfo(callExpression, env = new Map()) {
    if (!ts.isCallExpression(callExpression)) return null;
    const resolvedCallee = resolveDataExpression(callExpression.expression, env);
    if (!resolvedCallee) return null;

    const directlyBound = boundCallableInfo(callExpression.expression, env);
    if (directlyBound) {
      const runtimeArgs = callExpression.arguments;
      const runtimeDynamic = runtimeArgs.some((argument) => ts.isSpreadElement(argument));
      return {
        target: directlyBound.target,
        thisArg: directlyBound.thisArg,
        args: runtimeDynamic || directlyBound.dynamic
          ? []
          : [...directlyBound.args, ...runtimeArgs],
        dynamic: runtimeDynamic || directlyBound.dynamic,
      };
    }

    if (
      ts.isPropertyAccessExpression(resolvedCallee)
      || ts.isElementAccessExpression(resolvedCallee)
    ) {
      const method = propertyName(resolvedCallee);
      const target = propertyOwner(resolvedCallee);
      const ownerText = propertyOwner(resolvedCallee)?.getText(sourceFile);
      if (
        method === "apply"
        && (ownerText === "Reflect" || ownerText === "globalThis.Reflect")
      ) {
        const invocation = staticInvocationArguments(callExpression.arguments[2], env);
        return mergeBoundInvocation({
          target: callExpression.arguments[0] ?? null,
          thisArg: callExpression.arguments[1] ?? null,
          args: invocation.args,
          dynamic: invocation.dynamic,
        }, env);
      }

      if (method === "call") {
        const invocationArgs = callExpression.arguments.slice(1);
        return mergeBoundInvocation({
          target,
          thisArg: callExpression.arguments[0] ?? null,
          args: invocationArgs.some((argument) => ts.isSpreadElement(argument))
            ? []
            : invocationArgs,
          dynamic: invocationArgs.some((argument) => ts.isSpreadElement(argument)),
        }, env);
      }
      if (method === "apply") {
        const invocation = staticInvocationArguments(callExpression.arguments[1], env);
        return mergeBoundInvocation({
          target,
          thisArg: callExpression.arguments[0] ?? null,
          args: invocation.args,
          dynamic: invocation.dynamic,
        }, env);
      }
    }

    return null;
  }

  function nativeDomPrototypeKind(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return null;
    const text = resolved.getText(sourceFile);
    const match = text.match(/^(?:globalThis\.)?(HTMLAnchorElement|HTMLAreaElement|HTMLBaseElement|HTMLFormElement|HTMLButtonElement|HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|HTMLFieldSetElement|HTMLIFrameElement|HTMLFrameElement|HTMLFencedFrameElement|HTMLObjectElement|HTMLEmbedElement)\.prototype$/);
    return match ? domKindFromTypeNameText(match[1]) : null;
  }

  function nativeDomSetterInfo(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (
      !resolved
      || !(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      || propertyName(resolved) !== "set"
    ) return null;

    const descriptorCall = propertyOwner(resolved);
    if (!descriptorCall || !ts.isCallExpression(descriptorCall)) return null;
    const descriptorCallee = resolveDataExpression(descriptorCall.expression, env);
    if (
      !descriptorCallee
      || !(ts.isPropertyAccessExpression(descriptorCallee) || ts.isElementAccessExpression(descriptorCallee))
      || propertyName(descriptorCallee) !== "getOwnPropertyDescriptor"
    ) return null;

    const descriptorOwner = propertyOwner(descriptorCallee)?.getText(sourceFile);
    if (descriptorOwner !== "Object" && descriptorOwner !== "globalThis.Object") return null;

    const kind = nativeDomPrototypeKind(descriptorCall.arguments[0], env);
    const propertyExpression = resolveDataExpression(descriptorCall.arguments[1], env);
    const propertyText = propertyExpression && ts.isStringLiteralLike(propertyExpression)
      ? propertyExpression.text
      : null;
    const navigationProperty = domNavigationPropertyForKind(kind, propertyText);
    const targetContextProperty = domTargetContextPropertyForKind(kind, propertyText);
    const submissionTransportProperty = domSubmissionTransportPropertyForKind(kind, propertyText);
    const validationBypassProperty = domValidationBypassPropertyForKind(kind, propertyText);
    const constraintProperty = domConstraintPropertyForKind(kind, propertyText);
    const participationProperty = enforceFormControlParticipationPolicy
      ? domParticipationPropertyForKind(kind, propertyText)
      : null;
    return kind && (
      navigationProperty
      || targetContextProperty
      || submissionTransportProperty
      || validationBypassProperty
      || constraintProperty
      || participationProperty
    )
      ? {
          kind,
          property: (
            navigationProperty
            ?? targetContextProperty
            ?? submissionTransportProperty
            ?? validationBypassProperty
            ?? constraintProperty
            ?? participationProperty
          ),
          targetContext: Boolean(targetContextProperty),
          submissionTransport: Boolean(submissionTransportProperty),
          validationBypass: Boolean(validationBypassProperty),
          constraintIntegrity: Boolean(constraintProperty),
          participationIntegrity: Boolean(participationProperty),
        }
      : null;
  }

  function isNativeDomAttributeMethodReference(
    expression,
    methodName,
    env = new Map(),
  ) {
    const resolved = resolveDataExpression(expression, env);
    if (
      !resolved
      || !(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      || propertyName(resolved) !== methodName
    ) return false;

    const owner = propertyOwner(resolved);
    if (!owner) return false;
    const ownerText = owner.getText(sourceFile);
    return (
      ownerText === "Element.prototype"
      || ownerText === "globalThis.Element.prototype"
      || ownerText === "HTMLElement.prototype"
      || ownerText === "globalThis.HTMLElement.prototype"
      || Boolean(nativeDomPrototypeKind(owner, env))
    );
  }

  function isNativeDomSetAttributeReference(expression, env = new Map()) {
    return isNativeDomAttributeMethodReference(expression, "setAttribute", env);
  }

  function isNativeDomSetAttributeNSReference(expression, env = new Map()) {
    return isNativeDomAttributeMethodReference(expression, "setAttributeNS", env);
  }

  function isNativeDomToggleAttributeReference(expression, env = new Map()) {
    return isNativeDomAttributeMethodReference(expression, "toggleAttribute", env);
  }

  function isNativeDomRemoveAttributeReference(expression, env = new Map()) {
    return isNativeDomAttributeMethodReference(expression, "removeAttribute", env);
  }

  function isNativeDomRemoveAttributeNSReference(expression, env = new Map()) {
    return isNativeDomAttributeMethodReference(expression, "removeAttributeNS", env);
  }

  function isNativeDomSetCustomValidityReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (
      !resolved
      || !(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      || propertyName(resolved) !== "setCustomValidity"
    ) return false;
    return Boolean(nativeDomPrototypeKind(propertyOwner(resolved), env));
  }

  function relocationDestinationInfo(expression, env = new Map()) {
    if (!expression) return { owner: null, kind: null };
    const kind = domNavigationElementKind(expression, env);
    if (kind === "form") {
      return { owner: formOwnerIdentity(expression, env), kind };
    }

    if (kind === "fieldset") {
      const info = currentFormOwnershipInfo(expression, env);
      if (info.owned && info.owner) return { owner: info.owner, kind };
    }

    return { owner: null, kind };
  }

  function transitionProgrammaticControlToDestination(
    targetExpression,
    destinationExpression,
    env = new Map(),
  ) {
    const identity = programmaticOwnershipIdentity(targetExpression, env);
    if (!identity) return false;
    const destination = relocationDestinationInfo(destinationExpression, env);
    if (!destination.owner) {
      return setProgrammaticOwnershipState(identity, {
        owned: false,
        owner: null,
        associationMode: "programmatic",
      });
    }
    return setProgrammaticOwnershipState(identity, {
      owned: true,
      owner: destination.owner,
      associationMode: "programmatic",
    });
  }

  function detachProgrammaticControl(targetExpression, env = new Map()) {
    const identity = programmaticOwnershipIdentity(targetExpression, env);
    if (!identity) return false;
    return setProgrammaticOwnershipState(identity, {
      owned: false,
      owner: null,
      associationMode: "programmatic",
    });
  }

  function reportProgrammaticOwnershipStateEviction(
    node,
    destinationExpression,
    retainedExpressions,
    method,
    env = new Map(),
  ) {
    if (
      !enforceProgrammaticFormOwnershipStatePolicy
      || !programmaticOwnershipExecutionActive()
      || method !== "replaceChildren"
    ) return false;

    const destination = relocationDestinationInfo(destinationExpression, env);
    if (!destination.owner) return false;

    const retained = new Set(
      retainedExpressions
        .map((expression) => programmaticOwnershipIdentity(expression, env))
        .filter(Boolean),
    );
    const evicted = [...programmaticOwnershipStates.entries()].some(
      ([identity, state]) => (
        state.owned === true
        && state.owner === destination.owner
        && !retained.has(identity)
      ),
    );
    if (!evicted) return false;
    report(node, "programmatic-ownership-state-evict", [method]);
    return true;
  }

  function applyProgrammaticOwnershipCallTransition(callExpression, env = new Map()) {
    if (
      !enforceProgrammaticFormOwnershipStatePolicy
      || !programmaticOwnershipExecutionActive()
      || !ts.isCallExpression(callExpression)
    ) return false;

    let changed = false;
    const direct = resolveDataExpression(callExpression.expression, env);
    if (
      direct
      && (ts.isPropertyAccessExpression(direct) || ts.isElementAccessExpression(direct))
    ) {
      const method = propertyName(direct);
      const destination = propertyOwner(direct);

      if (
        ["append", "appendChild", "prepend", "insertBefore", "replaceChildren", "replaceChild"]
          .includes(method)
      ) {
        const targets = relocationTargetsForMethod(method, callExpression);
        if (method === "replaceChildren") {
          const destinationInfo = relocationDestinationInfo(destination, env);
          if (destinationInfo.owner) {
            const retained = new Set(
              targets
                .map((target) => programmaticOwnershipIdentity(target, env))
                .filter(Boolean),
            );
            for (const [identity, state] of programmaticOwnershipStates) {
              if (
                state.owned === true
                && state.owner === destinationInfo.owner
                && !retained.has(identity)
              ) {
                setProgrammaticOwnershipState(identity, {
                  owned: false,
                  owner: null,
                  associationMode: "programmatic",
                });
                changed = true;
              }
            }
          }
        }
        if (method === "replaceChild" && callExpression.arguments[1]) {
          changed = detachProgrammaticControl(callExpression.arguments[1], env) || changed;
        }
        for (const target of targets) {
          changed = (
            transitionProgrammaticControlToDestination(target, destination, env)
            || changed
          );
        }
      }

      if (method === "remove" || method === "replaceWith") {
        const oldInfo = programmaticOwnershipStateInfo(destination, env);
        changed = detachProgrammaticControl(destination, env) || changed;
        if (
          method === "replaceWith"
          && oldInfo.known
          && oldInfo.owned
          && oldInfo.associationMode !== "explicit"
        ) {
          for (const replacement of callExpression.arguments) {
            const replacementIdentity = programmaticOwnershipIdentity(replacement, env);
            if (!replacementIdentity) continue;
            setProgrammaticOwnershipState(replacementIdentity, {
              owned: true,
              owner: oldInfo.owner,
              associationMode: oldInfo.uncertain ? "control-flow" : "programmatic",
              uncertain: oldInfo.uncertain === true,
            });
            changed = true;
          }
        }
      }

      if (method === "removeChild" && callExpression.arguments[0]) {
        changed = detachProgrammaticControl(callExpression.arguments[0], env) || changed;
      }
    }

    const indirect = indirectInvocationInfo(callExpression, env);
    if (!indirect || indirect.dynamic) return changed;

    const relocation = nativeDomOwnershipRelocationInfo(indirect.target, env);
    if (relocation) {
      const indexes = relocation.targetIndexes === "all"
        ? indirect.args.map((_, index) => index)
        : relocation.targetIndexes;
      const targets = indexes.map((index) => indirect.args[index]).filter(Boolean);

      if (relocation.method === "replaceChildren") {
        const destinationInfo = relocationDestinationInfo(indirect.thisArg, env);
        if (destinationInfo.owner) {
          const retained = new Set(
            targets
              .map((target) => programmaticOwnershipIdentity(target, env))
              .filter(Boolean),
          );
          for (const [identity, state] of programmaticOwnershipStates) {
            if (
              state.owned === true
              && state.owner === destinationInfo.owner
              && !retained.has(identity)
            ) {
              setProgrammaticOwnershipState(identity, {
                owned: false,
                owner: null,
                associationMode: "programmatic",
              });
              changed = true;
            }
          }
        }
      }

      if (relocation.method === "replaceChild" && indirect.args[1]) {
        changed = detachProgrammaticControl(indirect.args[1], env) || changed;
      }

      for (const target of targets) {
        changed = (
          transitionProgrammaticControlToDestination(target, indirect.thisArg, env)
          || changed
        );
      }
    }

    const lifecycle = nativeDomOwnershipLifecycleInfo(indirect.target, env);
    if (lifecycle) {
      const lifecycleTarget = lifecycle.targetMode === "this"
        ? indirect.thisArg
        : indirect.args[lifecycle.targetIndex];
      const oldInfo = programmaticOwnershipStateInfo(lifecycleTarget, env);
      changed = detachProgrammaticControl(lifecycleTarget, env) || changed;

      if (
        lifecycle.method === "replaceWith"
        && oldInfo.known
        && oldInfo.owned
        && oldInfo.associationMode !== "explicit"
      ) {
        for (const replacement of indirect.args) {
          const replacementIdentity = programmaticOwnershipIdentity(replacement, env);
          if (!replacementIdentity) continue;
          setProgrammaticOwnershipState(replacementIdentity, {
            owned: true,
            owner: oldInfo.owner,
            associationMode: oldInfo.uncertain ? "control-flow" : "programmatic",
            uncertain: oldInfo.uncertain === true,
          });
          changed = true;
        }
      }
    }

    return changed;
  }

  function reportProgrammaticFormOwnershipRelocation(
    node,
    targetExpression,
    destinationExpression,
    method,
    env = new Map(),
  ) {
    if (!enforceFormOwnershipRelocationPolicy) return false;
    const source = currentFormOwnershipInfo(targetExpression, env);
    if (!source.owned) return false;

    if (
      reportProgrammaticOwnershipSchedulingUncertainty(
        node,
        targetExpression,
        method,
        env,
      )
      || reportProgrammaticOwnershipControlFlowUncertainty(
        node,
        targetExpression,
        method,
        env,
      )
    ) return true;

    if (source.associationMode === "explicit") {
      return true;
    }

    const destination = relocationDestinationInfo(destinationExpression, env);
    if (source.owner && destination.owner && source.owner === destination.owner) {
      return true;
    }

    if (source.associationMode === "unknown") {
      report(node, "programmatic-ownership-relocation-dynamic", [method]);
      return true;
    }

    if (destination.owner) {
      report(node, "programmatic-ownership-reassociate", [method]);
      return true;
    }

    report(node, "programmatic-ownership-escape", [method]);
    return true;
  }

  function relocationTargetsForMethod(method, callExpression) {
    if (!callExpression || !ts.isCallExpression(callExpression)) return [];
    if (method === "append" || method === "prepend" || method === "replaceChildren") {
      return [...callExpression.arguments];
    }
    if (method === "appendChild" || method === "insertBefore") {
      return callExpression.arguments[0] ? [callExpression.arguments[0]] : [];
    }
    if (method === "replaceChild") {
      return callExpression.arguments[0] ? [callExpression.arguments[0]] : [];
    }
    return [];
  }

  function reportDirectFormOwnershipRelocation(callExpression, env = new Map()) {
    if (!enforceFormOwnershipRelocationPolicy || !ts.isCallExpression(callExpression)) {
      return false;
    }
    const callee = resolveDataExpression(callExpression.expression, env);
    if (
      !callee
      || !(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))
    ) return false;

    const method = propertyName(callee);
    if (
      !["append", "appendChild", "prepend", "insertBefore", "replaceChildren", "replaceChild"]
        .includes(method)
    ) return false;

    const destination = propertyOwner(callee);
    let handled = false;
    for (const target of relocationTargetsForMethod(method, callExpression)) {
      handled = (
        reportProgrammaticFormOwnershipRelocation(
          callExpression,
          target,
          destination,
          method,
          env,
        )
        || handled
      );
    }
    return handled;
  }

  function nativeDomOwnershipRelocationInfo(expression, env = new Map()) {
    if (!enforceFormOwnershipRelocationPolicy) return null;
    const resolved = resolveDataExpression(expression, env);
    if (
      !resolved
      || !(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
    ) return null;

    const method = propertyName(resolved);
    const owner = propertyOwner(resolved);
    if (!owner) return null;
    const ownerText = owner.getText(sourceFile);
    const elementPrototype = (
      ownerText === "Element.prototype"
      || ownerText === "globalThis.Element.prototype"
      || ownerText === "HTMLElement.prototype"
      || ownerText === "globalThis.HTMLElement.prototype"
      || Boolean(nativeDomPrototypeKind(owner, env))
    );
    const nodePrototype = (
      ownerText === "Node.prototype"
      || ownerText === "globalThis.Node.prototype"
      || elementPrototype
    );

    if (
      ["append", "prepend", "replaceChildren"].includes(method)
      && elementPrototype
    ) {
      return { method, targetIndexes: "all" };
    }
    if (
      ["appendChild", "insertBefore", "replaceChild"].includes(method)
      && nodePrototype
    ) {
      return { method, targetIndexes: [0] };
    }
    return null;
  }

  function nativeDomOwnershipLifecycleInfo(expression, env = new Map()) {
    if (!enforceFormOwnershipLifecyclePolicy) return null;
    const resolved = resolveDataExpression(expression, env);
    if (
      !resolved
      || !(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
    ) return null;

    const method = propertyName(resolved);
    const owner = propertyOwner(resolved);
    if (!owner) return null;
    const ownerText = owner.getText(sourceFile);
    const elementPrototype = (
      ownerText === "Element.prototype"
      || ownerText === "globalThis.Element.prototype"
      || ownerText === "HTMLElement.prototype"
      || ownerText === "globalThis.HTMLElement.prototype"
      || Boolean(nativeDomPrototypeKind(owner, env))
    );
    const nodePrototype = (
      ownerText === "Node.prototype"
      || ownerText === "globalThis.Node.prototype"
      || elementPrototype
    );

    if ((method === "remove" || method === "replaceWith") && elementPrototype) {
      return {
        method,
        lifecycleKind: method === "remove" ? "detach" : "replace",
        targetMode: "this",
        targetIndex: null,
      };
    }

    if ((method === "removeChild" || method === "replaceChild") && nodePrototype) {
      return {
        method,
        lifecycleKind: method === "removeChild" ? "detach" : "replace",
        targetMode: "argument",
        targetIndex: method === "removeChild" ? 0 : 1,
      };
    }

    return null;
  }

  function reportDirectFormOwnershipLifecycle(callExpression, env = new Map()) {
    if (!enforceFormOwnershipLifecyclePolicy || !ts.isCallExpression(callExpression)) {
      return false;
    }
    const callee = resolveDataExpression(callExpression.expression, env);
    if (
      !callee
      || !(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))
    ) return false;

    const method = propertyName(callee);
    const owner = propertyOwner(callee);
    if (!owner) return false;

    if (method === "remove" || method === "replaceWith") {
      return reportProgrammaticFormOwnershipLifecycle(
        callExpression,
        owner,
        method === "remove" ? "detach" : "replace",
        method,
        env,
      );
    }

    if (method !== "removeChild" && method !== "replaceChild") return false;
    const ownerKind = domNavigationElementKind(owner, env);
    const ownerIsGovernedContainer = (
      ownerKind === "form"
      || (
        ownerKind === "fieldset"
        && isCurrentFormOwnershipProof(owner, env)
      )
    );
    if (!ownerIsGovernedContainer) return false;

    const targetIndex = method === "removeChild" ? 0 : 1;
    const target = callExpression.arguments[targetIndex];
    return reportProgrammaticFormOwnershipLifecycle(
      callExpression,
      target,
      method === "removeChild" ? "detach" : "replace",
      method,
      env,
    );
  }

  function isBoundNavigationCapability(expression, env = new Map()) {
    const bound = boundCallableInfo(expression, env);
    if (!bound?.target) return false;
    const target = bound.target;
    return Boolean(
      nativeDomSetterInfo(target, env)
      || isDomSetAttributeReference(target, env)
      || isNativeDomSetAttributeReference(target, env)
      || isDomSetAttributeNSReference(target, env)
      || isNativeDomSetAttributeNSReference(target, env)
      || isDomToggleAttributeReference(target, env)
      || isNativeDomToggleAttributeReference(target, env)
      || isDomRemoveAttributeReference(target, env)
      || isNativeDomRemoveAttributeReference(target, env)
      || isDomRemoveAttributeNSReference(target, env)
      || isNativeDomRemoveAttributeNSReference(target, env)
      || isDomSetCustomValidityReference(target, env)
      || isNativeDomSetCustomValidityReference(target, env)
      || domActivationBinding(target, env)
      || nativeDomActivationInfo(target, env)
      || isDocumentHtmlWriteReference(target, env)
      || isInsertAdjacentHtmlReference(target, env)
      || isRouterTraversalReference(target, env)
      || isRouterMethodReference(target, env)
      || isServerRedirectReference(target, env)
      || isResponseRedirectReference(target, env)
      || isLocationHeaderMutationReference(target, env)
      || isBrowserLocationReloadReference(target, env)
      || isBrowserLocationMethodReference(target, env)
      || isBrowserHistoryTraversalReference(target, env)
      || isBrowserHistoryMethodReference(target, env)
      || isBrowserWindowOpenReference(target, env)
      || isBrowserNavigationTraversalReference(target, env)
      || isBrowserNavigationApiMethodReference(target, env)
    );
  }

  function isKnownNavigationCapabilityValue(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;

    return Boolean(
      isRouterObject(resolved, env)
      || isRouterMethodReference(resolved, env)
      || isRouterTraversalReference(resolved, env)
      || isBrowserLocationObject(resolved, env)
      || isBrowserLocationMethodReference(resolved, env)
      || isBrowserLocationReloadReference(resolved, env)
      || isBrowserHistoryObject(resolved, env)
      || isBrowserHistoryMethodReference(resolved, env)
      || isBrowserHistoryTraversalReference(resolved, env)
      || isBrowserNavigationApiObject(resolved, env)
      || isBrowserNavigationApiMethodReference(resolved, env)
      || isBrowserNavigationTraversalReference(resolved, env)
      || isBrowserWindowOpenReference(resolved, env)
      || isHeadersObject(resolved, env)
      || isLocationHeaderMutationReference(resolved, env)
      || domNavigationElementKind(resolved, env)
      || isDomSetAttributeReference(resolved, env)
      || isNativeDomSetAttributeReference(resolved, env)
      || isDomSetAttributeNSReference(resolved, env)
      || isNativeDomSetAttributeNSReference(resolved, env)
      || isDomToggleAttributeReference(resolved, env)
      || isNativeDomToggleAttributeReference(resolved, env)
      || isDomRemoveAttributeReference(resolved, env)
      || isNativeDomRemoveAttributeReference(resolved, env)
      || isDomRemoveAttributeNSReference(resolved, env)
      || isNativeDomRemoveAttributeNSReference(resolved, env)
      || isDomSetCustomValidityReference(resolved, env)
      || isNativeDomSetCustomValidityReference(resolved, env)
      || domActivationBinding(resolved, env)
      || nativeDomActivationInfo(resolved, env)
      || nativeDomSetterInfo(resolved, env)
      || isDocumentHtmlWriteReference(resolved, env)
      || isInsertAdjacentHtmlReference(resolved, env)
      || isServerRedirectReference(resolved, env)
      || isResponseRedirectReference(resolved, env)
      || isBoundNavigationCapability(resolved, env)
      || (
        ts.isIdentifier(resolved)
        && nextResponseBindings.has(resolved.text)
      )
      || isWebResponseObject(resolved, env)
    );
  }

  function proxyFactoryKind(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return null;

    if (ts.isIdentifier(resolved) && resolved.text === "Proxy") {
      return "constructor";
    }
    if (resolved.getText(sourceFile) === "globalThis.Proxy") {
      return "constructor";
    }

    if (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved)) {
      const ownerText = propertyOwner(resolved)?.getText(sourceFile);
      if (
        propertyName(resolved) === "revocable"
        && (ownerText === "Proxy" || ownerText === "globalThis.Proxy")
      ) {
        return "revocable";
      }
    }

    return null;
  }

  function proxyNavigationCapabilityTarget(node, env = new Map()) {
    if (ts.isNewExpression(node)) {
      if (proxyFactoryKind(node.expression, env) !== "constructor") return null;
      const target = node.arguments?.[0];
      return target && isKnownNavigationCapabilityValue(target, env) ? target : null;
    }

    if (ts.isCallExpression(node)) {
      if (proxyFactoryKind(node.expression, env) !== "revocable") return null;
      const target = node.arguments[0];
      return target && isKnownNavigationCapabilityValue(target, env) ? target : null;
    }

    return null;
  }

  function isEvalReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && resolved.text === "eval") return true;
    if (
      ts.isBinaryExpression(resolved)
      && resolved.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      return isEvalReference(resolved.right, env);
    }
    const text = resolved.getText(sourceFile);
    return text === "globalThis.eval" || text === "window.eval";
  }

  function isFunctionConstructorReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;

    if (ts.isIdentifier(resolved) && resolved.text === "Function") return true;
    if (
      ts.isBinaryExpression(resolved)
      && resolved.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      return isFunctionConstructorReference(resolved.right, env);
    }
    const text = resolved.getText(sourceFile);
    if (text === "globalThis.Function" || text === "window.Function") return true;

    if (
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "constructor"
    ) {
      const owner = resolveDataExpression(propertyOwner(resolved), env);
      if (!owner) return false;
      if (ts.isArrowFunction(owner) || ts.isFunctionExpression(owner)) return true;
      if (
        ts.isIdentifier(owner)
        && localFunctions.has(owner.text)
        && localFunctions.get(owner.text)
      ) return true;
    }

    return false;
  }

  function dynamicCodeTimerKind(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return null;

    if (ts.isIdentifier(resolved)) {
      if (resolved.text === "setTimeout" || resolved.text === "setInterval") {
        return resolved.text;
      }
      return null;
    }

    if (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved)) {
      const method = propertyName(resolved);
      const ownerText = propertyOwner(resolved)?.getText(sourceFile);
      if (
        (method === "setTimeout" || method === "setInterval")
        && (
          ownerText === "window"
          || ownerText === "globalThis"
        )
      ) return method;
    }

    return null;
  }

  function isCodeStringExpression(expression, env = new Map(), seen = new Set()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;

    const key = resolved.pos + ":" + resolved.end;
    if (seen.has(key)) return false;
    const nextSeen = new Set(seen);
    nextSeen.add(key);

    if (ts.isStringLiteralLike(resolved) || ts.isTemplateExpression(resolved)) return true;
    if (
      ts.isBinaryExpression(resolved)
      && resolved.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      return (
        isCodeStringExpression(resolved.left, env, nextSeen)
        || isCodeStringExpression(resolved.right, env, nextSeen)
      );
    }
    return false;
  }

  function isReflectConstructReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (
      !resolved
      || !(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      || propertyName(resolved) !== "construct"
    ) return false;
    const ownerText = propertyOwner(resolved)?.getText(sourceFile);
    return ownerText === "Reflect" || ownerText === "globalThis.Reflect";
  }

  function boundDynamicCodeInfo(expression, env = new Map()) {
    const bound = boundCallableInfo(expression, env);
    if (!bound?.target) return null;
    if (
      isEvalReference(bound.target, env)
      || isFunctionConstructorReference(bound.target, env)
    ) return bound;

    if (
      dynamicCodeTimerKind(bound.target, env)
      && isCodeStringExpression(bound.args[0], env)
    ) return bound;

    return null;
  }

  function isDynamicCodeCapabilityValue(expression, env = new Map()) {
    return Boolean(
      isEvalReference(expression, env)
      || isFunctionConstructorReference(expression, env)
      || boundDynamicCodeInfo(expression, env)
    );
  }

  function isProjectImportCallee(callee, env = new Map()) {
    const resolved = resolveDataExpression(callee, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved)) return projectImportBindings.has(resolved.text);
    if (
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyOwner(resolved)
      && ts.isIdentifier(propertyOwner(resolved))
    ) {
      return projectImportNamespaces.has(propertyOwner(resolved).text);
    }
    return false;
  }

  function containsUnprovenProjectImportCall(
    expression,
    env = new Map(),
    callStack = new Set(),
    seen = new Set(),
  ) {
    if (!expression) return false;
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;

    const positionKey = resolved.pos + ":" + resolved.end;
    if (seen.has(positionKey)) return false;
    const nextSeen = new Set(seen);
    nextSeen.add(positionKey);

    if (
      authorityCall(resolved, navigationBindings)
      || authorityCall(resolved, productHrefBindings)
      || authorityCall(resolved, externalHrefBindings)
    ) {
      return false;
    }

    if (ts.isCallExpression(resolved)) {
      const definition = localFunctionFromCallee(resolved.expression, env);
      if (definition && !callStack.has(definition.key)) {
        const nextStack = new Set(callStack);
        nextStack.add(definition.key);
        const childEnv = functionEnvironment(definition, resolved, env);
        return functionReturnExpressions(definition)
          .some((candidate) => containsUnprovenProjectImportCall(
            candidate,
            childEnv,
            nextStack,
            nextSeen,
          ));
      }

      if (isProjectImportCallee(resolved.expression, env)) return true;
      return resolved.arguments.some((argument) => (
        containsUnprovenProjectImportCall(argument, env, callStack, nextSeen)
      ));
    }

    if (ts.isConditionalExpression(resolved)) {
      return containsUnprovenProjectImportCall(resolved.whenTrue, env, callStack, nextSeen)
        || containsUnprovenProjectImportCall(resolved.whenFalse, env, callStack, nextSeen);
    }

    if (ts.isNewExpression(resolved)) {
      return Boolean(resolved.arguments?.some((argument) => (
        containsUnprovenProjectImportCall(argument, env, callStack, nextSeen)
      )));
    }

    if (ts.isBinaryExpression(resolved)) {
      return containsUnprovenProjectImportCall(resolved.left, env, callStack, nextSeen)
        || containsUnprovenProjectImportCall(resolved.right, env, callStack, nextSeen);
    }

    return false;
  }

  function browserNavigationAuthority(expression, env = new Map(), callStack = new Set()) {
    return authorityExpressionResolved(expression, navigationBindings, env, callStack)
      || authorityExpressionResolved(expression, externalHrefBindings, env, callStack);
  }

  function domNavigationAuthority(expression, env = new Map(), callStack = new Set()) {
    return authorityExpressionResolved(expression, navigationBindings, env, callStack)
      || authorityExpressionResolved(expression, productHrefBindings, env, callStack)
      || authorityExpressionResolved(expression, externalHrefBindings, env, callStack);
  }

  function isDocumentHtmlWriteReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (!(ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))) {
      return false;
    }
    const method = propertyName(resolved);
    if (method !== "write" && method !== "writeln") return false;
    const ownerText = propertyOwner(resolved)?.getText(sourceFile);
    return (
      ownerText === "document"
      || ownerText === "window.document"
      || ownerText === "globalThis.document"
    );
  }

  function isInsertAdjacentHtmlReference(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    return Boolean(
      resolved
      && (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "insertAdjacentHTML"
    );
  }

  function isBrowserHrefAssignmentTarget(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (isBrowserLocationObject(resolved, env)) return true;
    if (ts.isPropertyAccessExpression(resolved)) {
      return resolved.name.text === "href" && isBrowserLocationObject(resolved.expression, env);
    }
    if (
      ts.isElementAccessExpression(resolved)
      && resolved.argumentExpression
      && ts.isStringLiteralLike(resolved.argumentExpression)
      && resolved.argumentExpression.text === "href"
    ) {
      return isBrowserLocationObject(resolved.expression, env);
    }
    return false;
  }

  function propertyAssignmentByName(objectLiteral, name) {
    if (!objectLiteral || !ts.isObjectLiteralExpression(objectLiteral)) return null;
    for (const property of objectLiteral.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const propertyNameNode = property.name;
      let propertyText = null;
      if (ts.isIdentifier(propertyNameNode)) propertyText = propertyNameNode.text;
      else if (ts.isStringLiteralLike(propertyNameNode)) propertyText = propertyNameNode.text;
      if (propertyText?.toLowerCase() === name.toLowerCase()) return property.initializer;
    }
    return null;
  }

  function staticObjectPropertyName(property, env = new Map()) {
    if (!property) return null;
    if (ts.isIdentifier(property.name)) return property.name.text;
    if (ts.isStringLiteralLike(property.name) || ts.isNumericLiteral(property.name)) {
      return property.name.text;
    }
    if (ts.isComputedPropertyName(property.name)) {
      const expression = resolveDataExpression(property.name.expression, env);
      return expression && ts.isStringLiteralLike(expression) ? expression.text : null;
    }
    return null;
  }

  function reflectiveObjectPropertyValue(property) {
    if (ts.isPropertyAssignment(property)) return property.initializer;
    if (ts.isShorthandPropertyAssignment(property)) return property.name;
    return null;
  }

  function reflectiveCalleeName(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!(resolved && (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved)))) {
      return null;
    }
    const ownerText = propertyOwner(resolved)?.getText(sourceFile);
    const method = propertyName(resolved);
    if (ownerText === "Object" || ownerText === "globalThis.Object") {
      if (method === "assign" || method === "defineProperty" || method === "defineProperties") {
        return "Object." + method;
      }
    }
    if ((ownerText === "Reflect" || ownerText === "globalThis.Reflect") && method === "set") {
      return "Reflect.set";
    }
    return null;
  }

  function descriptorNavigationValue(descriptor, env = new Map()) {
    const resolved = resolveDataExpression(descriptor, env);
    if (!resolved || !ts.isObjectLiteralExpression(resolved)) return null;
    if (
      propertyAssignmentByName(resolved, "get")
      || propertyAssignmentByName(resolved, "set")
    ) return null;
    return propertyAssignmentByName(resolved, "value");
  }

  function reportReflectiveDomProperty(
    node,
    targetExpression,
    kind,
    propertyNameText,
    value,
    env,
    callStack,
  ) {
    if (
      reportProgrammaticFormParticipationMutation(
        node,
        targetExpression,
        kind,
        propertyNameText,
        value,
        env,
      )
    ) return true;

    if (
      reportProgrammaticFormConstraintMutation(
        node,
        kind,
        propertyNameText,
        value,
        env,
      )
    ) return true;

    if (
      reportProgrammaticFormValidationBypass(
        node,
        kind,
        propertyNameText,
        value,
        env,
      )
    ) return true;

    if (
      reportProgrammaticDomSubmissionTransport(
        node,
        kind,
        propertyNameText,
        value,
        env,
      )
    ) return true;

    if (
      reportProgrammaticDomTarget(
        node,
        kind,
        propertyNameText,
        value,
        env,
      )
    ) return true;

    const navProperty = domNavigationPropertyForKind(kind, propertyNameText);
    if (!navProperty) return false;
    if (kind === "base" && navProperty === "href") {
      report(node, "dom-base-href");
      return true;
    }
    if (isEmbeddedInlineDocumentProperty(kind, navProperty)) {
      report(node, "embedded-runtime-srcdoc");
      return true;
    }
    if (!value || !domNavigationAuthority(value, env, callStack)) {
      const targets = value ? staticHrefCandidatesResolved(value, env, callStack) : [];
      report(
        node,
        isEmbeddedContextKind(kind) ? "embedded-runtime-source" : "dom-reflective-property",
        targets,
      );
    }
    return true;
  }

  function numericLiteralValue(expression) {
    const resolved = resolveDataExpression(expression);
    if (resolved && ts.isNumericLiteral(resolved)) return Number(resolved.text);
    return null;
  }

  function headersConstructorLocationTargets(node, env = new Map()) {
    if (!ts.isNewExpression(node)) return [];
    const constructorText = resolveDataExpression(node.expression, env)?.getText(sourceFile);
    if (constructorText !== "Headers" && constructorText !== "globalThis.Headers") return [];

    const init = resolveDataExpression(node.arguments?.[0], env);
    if (!init) return [];

    if (ts.isObjectLiteralExpression(init)) {
      const target = propertyAssignmentByName(init, "location");
      return target ? [target] : [];
    }

    if (ts.isArrayLiteralExpression(init)) {
      const targets = [];
      for (const element of init.elements) {
        if (!ts.isArrayLiteralExpression(element) || element.elements.length < 2) continue;
        const headerName = resolveDataExpression(element.elements[0], env);
        if (
          headerName
          && ts.isStringLiteralLike(headerName)
          && headerName.text.toLowerCase() === "location"
        ) {
          targets.push(element.elements[1]);
        }
      }
      return targets;
    }

    return [];
  }

  function responseConstructorLocationTarget(node, env = new Map()) {
    if (!ts.isNewExpression(node)) return null;
    const constructor = resolveDataExpression(node.expression, env);
    if (!constructor) return null;

    const constructorIsWebResponse = isWebResponseObject(constructor, env);
    const constructorIsNextResponse = (
      ts.isIdentifier(constructor)
      && nextResponseBindings.has(constructor.text)
    );
    if (!constructorIsWebResponse && !constructorIsNextResponse) return null;

    const init = node.arguments?.[1];
    const resolvedInit = resolveDataExpression(init, env);
    if (!resolvedInit || !ts.isObjectLiteralExpression(resolvedInit)) return null;

    const status = numericLiteralValue(propertyAssignmentByName(resolvedInit, "status"));
    if (status === null || status < 300 || status > 399) return null;

    const headers = resolveDataExpression(
      propertyAssignmentByName(resolvedInit, "headers"),
      env,
    );
    if (!headers || !ts.isObjectLiteralExpression(headers)) return null;
    return propertyAssignmentByName(headers, "location");
  }

  function report(node, kind, targets = []) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const uniqueTargets = [...new Set(targets)];
    const key = [kind, position.line + 1, position.character + 1, uniqueTargets.join(",")].join(":");
    if (reportedViolations.has(key)) return;
    reportedViolations.add(key);
    violations.push({
      kind,
      path,
      line: position.line + 1,
      column: position.character + 1,
      targets: uniqueTargets,
    });
  }

  function visitProgrammaticOwnershipChildren(
    node,
    env,
    callStack,
    visitChild,
  ) {
    if (
      enforceProgrammaticFormOwnershipExecutionScopePolicy
      && ts.isFunctionLike(node)
    ) {
      const snapshot = cloneProgrammaticOwnershipStates();
      programmaticOwnershipExecutionSuppressionDepth += 1;
      try {
        ts.forEachChild(node, (child) => visitChild(child, env, callStack));
      } finally {
        programmaticOwnershipExecutionSuppressionDepth -= 1;
        restoreProgrammaticOwnershipStates(snapshot);
      }
      return;
    }

    if (!enforceProgrammaticFormOwnershipControlFlowPolicy) {
      ts.forEachChild(node, (child) => visitChild(child, env, callStack));
      return;
    }

    if (ts.isIfStatement(node)) {
      visitChild(node.expression, env, callStack);
      const base = cloneProgrammaticOwnershipStates();

      restoreProgrammaticOwnershipStates(base);
      visitChild(node.thenStatement, env, callStack);
      const thenState = cloneProgrammaticOwnershipStates();

      restoreProgrammaticOwnershipStates(base);
      if (node.elseStatement) {
        visitChild(node.elseStatement, env, callStack);
      }
      const elseState = cloneProgrammaticOwnershipStates();

      mergeProgrammaticOwnershipStateSnapshots([thenState, elseState]);
      return;
    }

    if (ts.isConditionalExpression(node)) {
      visitChild(node.condition, env, callStack);
      const base = cloneProgrammaticOwnershipStates();

      restoreProgrammaticOwnershipStates(base);
      visitChild(node.whenTrue, env, callStack);
      const trueState = cloneProgrammaticOwnershipStates();

      restoreProgrammaticOwnershipStates(base);
      visitChild(node.whenFalse, env, callStack);
      const falseState = cloneProgrammaticOwnershipStates();

      mergeProgrammaticOwnershipStateSnapshots([trueState, falseState]);
      return;
    }

    if (
      ts.isBinaryExpression(node)
      && (
        node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        || node.operatorToken.kind === ts.SyntaxKind.BarBarToken
        || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      )
    ) {
      visitChild(node.left, env, callStack);
      const skippedRightState = cloneProgrammaticOwnershipStates();

      restoreProgrammaticOwnershipStates(skippedRightState);
      visitChild(node.right, env, callStack);
      const evaluatedRightState = cloneProgrammaticOwnershipStates();

      mergeProgrammaticOwnershipStateSnapshots([
        skippedRightState,
        evaluatedRightState,
      ]);
      return;
    }

    ts.forEachChild(node, (child) => visitChild(child, env, callStack));
  }

  function visit(node, env = new Map(), callStack = new Set()) {
    registerProgrammaticOwnershipDeclaration(node, env);

    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const firstArg = node.arguments[0];

      reportDirectFormOwnershipLifecycle(node, env);
      reportDirectFormOwnershipRelocation(node, env);
      if (enforceProgrammaticFormOwnershipStatePolicy) {
        const directOwnershipCallee = resolveDataExpression(node.expression, env);
        if (
          directOwnershipCallee
          && (
            ts.isPropertyAccessExpression(directOwnershipCallee)
            || ts.isElementAccessExpression(directOwnershipCallee)
          )
          && propertyName(directOwnershipCallee) === "replaceChildren"
        ) {
          reportProgrammaticOwnershipStateEviction(
            node,
            propertyOwner(directOwnershipCallee),
            [...node.arguments],
            "replaceChildren",
            env,
          );
        }
      }

      if (isEvalReference(expression, env)) {
        report(node, "dynamic-code-eval");
      }

      if (isFunctionConstructorReference(expression, env)) {
        report(node, "dynamic-code-function-constructor");
      }

      if (
        dynamicCodeTimerKind(expression, env)
        && isCodeStringExpression(firstArg, env)
      ) {
        report(node, "dynamic-code-string-timer");
      }

      if (isReflectConstructReference(expression, env)) {
        const constructorTarget = node.arguments[0];
        if (
          isFunctionConstructorReference(constructorTarget, env)
          || boundDynamicCodeInfo(constructorTarget, env)
        ) {
          report(node, "dynamic-code-function-constructor");
        }
      }

      if (boundDynamicCodeInfo(node, env)) {
        report(node, "dynamic-code-bound-capability");
      }

      const proxyKind = proxyFactoryKind(expression, env);
      if (
        proxyKind === "revocable"
        && isDynamicCodeCapabilityValue(firstArg, env)
      ) {
        report(node, "dynamic-code-proxy-capability");
      }

      if (
        isProjectImportCallee(expression, env)
        && node.arguments.some((argument) => isDynamicCodeCapabilityValue(argument, env))
      ) {
        report(node, "dynamic-code-capability-export");
      }

      if (proxyNavigationCapabilityTarget(node, env)) {
        report(node, "proxy-navigation-capability");
      }

      const indirectInvocation = indirectInvocationInfo(node, env);
      if (indirectInvocation) {
        const indirectTarget = indirectInvocation.target;
        const indirectArgs = indirectInvocation.args;
        const indirectFirstArg = indirectArgs[0];

        if (isEvalReference(indirectTarget, env)) {
          report(node, "dynamic-code-indirect-eval");
        }
        if (isFunctionConstructorReference(indirectTarget, env)) {
          report(node, "dynamic-code-indirect-function");
        }
        if (
          dynamicCodeTimerKind(indirectTarget, env)
          && isCodeStringExpression(indirectFirstArg, env)
        ) {
          report(node, "dynamic-code-string-timer");
        }

        const indirectThisKind = domNavigationElementKind(indirectInvocation.thisArg, env);
        const nativeSetter = nativeDomSetterInfo(indirectTarget, env);
        const setAttributeCapability = (
          isDomSetAttributeReference(indirectTarget, env)
          || isNativeDomSetAttributeReference(indirectTarget, env)
        );
        const setAttributeNSCapability = (
          isDomSetAttributeNSReference(indirectTarget, env)
          || isNativeDomSetAttributeNSReference(indirectTarget, env)
        );
        const toggleAttributeCapability = (
          isDomToggleAttributeReference(indirectTarget, env)
          || isNativeDomToggleAttributeReference(indirectTarget, env)
        );
        const removeAttributeCapability = (
          isDomRemoveAttributeReference(indirectTarget, env)
          || isNativeDomRemoveAttributeReference(indirectTarget, env)
        );
        const removeAttributeNSCapability = (
          isDomRemoveAttributeNSReference(indirectTarget, env)
          || isNativeDomRemoveAttributeNSReference(indirectTarget, env)
        );
        const setCustomValidityCapability = (
          isDomSetCustomValidityReference(indirectTarget, env)
          || isNativeDomSetCustomValidityReference(indirectTarget, env)
        );
        const activationCapability = (
          domActivationBinding(indirectTarget, env)
          || nativeDomActivationInfo(indirectTarget, env)
        );
        const ownershipLifecycleCapability = nativeDomOwnershipLifecycleInfo(
          indirectTarget,
          env,
        );
        const ownershipRelocationCapability = nativeDomOwnershipRelocationInfo(
          indirectTarget,
          env,
        );

        if (
          ownershipRelocationCapability?.method === "replaceChildren"
          && !indirectInvocation.dynamic
        ) {
          reportProgrammaticOwnershipStateEviction(
            node,
            indirectInvocation.thisArg,
            indirectArgs,
            "replaceChildren",
            env,
          );
        }

        const indirectRecognized = Boolean(
          nativeSetter
          || setAttributeCapability
          || setAttributeNSCapability
          || toggleAttributeCapability
          || removeAttributeCapability
          || removeAttributeNSCapability
          || setCustomValidityCapability
          || activationCapability
          || ownershipLifecycleCapability
          || ownershipRelocationCapability
          || isDocumentHtmlWriteReference(indirectTarget, env)
          || isInsertAdjacentHtmlReference(indirectTarget, env)
          || isRouterTraversalReference(indirectTarget, env)
          || isRouterMethodReference(indirectTarget, env)
          || isServerRedirectReference(indirectTarget, env)
          || isResponseRedirectReference(indirectTarget, env)
          || isLocationHeaderMutationReference(indirectTarget, env)
          || isBrowserLocationReloadReference(indirectTarget, env)
          || isBrowserLocationMethodReference(indirectTarget, env)
          || isBrowserHistoryTraversalReference(indirectTarget, env)
          || isBrowserHistoryMethodReference(indirectTarget, env)
          || isBrowserWindowOpenReference(indirectTarget, env)
          || isBrowserNavigationTraversalReference(indirectTarget, env)
          || isBrowserNavigationApiMethodReference(indirectTarget, env)
        );

        if (indirectInvocation.dynamic && indirectRecognized) {
          report(node, "native-invoke-dynamic-arguments");
        } else if (!indirectInvocation.dynamic) {
          if (ownershipRelocationCapability) {
            const targetIndexes = ownershipRelocationCapability.targetIndexes === "all"
              ? indirectArgs.map((_, index) => index)
              : ownershipRelocationCapability.targetIndexes;
            for (const index of targetIndexes) {
              const target = indirectArgs[index];
              if (!target) continue;
              reportProgrammaticFormOwnershipRelocation(
                node,
                target,
                indirectInvocation.thisArg,
                ownershipRelocationCapability.method,
                env,
              );
            }
          }

          if (ownershipLifecycleCapability) {
            const lifecycleTarget = (
              ownershipLifecycleCapability.targetMode === "this"
                ? indirectInvocation.thisArg
                : indirectArgs[ownershipLifecycleCapability.targetIndex]
            );
            reportProgrammaticFormOwnershipLifecycle(
              node,
              lifecycleTarget,
              ownershipLifecycleCapability.lifecycleKind,
              ownershipLifecycleCapability.method,
              env,
            );
          }

          if (activationCapability) {
            const actualKind = indirectThisKind;
            const expectedKind = activationCapability.kind;
            const method = activationCapability.method;
            const validClickKinds = ["a", "area", "button", "input"];

            if (!actualKind) {
              if (!activationCapability.generic) {
                report(node, "native-invoke-dom-dynamic-target");
              }
            } else if (
              method === "submit"
              && actualKind === "form"
              && (!expectedKind || expectedKind === "form")
            ) {
              if (enforceFormValidationBypassPolicy) {
                report(node, "programmatic-validation-submit");
              } else {
                report(node, "native-invoke-dom-activation");
              }
            } else if (
              method === "requestSubmit"
              && actualKind === "form"
              && (!expectedKind || expectedKind === "form")
            ) {
              if (
                enforceFormValidationBypassPolicy
                && indirectArgs.length > 0
              ) {
                report(node, "programmatic-validation-submitter");
              } else {
                report(node, "native-invoke-dom-activation");
              }
            } else if (
              method === "click"
              && validClickKinds.includes(actualKind)
              && (!expectedKind || expectedKind === actualKind || activationCapability.generic)
            ) {
              report(node, "native-invoke-dom-activation");
            }
          }

          if (nativeSetter) {
            if (!indirectThisKind) {
              report(node, "native-invoke-dom-dynamic-target");
            } else if (indirectThisKind === nativeSetter.kind) {
              if (
                nativeSetter.participationIntegrity
                && reportProgrammaticFormParticipationMutation(
                  node,
                  indirectInvocation.thisArg,
                  nativeSetter.kind,
                  nativeSetter.property,
                  indirectFirstArg,
                  env,
                )
              ) {
                // Form control participation policy handled above.
              } else if (
                nativeSetter.constraintIntegrity
                && reportProgrammaticFormConstraintMutation(
                  node,
                  nativeSetter.kind,
                  nativeSetter.property,
                  indirectFirstArg,
                  env,
                )
              ) {
                // Form constraint integrity policy handled above.
              } else if (
                nativeSetter.validationBypass
                && reportProgrammaticFormValidationBypass(
                  node,
                  nativeSetter.kind,
                  nativeSetter.property,
                  indirectFirstArg,
                  env,
                )
              ) {
                // Form validation bypass policy handled above.
              } else if (
                nativeSetter.submissionTransport
                && reportProgrammaticDomSubmissionTransport(
                  node,
                  nativeSetter.kind,
                  nativeSetter.property,
                  indirectFirstArg,
                  env,
                )
              ) {
                // Form submission transport policy handled above.
              } else if (
                nativeSetter.targetContext
                && reportProgrammaticDomTarget(
                  node,
                  nativeSetter.kind,
                  nativeSetter.property,
                  indirectFirstArg,
                  env,
                )
              ) {
                // Target-context policy handled above.
              } else if (nativeSetter.kind === "base" && nativeSetter.property === "href") {
                report(node, "native-invoke-dom-base-href");
              } else if (
                isEmbeddedInlineDocumentProperty(nativeSetter.kind, nativeSetter.property)
              ) {
                report(node, "embedded-runtime-srcdoc");
              } else if (
                !indirectFirstArg
                || !domNavigationAuthority(indirectFirstArg, env, callStack)
              ) {
                const targets = indirectFirstArg
                  ? staticHrefCandidatesResolved(indirectFirstArg, env, callStack)
                  : [];
                report(
                  node,
                  isEmbeddedContextKind(nativeSetter.kind)
                    ? "embedded-runtime-source"
                    : "native-invoke-dom-setter",
                  targets,
                );
              }
            }
          }

          if (setCustomValidityCapability) {
            if (!indirectThisKind) {
              report(node, "native-invoke-dom-dynamic-target");
            } else {
              reportProgrammaticCustomValidityMutation(
                node,
                indirectInvocation.thisArg,
                indirectThisKind,
                indirectFirstArg,
                env,
              );
            }
          }

          if (setAttributeNSCapability) {
            if (!indirectThisKind) {
              report(node, "native-invoke-dom-dynamic-target");
            } else {
              const namespace = standardAttributeNamespace(indirectArgs[0], env);
              const attributeName = resolveDataExpression(indirectArgs[1], env);
              const target = indirectArgs[2];
              if (namespace === "dynamic") {
                report(node, "native-invoke-dom-dynamic-attribute");
              } else if (
                namespace === "standard"
                && (!attributeName || !ts.isStringLiteralLike(attributeName))
              ) {
                report(node, "native-invoke-dom-dynamic-attribute");
              } else if (namespace === "standard") {
                const constraintProperty = domConstraintPropertyForKind(
                  indirectThisKind,
                  attributeName.text,
                );
                const validationBypassProperty = domValidationBypassPropertyForKind(
                  indirectThisKind,
                  attributeName.text,
                );
                if (
                  reportProgrammaticFormParticipationMutation(
                    node,
                    indirectInvocation.thisArg,
                    indirectThisKind,
                    attributeName.text,
                    target,
                    env,
                    "set-attribute",
                  )
                ) {
                  // Standard-namespace form participation mutation handled above.
                } else if (
                  constraintProperty
                  && reportProgrammaticFormConstraintMutation(
                    node,
                    indirectThisKind,
                    constraintProperty,
                    target,
                    env,
                    "set-attribute",
                  )
                ) {
                  // Standard-namespace form constraint mutation handled above.
                } else if (
                  validationBypassProperty
                  && reportProgrammaticFormValidationBypass(
                    node,
                    indirectThisKind,
                    validationBypassProperty,
                    target,
                    env,
                    true,
                  )
                ) {
                  // Standard-namespace boolean validation attributes are enabled by presence.
                }
              }
            }
          }

          if (toggleAttributeCapability) {
            if (!indirectThisKind) {
              report(node, "native-invoke-dom-dynamic-target");
            } else {
              const attributeName = resolveDataExpression(indirectArgs[0], env);
              if (!attributeName || !ts.isStringLiteralLike(attributeName)) {
                report(node, "native-invoke-dom-dynamic-attribute");
              } else {
                const constraintProperty = domConstraintPropertyForKind(
                  indirectThisKind,
                  attributeName.text,
                );
                const validationBypassProperty = domValidationBypassPropertyForKind(
                  indirectThisKind,
                  attributeName.text,
                );
                if (
                  reportProgrammaticFormParticipationMutation(
                    node,
                    indirectInvocation.thisArg,
                    indirectThisKind,
                    attributeName.text,
                    indirectArgs[1],
                    env,
                    "toggle-attribute",
                  )
                ) {
                  // Form participation toggle handled above.
                } else if (
                  constraintProperty
                  && reportProgrammaticFormConstraintMutation(
                    node,
                    indirectThisKind,
                    constraintProperty,
                    indirectArgs[1],
                    env,
                    "toggle-attribute",
                  )
                ) {
                  // Form constraint toggle handled above.
                } else if (
                  validationBypassProperty
                  && reportProgrammaticFormValidationToggle(
                    node,
                    indirectThisKind,
                    validationBypassProperty,
                    indirectArgs[1],
                    env,
                  )
                ) {
                  // Form validation toggle policy handled above.
                }
              }
            }
          }

          if (removeAttributeNSCapability) {
            if (!indirectThisKind) {
              report(node, "native-invoke-dom-dynamic-target");
            } else {
              const namespace = standardAttributeNamespace(indirectArgs[0], env);
              const attributeName = resolveDataExpression(indirectArgs[1], env);
              if (namespace === "dynamic") {
                report(node, "native-invoke-dom-dynamic-attribute");
              } else if (
                namespace === "standard"
                && (!attributeName || !ts.isStringLiteralLike(attributeName))
              ) {
                report(node, "native-invoke-dom-dynamic-attribute");
              } else if (namespace === "standard") {
                if (
                  !reportProgrammaticFormParticipationMutation(
                    node,
                    indirectInvocation.thisArg,
                    indirectThisKind,
                    attributeName.text,
                    null,
                    env,
                    "remove-attribute",
                  )
                ) {
                  reportProgrammaticFormConstraintMutation(
                    node,
                    indirectThisKind,
                    attributeName.text,
                    null,
                    env,
                    "remove-attribute",
                  );
                }
              }
            }
          }

          if (removeAttributeCapability) {
            if (!indirectThisKind) {
              report(node, "native-invoke-dom-dynamic-target");
            } else {
              const attributeName = resolveDataExpression(indirectArgs[0], env);
              if (!attributeName || !ts.isStringLiteralLike(attributeName)) {
                report(node, "native-invoke-dom-dynamic-attribute");
              } else {
                if (
                  !reportProgrammaticFormParticipationMutation(
                    node,
                    indirectInvocation.thisArg,
                    indirectThisKind,
                    attributeName.text,
                    null,
                    env,
                    "remove-attribute",
                  )
                ) {
                  reportProgrammaticFormConstraintMutation(
                    node,
                    indirectThisKind,
                    attributeName.text,
                    null,
                    env,
                    "remove-attribute",
                  );
                }
              }
            }
          }

          if (setAttributeCapability) {
            if (!indirectThisKind) {
              report(node, "native-invoke-dom-dynamic-target");
            } else {
              const attributeName = resolveDataExpression(indirectFirstArg, env);
              const target = indirectArgs[1];
              if (!attributeName || !ts.isStringLiteralLike(attributeName)) {
                report(node, "native-invoke-dom-dynamic-attribute");
              } else {
                const constraintProperty = domConstraintPropertyForKind(
                  indirectThisKind,
                  attributeName.text,
                );
                const validationBypassProperty = domValidationBypassPropertyForKind(
                  indirectThisKind,
                  attributeName.text,
                );
                const submissionTransportProperty = domSubmissionTransportPropertyForKind(
                  indirectThisKind,
                  attributeName.text,
                );
                const targetContextProperty = domTargetContextPropertyForKind(
                  indirectThisKind,
                  attributeName.text,
                );
                const navProperty = domNavigationPropertyForKind(
                  indirectThisKind,
                  attributeName.text,
                );
                if (
                  reportProgrammaticFormParticipationMutation(
                    node,
                    indirectInvocation.thisArg,
                    indirectThisKind,
                    attributeName.text,
                    target,
                    env,
                    "set-attribute",
                  )
                ) {
                  // Form participation attribute mutation handled above.
                } else if (
                  constraintProperty
                  && reportProgrammaticFormConstraintMutation(
                    node,
                    indirectThisKind,
                    constraintProperty,
                    target,
                    env,
                    "set-attribute",
                  )
                ) {
                  // Form constraint attribute mutation handled above.
                } else if (
                  validationBypassProperty
                  && reportProgrammaticFormValidationBypass(
                    node,
                    indirectThisKind,
                    validationBypassProperty,
                    target,
                    env,
                    true,
                  )
                ) {
                  // Boolean validation-bypass attributes are enabled by presence.
                } else if (
                  submissionTransportProperty
                  && reportProgrammaticDomSubmissionTransport(
                    node,
                    indirectThisKind,
                    submissionTransportProperty,
                    target,
                    env,
                  )
                ) {
                  // Form submission transport policy handled above.
                } else if (
                  targetContextProperty
                  && reportProgrammaticDomTarget(
                    node,
                    indirectThisKind,
                    targetContextProperty,
                    target,
                    env,
                  )
                ) {
                  // Target-context policy handled above.
                } else if (indirectThisKind === "base" && navProperty === "href") {
                  report(node, "native-invoke-dom-base-href");
                } else if (
                  isEmbeddedInlineDocumentProperty(indirectThisKind, navProperty)
                ) {
                  report(node, "embedded-runtime-srcdoc");
                } else if (
                  navProperty
                  && (!target || !domNavigationAuthority(target, env, callStack))
                ) {
                  const targets = target
                    ? staticHrefCandidatesResolved(target, env, callStack)
                    : [];
                  report(
                    node,
                    isEmbeddedContextKind(indirectThisKind)
                      ? "embedded-runtime-source"
                      : "native-invoke-dom-attribute",
                    targets,
                  );
                }
              }
            }
          }

          if (
            isDocumentHtmlWriteReference(indirectTarget, env)
            || isInsertAdjacentHtmlReference(indirectTarget, env)
          ) {
            report(node, "native-invoke-dom-html");
          }

          if (isRouterTraversalReference(indirectTarget, env)) {
            report(node, "native-invoke-router-traversal");
          }

          if (
            isRouterMethodReference(indirectTarget, env)
            && !authorityExpressionResolved(
              indirectFirstArg,
              navigationBindings,
              env,
              callStack,
            )
          ) {
            report(node, "native-invoke-router");
          }

          if (isServerRedirectReference(indirectTarget, env)) {
            const targets = staticHrefCandidatesResolved(
              indirectFirstArg,
              env,
              callStack,
            ).map(normalizedProductRoute).filter(Boolean);
            const authoritative = (
              authorityExpressionResolved(indirectFirstArg, navigationBindings, env, callStack)
              || authorityExpressionResolved(indirectFirstArg, productHrefBindings, env, callStack)
            );
            if (targets.length > 0 && !authoritative) {
              report(node, "native-invoke-server-redirect", targets);
            } else if (
              !authoritative
              && containsUnprovenProjectImportCall(indirectFirstArg, env, callStack)
            ) {
              report(node, "native-invoke-cross-module-destination");
            }
          }

          if (isResponseRedirectReference(indirectTarget, env)) {
            const targetExpressions = routeRedirectTargetExpressions(
              indirectFirstArg,
              env,
              callStack,
            );
            const targets = targetExpressions
              .flatMap((target) => staticHrefCandidatesResolved(target, env, callStack))
              .map(normalizedProductRoute)
              .filter(Boolean);
            const authoritative = targetExpressions.length > 0
              && targetExpressions.every((target) => (
                authorityExpressionResolved(target, navigationBindings, env, callStack)
                || authorityExpressionResolved(target, productHrefBindings, env, callStack)
              ));
            if (targets.length > 0 && !authoritative) {
              report(node, "native-invoke-route-handler-redirect", targets);
            } else if (
              !authoritative
              && containsUnprovenProjectImportCall(indirectFirstArg, env, callStack)
            ) {
              report(node, "native-invoke-cross-module-destination");
            }
          }

          if (isLocationHeaderMutationReference(indirectTarget, env)) {
            const headerName = resolveDataExpression(indirectFirstArg, env);
            const locationTarget = indirectArgs[1];
            if (
              headerName
              && ts.isStringLiteralLike(headerName)
              && headerName.text.toLowerCase() === "location"
              && locationTarget
            ) {
              const authoritative = (
                authorityExpressionResolved(locationTarget, navigationBindings, env, callStack)
                || authorityExpressionResolved(locationTarget, productHrefBindings, env, callStack)
                || authorityExpressionResolved(locationTarget, externalHrefBindings, env, callStack)
              );
              if (!authoritative) {
                const targets = staticHrefCandidatesResolved(
                  locationTarget,
                  env,
                  callStack,
                ).map(normalizedProductRoute).filter(Boolean);
                report(node, "native-invoke-location-header", targets);
              }
            }
          }

          if (isBrowserLocationReloadReference(indirectTarget, env)) {
            report(node, "native-invoke-browser-reload");
          }

          if (
            isBrowserLocationMethodReference(indirectTarget, env)
            && !browserNavigationAuthority(indirectFirstArg, env, callStack)
          ) {
            report(node, "native-invoke-browser-location");
          }

          if (isBrowserHistoryTraversalReference(indirectTarget, env)) {
            report(node, "native-invoke-history-traversal");
          }

          if (isBrowserHistoryMethodReference(indirectTarget, env)) {
            const historyTarget = indirectArgs[2];
            if (
              historyTarget
              && !authorityExpressionResolved(
                historyTarget,
                navigationBindings,
                env,
                callStack,
              )
            ) {
              report(node, "native-invoke-browser-history");
            }
          }

          if (isBrowserWindowOpenReference(indirectTarget, env)) {
            reportProgrammaticWindowOpenTarget(node, indirectArgs, env);
            if (
              indirectFirstArg
              && !browserNavigationAuthority(indirectFirstArg, env, callStack)
            ) {
              report(node, "native-invoke-browser-window-open");
            }
          }

          if (isBrowserNavigationTraversalReference(indirectTarget, env)) {
            report(node, "native-invoke-navigation-api-traversal");
          }

          if (
            isBrowserNavigationApiMethodReference(indirectTarget, env)
            && indirectFirstArg
            && !browserNavigationAuthority(indirectFirstArg, env, callStack)
          ) {
            report(node, "native-invoke-browser-navigation-api");
          }
        }
      }

      const directActivation = domActivationBinding(expression, env);
      if (directActivation) {
        if (directActivation.method === "submit") {
          if (enforceFormValidationBypassPolicy) {
            report(node, "programmatic-validation-submit");
          } else {
            report(node, "dom-form-submit");
          }
        } else if (directActivation.method === "requestSubmit") {
          if (enforceFormValidationBypassPolicy && node.arguments.length > 0) {
            report(node, "programmatic-validation-submitter");
          } else {
            const verifiedReplay = (
              directActivation.verifiedReplay === true
              && node.arguments.length === 0
            );
            if (!verifiedReplay) report(node, "dom-form-submit");
          }
        } else if (directActivation.method === "click") {
          report(node, "dom-click-activation");
        }
      }

      const syntheticTargetKind = syntheticActivationTargetKind(expression, env);
      const syntheticEventName = syntheticActivationEventName(firstArg, env);
      if (
        syntheticTargetKind
        && (
          (syntheticEventName === "submit" && syntheticTargetKind === "form")
          || (
            syntheticEventName === "click"
            && ["a", "area", "button", "input"].includes(syntheticTargetKind)
          )
        )
      ) {
        report(node, "dom-synthetic-activation");
      }

      const reflectiveCall = reflectiveCalleeName(expression, env);
      const reflectiveTargetKind = reflectiveCall
        ? domNavigationElementKind(firstArg, env)
        : null;

      if (reflectiveCall && reflectiveTargetKind) {
        if (reflectiveCall === "Object.assign") {
          for (const source of node.arguments.slice(1)) {
            const resolvedSource = resolveDataExpression(source, env);
            if (!resolvedSource || !ts.isObjectLiteralExpression(resolvedSource)) {
              report(node, "dom-reflective-dynamic");
              continue;
            }
            for (const property of resolvedSource.properties) {
              if (ts.isSpreadAssignment(property)) {
                report(node, "dom-reflective-dynamic");
                continue;
              }
              const propertyNameText = staticObjectPropertyName(property, env);
              const value = reflectiveObjectPropertyValue(property);
              if (!propertyNameText) {
                report(node, "dom-reflective-dynamic");
                continue;
              }
              reportReflectiveDomProperty(
                node,
                node.arguments[0],
                reflectiveTargetKind,
                propertyNameText,
                value,
                env,
                callStack,
              );
            }
          }
        }

        if (reflectiveCall === "Reflect.set") {
          const propertyExpression = resolveDataExpression(node.arguments[1], env);
          const propertyNameText = propertyExpression && ts.isStringLiteralLike(propertyExpression)
            ? propertyExpression.text
            : null;
          if (!propertyNameText) {
            report(node, "dom-reflective-dynamic");
          } else {
            reportReflectiveDomProperty(
              node,
              node.arguments[0],
              reflectiveTargetKind,
              propertyNameText,
              node.arguments[2],
              env,
              callStack,
            );
          }
        }

        if (reflectiveCall === "Object.defineProperty") {
          const propertyExpression = resolveDataExpression(node.arguments[1], env);
          const propertyNameText = propertyExpression && ts.isStringLiteralLike(propertyExpression)
            ? propertyExpression.text
            : null;
          if (!propertyNameText) {
            report(node, "dom-reflective-dynamic");
          } else {
            reportReflectiveDomProperty(
              node,
              node.arguments[0],
              reflectiveTargetKind,
              propertyNameText,
              descriptorNavigationValue(node.arguments[2], env),
              env,
              callStack,
            );
          }
        }

        if (reflectiveCall === "Object.defineProperties") {
          const descriptors = resolveDataExpression(node.arguments[1], env);
          if (!descriptors || !ts.isObjectLiteralExpression(descriptors)) {
            report(node, "dom-reflective-dynamic");
          } else {
            for (const property of descriptors.properties) {
              if (ts.isSpreadAssignment(property)) {
                report(node, "dom-reflective-dynamic");
                continue;
              }
              const propertyNameText = staticObjectPropertyName(property, env);
              const descriptor = reflectiveObjectPropertyValue(property);
              if (!propertyNameText) {
                report(node, "dom-reflective-dynamic");
                continue;
              }
              reportReflectiveDomProperty(
                node,
                node.arguments[0],
                reflectiveTargetKind,
                propertyNameText,
                descriptorNavigationValue(descriptor, env),
                env,
                callStack,
              );
            }
          }
        }
      }

      if (isDomSetCustomValidityReference(expression, env)) {
        const kind = domSetCustomValidityElementKind(expression, env);
        reportProgrammaticCustomValidityMutation(
          node,
          domMethodTargetExpression(expression, "setCustomValidity", env),
          kind,
          firstArg,
          env,
        );
      }

      if (isDomSetAttributeNSReference(expression, env)) {
        const kind = domSetAttributeNSElementKind(expression, env);
        const namespace = standardAttributeNamespace(firstArg, env);
        const attributeName = resolveDataExpression(node.arguments[1], env);
        const target = node.arguments[2];

        if (namespace === "dynamic") {
          report(node, "dom-dynamic-attribute");
        } else if (
          namespace === "standard"
          && (!attributeName || !ts.isStringLiteralLike(attributeName))
        ) {
          report(node, "dom-dynamic-attribute");
        } else if (namespace === "standard") {
          const constraintProperty = domConstraintPropertyForKind(
            kind,
            attributeName.text,
          );
          const validationBypassProperty = domValidationBypassPropertyForKind(
            kind,
            attributeName.text,
          );
          if (
            reportProgrammaticFormParticipationMutation(
              node,
              domMethodTargetExpression(expression, "setAttributeNS", env),
              kind,
              attributeName.text,
              target,
              env,
              "set-attribute",
            )
          ) {
            // Standard-namespace form participation mutation handled above.
          } else if (
            constraintProperty
            && reportProgrammaticFormConstraintMutation(
              node,
              kind,
              constraintProperty,
              target,
              env,
              "set-attribute",
            )
          ) {
            // Standard-namespace form constraint mutation handled above.
          } else if (
            validationBypassProperty
            && reportProgrammaticFormValidationBypass(
              node,
              kind,
              validationBypassProperty,
              target,
              env,
              true,
            )
          ) {
            // Standard-namespace boolean validation attributes are enabled by presence.
          }
        }
      }

      if (isDomToggleAttributeReference(expression, env)) {
        const kind = domToggleAttributeElementKind(expression, env);
        const attributeName = resolveDataExpression(firstArg, env);
        if (!attributeName || !ts.isStringLiteralLike(attributeName)) {
          report(node, "dom-dynamic-attribute");
        } else {
          const constraintProperty = domConstraintPropertyForKind(
            kind,
            attributeName.text,
          );
          const validationBypassProperty = domValidationBypassPropertyForKind(
            kind,
            attributeName.text,
          );
          if (
            reportProgrammaticFormParticipationMutation(
              node,
              domMethodTargetExpression(expression, "toggleAttribute", env),
              kind,
              attributeName.text,
              node.arguments[1],
              env,
              "toggle-attribute",
            )
          ) {
            // Form participation toggle handled above.
          } else if (
            constraintProperty
            && reportProgrammaticFormConstraintMutation(
              node,
              kind,
              constraintProperty,
              node.arguments[1],
              env,
              "toggle-attribute",
            )
          ) {
            // Form constraint toggle handled above.
          } else if (
            validationBypassProperty
            && reportProgrammaticFormValidationToggle(
              node,
              kind,
              validationBypassProperty,
              node.arguments[1],
              env,
            )
          ) {
            // Form validation toggle policy handled above.
          }
        }
      }

      if (isDomRemoveAttributeNSReference(expression, env)) {
        const kind = domRemoveAttributeNSElementKind(expression, env);
        const namespace = standardAttributeNamespace(firstArg, env);
        const attributeName = resolveDataExpression(node.arguments[1], env);

        if (namespace === "dynamic") {
          report(node, "dom-dynamic-attribute");
        } else if (
          namespace === "standard"
          && (!attributeName || !ts.isStringLiteralLike(attributeName))
        ) {
          report(node, "dom-dynamic-attribute");
        } else if (namespace === "standard") {
          if (
            !reportProgrammaticFormParticipationMutation(
              node,
              domMethodTargetExpression(expression, "removeAttributeNS", env),
              kind,
              attributeName.text,
              null,
              env,
              "remove-attribute",
            )
          ) {
            reportProgrammaticFormConstraintMutation(
              node,
              kind,
              attributeName.text,
              null,
              env,
              "remove-attribute",
            );
          }
        }
      }

      if (isDomRemoveAttributeReference(expression, env)) {
        const kind = domRemoveAttributeElementKind(expression, env);
        const attributeName = resolveDataExpression(firstArg, env);
        if (!attributeName || !ts.isStringLiteralLike(attributeName)) {
          report(node, "dom-dynamic-attribute");
        } else {
          if (
            !reportProgrammaticFormParticipationMutation(
              node,
              domMethodTargetExpression(expression, "removeAttribute", env),
              kind,
              attributeName.text,
              null,
              env,
              "remove-attribute",
            )
          ) {
            reportProgrammaticFormConstraintMutation(
              node,
              kind,
              attributeName.text,
              null,
              env,
              "remove-attribute",
            );
          }
        }
      }

      if (isDomSetAttributeReference(expression, env)) {
        const kind = domSetAttributeElementKind(expression, env);
        const attributeName = resolveDataExpression(firstArg, env);
        const target = node.arguments[1];

        if (!attributeName || !ts.isStringLiteralLike(attributeName)) {
          report(node, "dom-dynamic-attribute");
        } else {
          const constraintProperty = domConstraintPropertyForKind(
            kind,
            attributeName.text,
          );
          const validationBypassProperty = domValidationBypassPropertyForKind(
            kind,
            attributeName.text,
          );
          const submissionTransportProperty = domSubmissionTransportPropertyForKind(
            kind,
            attributeName.text,
          );
          const targetContextProperty = domTargetContextPropertyForKind(
            kind,
            attributeName.text,
          );
          const navProperty = domNavigationPropertyForKind(kind, attributeName.text);
          if (
            reportProgrammaticFormParticipationMutation(
              node,
              domMethodTargetExpression(expression, "setAttribute", env),
              kind,
              attributeName.text,
              target,
              env,
              "set-attribute",
            )
          ) {
            // Form participation attribute mutation handled above.
          } else if (
            constraintProperty
            && reportProgrammaticFormConstraintMutation(
              node,
              kind,
              constraintProperty,
              target,
              env,
              "set-attribute",
            )
          ) {
            // Form constraint attribute mutation handled above.
          } else if (
            validationBypassProperty
            && reportProgrammaticFormValidationBypass(
              node,
              kind,
              validationBypassProperty,
              target,
              env,
              true,
            )
          ) {
            // Boolean validation-bypass attributes are enabled by presence.
          } else if (
            submissionTransportProperty
            && reportProgrammaticDomSubmissionTransport(
              node,
              kind,
              submissionTransportProperty,
              target,
              env,
            )
          ) {
            // Form submission transport policy handled above.
          } else if (
            targetContextProperty
            && reportProgrammaticDomTarget(
              node,
              kind,
              targetContextProperty,
              target,
              env,
            )
          ) {
            // Target-context policy handled above.
          } else if (navProperty === "href" && kind === "base") {
            report(node, "dom-base-href");
          } else if (isEmbeddedInlineDocumentProperty(kind, navProperty)) {
            report(node, "embedded-runtime-srcdoc");
          } else if (
            navProperty
            && target
            && !domNavigationAuthority(target, env, callStack)
          ) {
            const targets = staticHrefCandidatesResolved(target, env, callStack);
            report(
              node,
              isEmbeddedContextKind(kind) ? "embedded-runtime-source" : "dom-attribute",
              targets,
            );
          }
        }
      }

      if (isDocumentHtmlWriteReference(expression, env)) {
        report(node, "dom-html-injection");
      }

      if (isInsertAdjacentHtmlReference(expression, env)) {
        report(node, "dom-html-injection");
      }

      if (isRouterTraversalReference(expression, env)) {
        report(node, "router-traversal");
      }

      if (
        isRouterMethodReference(expression, env)
        && !authorityExpressionResolved(firstArg, navigationBindings, env, callStack)
      ) {
        report(node, "router");
      }

      if (isServerRedirectReference(expression, env)) {
        const targets = staticHrefCandidatesResolved(firstArg, env, callStack)
          .map(normalizedProductRoute)
          .filter(Boolean);
        const authoritative = (
          authorityExpressionResolved(firstArg, navigationBindings, env, callStack)
          || authorityExpressionResolved(firstArg, productHrefBindings, env, callStack)
        );
        if (targets.length > 0 && !authoritative) {
          report(node, "server-redirect", targets);
        } else if (
          !authoritative
          && containsUnprovenProjectImportCall(firstArg, env, callStack)
        ) {
          report(node, "cross-module-destination");
        }
      }

      if (isResponseRedirectReference(expression, env)) {
        const targetExpressions = routeRedirectTargetExpressions(firstArg, env, callStack);
        const targets = targetExpressions
          .flatMap((target) => staticHrefCandidatesResolved(target, env, callStack))
          .map(normalizedProductRoute)
          .filter(Boolean);
        const authoritative = targetExpressions.length > 0
          && targetExpressions.every((target) => (
            authorityExpressionResolved(target, navigationBindings, env, callStack)
            || authorityExpressionResolved(target, productHrefBindings, env, callStack)
          ));
        if (targets.length > 0 && !authoritative) {
          report(node, "route-handler-redirect", targets);
        } else if (
          !authoritative
          && containsUnprovenProjectImportCall(firstArg, env, callStack)
        ) {
          report(node, "cross-module-destination");
        }
      }

      if (isLocationHeaderMutationReference(expression, env)) {
        const headerName = resolveDataExpression(firstArg, env);
        const locationTarget = node.arguments[1];
        if (
          headerName
          && ts.isStringLiteralLike(headerName)
          && headerName.text.toLowerCase() === "location"
          && locationTarget
        ) {
          const targets = staticHrefCandidatesResolved(locationTarget, env, callStack)
            .map(normalizedProductRoute)
            .filter(Boolean);
          const authoritative = (
            authorityExpressionResolved(locationTarget, navigationBindings, env, callStack)
            || authorityExpressionResolved(locationTarget, productHrefBindings, env, callStack)
            || authorityExpressionResolved(locationTarget, externalHrefBindings, env, callStack)
          );
          if (targets.length > 0 && !authoritative) {
            report(node, "location-header", targets);
          } else if (
            !authoritative
            && containsUnprovenProjectImportCall(locationTarget, env, callStack)
          ) {
            report(node, "cross-module-destination");
          }
        }
      }

      if (isBrowserLocationReloadReference(expression, env)) {
        report(node, "browser-reload");
      }

      if (
        isBrowserLocationMethodReference(expression, env)
        && !browserNavigationAuthority(firstArg, env, callStack)
      ) {
        report(node, "browser-location");
      }

      if (isBrowserHistoryTraversalReference(expression, env)) {
        report(node, "history-traversal");
      }

      if (isBrowserHistoryMethodReference(expression, env)) {
        const historyTarget = node.arguments[2];
        if (
          historyTarget
          && !authorityExpressionResolved(historyTarget, navigationBindings, env, callStack)
        ) {
          report(node, "browser-history");
        }
      }

      if (isBrowserWindowOpenReference(expression, env)) {
        reportProgrammaticWindowOpenTarget(node, node.arguments, env);
        if (
          firstArg
          && !browserNavigationAuthority(firstArg, env, callStack)
        ) {
          report(node, "browser-window-open");
        }
      }

      if (isBrowserNavigationTraversalReference(expression, env)) {
        report(node, "navigation-api-traversal");
      }

      if (
        isBrowserNavigationApiMethodReference(expression, env)
        && firstArg
        && !browserNavigationAuthority(firstArg, env, callStack)
      ) {
        report(node, "browser-navigation-api");
      }

      if (
        isProjectImportCallee(expression, env)
        && node.arguments.some((argument) => (
          isRouterObject(argument, env)
          || isRouterMethodReference(argument, env)
          || isRouterTraversalReference(argument, env)
          || isBrowserLocationObject(argument, env)
          || isBrowserLocationMethodReference(argument, env)
          || isBrowserLocationReloadReference(argument, env)
          || isBrowserHistoryObject(argument, env)
          || isBrowserHistoryMethodReference(argument, env)
          || isBrowserHistoryTraversalReference(argument, env)
          || isBrowserNavigationApiObject(argument, env)
          || isBrowserNavigationApiMethodReference(argument, env)
          || isBrowserNavigationTraversalReference(argument, env)
          || isBrowserWindowOpenReference(argument, env)
          || isHeadersObject(argument, env)
          || isLocationHeaderMutationReference(argument, env)
          || domNavigationElementKind(argument, env)
          || isDomSetAttributeReference(argument, env)
          || isDomSetAttributeNSReference(argument, env)
          || isDomToggleAttributeReference(argument, env)
          || isDomRemoveAttributeReference(argument, env)
          || isDomRemoveAttributeNSReference(argument, env)
          || isDomSetCustomValidityReference(argument, env)
          || domActivationBinding(argument, env)
          || nativeDomActivationInfo(argument, env)
          || isBoundNavigationCapability(argument, env)
          || isServerRedirectReference(argument, env)
          || isResponseRedirectReference(argument, env)
        ))
      ) {
        report(node, "cross-module-wrapper");
      }

      const definition = localFunctionFromCallee(expression, env);
      if (definition && !callStack.has(definition.key)) {
        const nextStack = new Set(callStack);
        nextStack.add(definition.key);
        const childEnv = functionEnvironment(definition, node, env);
        visit(definition.body, childEnv, nextStack);
      }
    }

    if (ts.isNewExpression(node)) {
      if (
        isFunctionConstructorReference(node.expression, env)
        || boundDynamicCodeInfo(node.expression, env)
      ) {
        report(node, "dynamic-code-function-constructor");
      }

      if (
        proxyFactoryKind(node.expression, env) === "constructor"
        && isDynamicCodeCapabilityValue(node.arguments?.[0], env)
      ) {
        report(node, "dynamic-code-proxy-capability");
      }

      if (proxyNavigationCapabilityTarget(node, env)) {
        report(node, "proxy-navigation-capability");
      }

      const headerTargets = headersConstructorLocationTargets(node, env);
      for (const locationTarget of headerTargets) {
        const targets = staticHrefCandidatesResolved(locationTarget, env, callStack)
          .map(normalizedProductRoute)
          .filter(Boolean);
        const authoritative = (
          authorityExpressionResolved(locationTarget, navigationBindings, env, callStack)
          || authorityExpressionResolved(locationTarget, productHrefBindings, env, callStack)
          || authorityExpressionResolved(locationTarget, externalHrefBindings, env, callStack)
        );
        if (targets.length > 0 && !authoritative) {
          report(node, "location-header", targets);
        } else if (
          !authoritative
          && containsUnprovenProjectImportCall(locationTarget, env, callStack)
        ) {
          report(node, "cross-module-destination");
        }
      }

      const locationTarget = responseConstructorLocationTarget(node, env);
      if (locationTarget) {
        const targets = staticHrefCandidatesResolved(locationTarget, env, callStack)
          .map(normalizedProductRoute)
          .filter(Boolean);
        const authoritative = (
          authorityExpressionResolved(locationTarget, navigationBindings, env, callStack)
          || authorityExpressionResolved(locationTarget, productHrefBindings, env, callStack)
          || authorityExpressionResolved(locationTarget, externalHrefBindings, env, callStack)
        );
        if (targets.length > 0 && !authoritative) {
          report(node, "response-location-redirect", targets);
        } else if (
          !authoritative
          && containsUnprovenProjectImportCall(locationTarget, env, callStack)
        ) {
          report(node, "cross-module-destination");
        }
      }
    }

    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
    ) {
      const leftOwner = propertyOwner(node.left);
      const leftProperty = propertyName(node.left);
      const domKind = domNavigationElementKind(leftOwner, env);
      const participationProperty = domParticipationPropertyForKind(
        domKind,
        leftProperty,
      );
      const constraintProperty = domConstraintPropertyForKind(
        domKind,
        leftProperty,
      );
      const validationBypassProperty = domValidationBypassPropertyForKind(
        domKind,
        leftProperty,
      );
      const submissionTransportProperty = domSubmissionTransportPropertyForKind(
        domKind,
        leftProperty,
      );
      const targetContextProperty = domTargetContextPropertyForKind(domKind, leftProperty);
      const domProperty = domNavigationPropertyForKind(domKind, leftProperty);

      if (
        participationProperty
        && reportProgrammaticFormParticipationMutation(
          node,
          leftOwner,
          domKind,
          participationProperty,
          node.right,
          env,
        )
      ) {
        // Form control participation policy handled above.
      } else if (
        constraintProperty
        && reportProgrammaticFormConstraintMutation(
          node,
          domKind,
          constraintProperty,
          node.right,
          env,
        )
      ) {
        // Form constraint integrity policy handled above.
      } else if (
        validationBypassProperty
        && reportProgrammaticFormValidationBypass(
          node,
          domKind,
          validationBypassProperty,
          node.right,
          env,
        )
      ) {
        // Form validation bypass policy handled above.
      } else if (
        submissionTransportProperty
        && reportProgrammaticDomSubmissionTransport(
          node,
          domKind,
          submissionTransportProperty,
          node.right,
          env,
        )
      ) {
        // Form submission transport policy handled above.
      } else if (
        targetContextProperty
        && reportProgrammaticDomTarget(
          node,
          domKind,
          targetContextProperty,
          node.right,
          env,
        )
      ) {
        // Target-context policy handled above.
      } else if (domKind === "base" && domProperty === "href") {
        report(node, "dom-base-href");
      } else if (isEmbeddedInlineDocumentProperty(domKind, domProperty)) {
        report(node, "embedded-runtime-srcdoc");
      } else if (
        domProperty
        && !domNavigationAuthority(node.right, env, callStack)
      ) {
        const targets = staticHrefCandidatesResolved(node.right, env, callStack);
        report(
          node,
          isEmbeddedContextKind(domKind) ? "embedded-runtime-source" : "dom-property",
          targets,
        );
      }

      if (leftProperty === "innerHTML" || leftProperty === "outerHTML") {
        report(node, "dom-html-injection");
      }
    }

    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && isBrowserHrefAssignmentTarget(node.left, env)
      && !browserNavigationAuthority(node.right, env, callStack)
    ) {
      report(node, "browser-location");
    }

    visitProgrammaticOwnershipChildren(
      node,
      env,
      callStack,
      visit,
    );

    if (ts.isCallExpression(node)) {
      visitScheduledOwnershipCallbacks(
        node,
        env,
        callStack,
        visit,
      );
      applyProgrammaticOwnershipCallTransition(node, env);
    }
  }

  visit(sourceFile);
  return violations;
}

{
  const selfTest = [
    'import { useRouter, redirect } from "next/navigation";',
    'import { NextResponse as NR } from "next/server";',
    'import { getExternalNavigationHref, getProductRouteHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'const router = useRouter();',
    'router.push("/earn");',
    'router.push(getRouteNavigationHref("home", "/earn"));',
    'const nav = router;',
    'nav.replace("/wallet");',
    'const { push: rawPush } = useRouter();',
    'rawPush("/progress");',
    'const go = router.push;',
    'go("/invite");',
    'redirect("/wallet?state=x");',
    'redirect(getProductRouteHref("wallet", "?state=x"));',
    'NR.redirect(new URL("/dashboard?claim=x", request.url), 303);',
    'NR.redirect(new URL(getProductRouteHref("home", "?claim=x"), request.url), 303);',
    'const { redirect: responseRedirect } = NR;',
    'responseRedirect(new URL("/earn", request.url), 303);',
    'window.location.assign("https://example.com");',
    'window.location.assign(getExternalNavigationHref("https://example.com"));',
    'window.location.replace("https://example.com/replace");',
    'const loc = window.location;',
    'const externalGo = loc.assign;',
    'externalGo("https://example.com/alias");',
    'window.location.href = "https://example.com/href";',
    'window.location.href = getExternalNavigationHref("https://example.com/href-safe");',
  ].join("\n");
  const violations = auditImperativeNavigation(selfTest, "navigation-callsite.self-test.tsx");
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 11
    || counts.router !== 4
    || counts["server-redirect"] !== 1
    || counts["route-handler-redirect"] !== 2
    || counts["browser-location"] !== 4
  ) {
    throw new Error("Navigation call-site provenance self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { redirect } from "next/navigation";',
    'import { NextResponse as NR } from "next/server";',
    'import { getProductRouteHref } from "@/lib/route-semantics";',
    'const hiddenServerTarget = "/wallet?hidden=1";',
    'redirect(hiddenServerTarget);',
    'const hiddenServerAlias = hiddenServerTarget;',
    'redirect(hiddenServerAlias);',
    'const conditionalTarget = signedIn ? "/invite#network" : "/auth";',
    'redirect(conditionalTarget);',
    'const safeServerTarget = getProductRouteHref("wallet", "?safe=1");',
    'redirect(safeServerTarget);',
    'const hiddenRoutePath = "/dashboard?hidden=1";',
    'const hiddenRoutePathAlias = hiddenRoutePath;',
    'const hiddenRouteUrl = new URL(hiddenRoutePathAlias, request.url);',
    'NR.redirect(hiddenRouteUrl, 303);',
    'const hiddenRouteUrlAlias = hiddenRouteUrl;',
    'NR.redirect(hiddenRouteUrlAlias, 303);',
    'const safeRoutePath = getProductRouteHref("home", "?safe=1");',
    'const safeRouteUrl = new URL(safeRoutePath, request.url);',
    'NR.redirect(safeRouteUrl, 303);',
  ].join("\n");
  const violations = auditImperativeNavigation(selfTest, "navigation-destination-dataflow.self-test.ts");
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 5
    || counts["server-redirect"] !== 3
    || counts["route-handler-redirect"] !== 2
  ) {
    throw new Error("Navigation destination dataflow self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { useRouter, redirect } from "next/navigation";',
    'import { NextResponse as NR } from "next/server";',
    'import { getExternalNavigationHref, getProductRouteHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'const router = useRouter();',
    'function buildTarget(active) { return active ? "/dashboard" : "/auth"; }',
    'function buildNestedTarget() { return buildTarget(true); }',
    'const buildUrl = () => new URL("/wallet", request.url);',
    'const buildSafeTarget = () => getProductRouteHref("wallet", "?safe=1");',
    'const buildSafeUrl = () => new URL(getProductRouteHref("home"), request.url);',
    'redirect(buildTarget(true));',
    'redirect(buildNestedTarget());',
    'redirect(buildSafeTarget());',
    'NR.redirect(buildUrl(), 303);',
    'NR.redirect(buildSafeUrl(), 303);',
    'function go(r, target) { r.push(target); }',
    'go(router, "/earn");',
    'go(router, getRouteNavigationHref("home", "/earn"));',
    'function serverGo(target) { redirect(target); }',
    'serverGo("/invite");',
    'serverGo(getProductRouteHref("invite"));',
    'function handlerGo(target) { NR.redirect(new URL(target, request.url), 303); }',
    'handlerGo("/progress");',
    'handlerGo(getProductRouteHref("progress"));',
    'function browserGo(target) { window.location.assign(target); }',
    'browserGo("https://example.com");',
    'browserGo(getExternalNavigationHref("https://example.com/safe"));',
  ].join("\n");
  const violations = auditImperativeNavigation(selfTest, "interprocedural-navigation.self-test.tsx");
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 7
    || counts.router !== 1
    || counts["server-redirect"] !== 3
    || counts["route-handler-redirect"] !== 2
    || counts["browser-location"] !== 1
  ) {
    throw new Error("Interprocedural navigation provenance self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import defaultBuilder, { buildTarget } from "@/lib/navigation-builders";',
    'import { navigate } from "@/lib/navigation-wrapper";',
    'import * as navBuilders from "../lib/navigation-builders";',
    'import { redirect, useRouter } from "next/navigation";',
    'import { NextResponse as NR } from "next/server";',
    'import { getRouteNavigationHref } from "@/lib/route-semantics";',
    'const router = useRouter();',
    'redirect(buildTarget());',
    'function localTarget() { return buildTarget(); }',
    'redirect(localTarget());',
    'NR.redirect(new URL(navBuilders.buildTarget(), request.url), 303);',
    'NR.redirect(defaultBuilder(), 303);',
    'navigate(router, "/earn");',
    'navigate(router.push, "/wallet");',
    'redirect(getRouteNavigationHref("server", buildTarget()));',
    'NR.redirect(new URL(getRouteNavigationHref("server", navBuilders.buildTarget()), request.url), 303);',
  ].join("\n");
  const violations = auditImperativeNavigation(selfTest, "cross-module-navigation.self-test.ts");
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 6
    || counts["cross-module-destination"] !== 4
    || counts["cross-module-wrapper"] !== 2
  ) {
    throw new Error("Cross-module navigation provenance self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { getExternalNavigationHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'const anchor = document.createElement("a");',
    'anchor.href = "/earn";',
    'anchor.href = getRouteNavigationHref("dom", "/earn");',
    'anchor.setAttribute("href", "https://example.com/raw");',
    'anchor.setAttribute("href", getExternalNavigationHref("https://example.com/safe"));',
    'const setAnchorAttribute = anchor.setAttribute;',
    'setAnchorAttribute("href", "/wallet");',
    'const form = document.createElement("form");',
    'form.action = "/api/withdrawals";',
    'form.action = getRouteNavigationHref("dom", "/api/withdrawals");',
    'const button = document.createElement("button");',
    'button.formAction = "/api/pulse/claim";',
    'const base = document.createElement("base");',
    'base.href = getRouteNavigationHref("dom", "/dashboard/");',
    'const setBaseAttribute = base.setAttribute;',
    'setBaseAttribute("href", getRouteNavigationHref("dom", "/dashboard/"));',
    'anchor.setAttribute(dynamicAttributeName, "/invite");',
    'document.write("<a href=\"/dashboard\">open</a>");',
    'root.innerHTML = "<form action=\"/api/pulse/claim\"></form>";',
    'root.insertAdjacentHTML("beforeend", "<a href=\"/progress\">progress</a>");',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "dom-navigation-mutation.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 11
    || counts["dom-property"] !== 3
    || counts["dom-attribute"] !== 2
    || counts["dom-base-href"] !== 2
    || counts["dom-dynamic-attribute"] !== 1
    || counts["dom-html-injection"] !== 3
  ) {
    throw new Error("DOM navigation mutation authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { getExternalNavigationHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'const anchor = document.createElement("a");',
    'Object.assign(anchor, { href: "/earn" });',
    'Object.assign(anchor, { href: getRouteNavigationHref("reflective-dom", "/earn") });',
    'Object.assign(anchor, dynamicProps);',
    'Reflect.set(anchor, "href", "/wallet");',
    'Reflect.set(anchor, "href", getRouteNavigationHref("reflective-dom", "/wallet"));',
    'Reflect.set(anchor, dynamicPropertyName, getRouteNavigationHref("reflective-dom", "/invite"));',
    'Object.defineProperty(anchor, "href", { value: "/invite" });',
    'Object.defineProperty(anchor, "href", { value: getRouteNavigationHref("reflective-dom", "/invite") });',
    'Object.defineProperty(anchor, "href", { get: () => "/progress" });',
    'const form = document.createElement("form");',
    'Object.defineProperties(form, { action: { value: "/api/withdrawals" } });',
    'Object.defineProperties(form, { action: { value: getRouteNavigationHref("reflective-dom", "/api/withdrawals") } });',
    'const button = document.createElement("button");',
    'Object.defineProperties(button, { formAction: { value: "/api/pulse/claim" } });',
    'const base = document.createElement("base");',
    'Object.assign(base, { href: getRouteNavigationHref("reflective-dom", "/dashboard/") });',
    'Reflect.set(base, "href", getRouteNavigationHref("reflective-dom", "/dashboard/"));',
    'Object.defineProperty(base, "href", { value: getRouteNavigationHref("reflective-dom", "/dashboard/") });',
    'Object.defineProperties(base, { href: { value: getRouteNavigationHref("reflective-dom", "/dashboard/") } });',
    'Object.assign(anchor, { href: getExternalNavigationHref("https://example.com/safe") });',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "reflective-dom-mutation.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 12
    || counts["dom-reflective-property"] !== 6
    || counts["dom-reflective-dynamic"] !== 2
    || counts["dom-base-href"] !== 4
  ) {
    throw new Error("Reflective DOM mutation authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'const form = document.querySelector<HTMLFormElement>("#payout");',
    'form.submit();',
    'form.requestSubmit();',
    'const { requestSubmit: requestForm } = form;',
    'requestForm();',
    'const replayForm = container.closest(\'form[data-route-submit-authority="verified-replay"]\') as HTMLFormElement;',
    'replayForm.requestSubmit();',
    'const replaySubmitter = document.createElement("button");',
    'replayForm.requestSubmit(replaySubmitter);',
    'const anchor = document.querySelector<HTMLAnchorElement>("#reward");',
    'anchor.click();',
    'const button = document.createElement("button");',
    'button.click();',
    'form.dispatchEvent(new SubmitEvent("submit"));',
    'anchor.dispatchEvent(new MouseEvent("click"));',
    'HTMLFormElement.prototype.submit.call(form);',
    'Reflect.apply(HTMLAnchorElement.prototype.click, anchor, []);',
    'HTMLFormElement.prototype.submit.bind(form)();',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-activation-authority.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 11
    || counts["dom-form-submit"] !== 4
    || counts["dom-click-activation"] !== 2
    || counts["dom-synthetic-activation"] !== 2
    || counts["native-invoke-dom-activation"] !== 3
  ) {
    throw new Error("Programmatic activation authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { redirect, useRouter } from "next/navigation";',
    'import { NextResponse as NR } from "next/server";',
    'import { getExternalNavigationHref, getProductRouteHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'const router = useRouter();',
    'router.push.call(router, "/earn");',
    'router.push.call(router, getRouteNavigationHref("native-invoke", "/earn"));',
    'router.replace.apply(router, ["/wallet"]);',
    'Reflect.apply(router.push, router, [getRouteNavigationHref("native-invoke", "/progress")]);',
    'router.back.call(router);',
    'history.pushState.call(history, {}, "", "/progress");',
    'Reflect.apply(history.replaceState, history, [{}, "", getRouteNavigationHref("native-invoke", "/progress")]);',
    'history.go.apply(history, [-1]);',
    'location.assign.call(location, "https://example.com/raw");',
    'Reflect.apply(location.replace, location, [getExternalNavigationHref("https://example.com/safe")]);',
    'location.reload.call(location);',
    'window.open.apply(window, ["https://example.com/raw"]);',
    'navigation.navigate.call(navigation, "/invite");',
    'navigation.back.call(navigation);',
    'redirect.call(null, "/wallet");',
    'redirect.call(null, getProductRouteHref("wallet"));',
    'NR.redirect.call(NR, new URL("/dashboard", request.url), 303);',
    'NR.redirect.call(NR, new URL(getProductRouteHref("home"), request.url), 303);',
    'const headers = new Headers();',
    'headers.set.call(headers, "Location", "/dashboard");',
    'headers.set.call(headers, "Location", getRouteNavigationHref("headers", "/dashboard"));',
    'const anchor = document.createElement("a");',
    'anchor.setAttribute.call(anchor, "href", "/invite");',
    'Reflect.apply(anchor.setAttribute, anchor, ["href", getRouteNavigationHref("native-invoke", "/invite")]);',
    'Element.prototype.setAttribute.call(anchor, "href", "/dashboard");',
    'Reflect.apply(Element.prototype.setAttribute, anchor, ["href", getRouteNavigationHref("native-invoke", "/dashboard")]);',
    'const hrefSetter = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "href").set;',
    'hrefSetter.call(anchor, "/earn");',
    'hrefSetter.call(anchor, getRouteNavigationHref("native-invoke", "/earn"));',
    'const form = document.createElement("form");',
    'Reflect.apply(Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "action").set, form, ["/api/withdrawals"]);',
    'Reflect.apply(Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "action").set, form, [getRouteNavigationHref("native-invoke", "/api/withdrawals")]);',
    'const base = document.createElement("base");',
    'Object.getOwnPropertyDescriptor(HTMLBaseElement.prototype, "href").set.call(base, getRouteNavigationHref("native-invoke", "/dashboard/"));',
    'router.push.apply(router, dynamicArguments);',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "native-invocation-boundary.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 19
    || counts["native-invoke-router"] !== 2
    || counts["native-invoke-router-traversal"] !== 1
    || counts["native-invoke-browser-history"] !== 1
    || counts["native-invoke-history-traversal"] !== 1
    || counts["native-invoke-browser-location"] !== 1
    || counts["native-invoke-browser-reload"] !== 1
    || counts["native-invoke-browser-window-open"] !== 1
    || counts["native-invoke-browser-navigation-api"] !== 1
    || counts["native-invoke-navigation-api-traversal"] !== 1
    || counts["native-invoke-server-redirect"] !== 1
    || counts["native-invoke-route-handler-redirect"] !== 1
    || counts["native-invoke-location-header"] !== 1
    || counts["native-invoke-dom-attribute"] !== 2
    || counts["native-invoke-dom-setter"] !== 2
    || counts["native-invoke-dom-base-href"] !== 1
    || counts["native-invoke-dynamic-arguments"] !== 1
  ) {
    throw new Error("Native invocation boundary self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { redirect, useRouter } from "next/navigation";',
    'import { NextResponse as NR } from "next/server";',
    'import { navigate } from "@/lib/navigation-wrapper";',
    'import { getExternalNavigationHref, getProductRouteHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'const router = useRouter();',
    'const boundPush = router.push.bind(router);',
    'boundPush("/earn");',
    'boundPush(getRouteNavigationHref("bound", "/earn"));',
    'const boundPreRaw = router.push.bind(router, "/wallet");',
    'boundPreRaw();',
    'const boundPreSafe = router.push.bind(router, getRouteNavigationHref("bound", "/wallet"));',
    'boundPreSafe();',
    'boundPush.call(null, "/progress");',
    'const boundBack = router.back.bind(router);',
    'boundBack();',
    'const boundHistory = history.pushState.bind(history, {}, "", "/progress");',
    'boundHistory();',
    'const boundLocation = location.assign.bind(location, "https://example.com/raw");',
    'boundLocation();',
    'const boundLocationSafe = location.assign.bind(location, getExternalNavigationHref("https://example.com/safe"));',
    'boundLocationSafe();',
    'const boundOpen = window.open.bind(window, "https://example.com/raw");',
    'boundOpen();',
    'const boundNavigate = navigation.navigate.bind(navigation, "/invite");',
    'boundNavigate();',
    'const boundRedirect = redirect.bind(null, "/wallet");',
    'boundRedirect();',
    'const boundRedirectSafe = redirect.bind(null, getProductRouteHref("wallet"));',
    'boundRedirectSafe();',
    'const boundResponseRedirect = NR.redirect.bind(NR, new URL("/dashboard", request.url), 303);',
    'boundResponseRedirect();',
    'const headers = new Headers();',
    'const boundHeader = headers.set.bind(headers, "Location", "/dashboard");',
    'boundHeader();',
    'const anchor = document.createElement("a");',
    'const boundAttribute = anchor.setAttribute.bind(anchor, "href", "/invite");',
    'boundAttribute();',
    'const boundAttributeSafe = anchor.setAttribute.bind(anchor, "href", getRouteNavigationHref("bound", "/invite"));',
    'boundAttributeSafe();',
    'const hrefSetter = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "href").set;',
    'const boundSetter = hrefSetter.bind(anchor, "/earn");',
    'boundSetter();',
    'const base = document.createElement("base");',
    'const baseSetter = Object.getOwnPropertyDescriptor(HTMLBaseElement.prototype, "href").set;',
    'const boundBase = baseSetter.bind(base, getRouteNavigationHref("bound", "/dashboard/"));',
    'boundBase();',
    'const boundDynamic = router.push.bind(router, ...dynamicArguments);',
    'boundDynamic();',
    'navigate(router.push.bind(router), "/earn");',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "bound-navigation-invocation.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 16
    || counts["native-invoke-router"] !== 3
    || counts["native-invoke-router-traversal"] !== 1
    || counts["native-invoke-browser-history"] !== 1
    || counts["native-invoke-browser-location"] !== 1
    || counts["native-invoke-browser-window-open"] !== 1
    || counts["native-invoke-browser-navigation-api"] !== 1
    || counts["native-invoke-server-redirect"] !== 1
    || counts["native-invoke-route-handler-redirect"] !== 1
    || counts["native-invoke-location-header"] !== 1
    || counts["native-invoke-dom-attribute"] !== 1
    || counts["native-invoke-dom-setter"] !== 1
    || counts["native-invoke-dom-base-href"] !== 1
    || counts["native-invoke-dynamic-arguments"] !== 1
    || counts["cross-module-wrapper"] !== 1
  ) {
    throw new Error("Bound navigation invocation authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { redirect, useRouter } from "next/navigation";',
    'import { NextResponse as NR } from "next/server";',
    'const router = useRouter();',
    'new Proxy(router, {});',
    'new Proxy(router.push, {});',
    'new Proxy(router.back, {});',
    'new Proxy(history, {});',
    'new Proxy(location.assign, {});',
    'new Proxy(navigation.navigate, {});',
    'new Proxy(window.open, {});',
    'new Proxy(redirect, {});',
    'new Proxy(NR, {});',
    'new Proxy(Response, {});',
    'const headers = new Headers();',
    'new Proxy(headers, {});',
    'const anchor = document.createElement("a");',
    'new Proxy(anchor, {});',
    'new Proxy(anchor.setAttribute, {});',
    'const boundPush = router.push.bind(router);',
    'new Proxy(boundPush, {});',
    'Proxy.revocable(router.push, {});',
    'const makeRevocable = Proxy.revocable;',
    'makeRevocable(location.assign, {});',
    'const PlainProxy = Proxy;',
    'new PlainProxy({ value: 1 }, {});',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "proxy-navigation-capability.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 16
    || counts["proxy-navigation-capability"] !== 16
  ) {
    throw new Error("Proxy navigation capability boundary self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { execute } from "@/lib/dynamic-wrapper";',
    'eval("location.href = \'/earn\'");',
    'const evaluator = eval;',
    'evaluator(runtimeCode);',
    '(0, eval)("location.href = \'/wallet\'");',
    'eval.call(null, "location.href = \'/progress\'");',
    'Reflect.apply(eval, null, ["location.href = \'/invite\'"]);',
    'Function("return location.href")();',
    'new Function("return location.href");',
    'const F = Function;',
    'new F("return location.href");',
    '(() => {}).constructor("return location.href")();',
    'Reflect.construct(Function, ["return location.href"]);',
    'setTimeout("location.href = \'/dashboard\'", 0);',
    'const repeat = setInterval;',
    'repeat("location.href = \'/earn\'", 1000);',
    'const boundEval = eval.bind(null);',
    'const boundFunction = Function.bind(null, "return location.href");',
    'const boundTimer = setTimeout.bind(window, "location.href = \'/wallet\'", 0);',
    'boundEval("location.href = \'/progress\'");',
    'new boundFunction();',
    'boundTimer();',
    'new Proxy(eval, {});',
    'Proxy.revocable(Function, {});',
    'execute(eval);',
    'setTimeout(() => console.log("safe"), 0);',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "dynamic-code-execution.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 21
    || counts["dynamic-code-eval"] !== 3
    || counts["dynamic-code-indirect-eval"] !== 3
    || counts["dynamic-code-function-constructor"] !== 6
    || counts["dynamic-code-string-timer"] !== 3
    || counts["dynamic-code-bound-capability"] !== 3
    || counts["dynamic-code-proxy-capability"] !== 2
    || counts["dynamic-code-capability-export"] !== 1
  ) {
    throw new Error("Dynamic code execution boundary self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { useRef } from "react";',
    'import { getRouteNavigationHref } from "@/lib/route-semantics";',
    'const selected = document.querySelector("a.promo");',
    'selected.href = "/earn";',
    'selected.href = getRouteNavigationHref("rehydrated-dom", "/earn");',
    'const typedForm = document.querySelector<HTMLFormElement>("#payout");',
    'typedForm.action = "/api/withdrawals";',
    'const casted = document.getElementById("invite") as HTMLAnchorElement;',
    'casted.href = "/invite";',
    'const linkRef = useRef<HTMLAnchorElement | null>(null);',
    'linkRef.current!.href = "/progress";',
    'function onClick(event: React.MouseEvent<HTMLAnchorElement>) { event.currentTarget.href = "/wallet"; }',
    'const existingForm: HTMLFormElement = someNode;',
    'existingForm.action = "/api/pulse/claim";',
    'const selectedButton = document.querySelectorAll("button.submit")[0];',
    'selectedButton.formAction = "/api/pulse/claim";',
    'const byTag = document.getElementsByTagName("a").item(0);',
    'byTag.href = "/dashboard";',
    'const forms = document.forms;',
    'forms[0].action = "/api/return-reminder";',
    'const links = document.links;',
    'links[0].href = "/invite";',
    'const existingBase = document.querySelector("base");',
    'existingBase.href = getRouteNavigationHref("rehydrated-dom", "/dashboard/");',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "rehydrated-dom-handle.self-test.tsx",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 11
    || counts["dom-property"] !== 10
    || counts["dom-base-href"] !== 1
  ) {
    throw new Error("Rehydrated DOM handle authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { useRouter } from "next/navigation";',
    'const router = useRouter();',
    'router.back();',
    'router.forward();',
    'const goBack = router.back;',
    'goBack();',
    'history.back();',
    'window.history.forward();',
    'history.go(-1);',
    'location.reload();',
    'navigation.back();',
    'navigation.forward();',
    'navigation.traverseTo("entry-key");',
    'navigation.reload();',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "implicit-history-traversal.self-test.tsx",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 11
    || counts["router-traversal"] !== 3
    || counts["history-traversal"] !== 3
    || counts["browser-reload"] !== 1
    || counts["navigation-api-traversal"] !== 4
  ) {
    throw new Error("Implicit history traversal boundary self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { getRouteNavigationHref } from "@/lib/route-semantics";',
    'const headers = new Headers();',
    'headers.set("Location", "/dashboard");',
    'headers.append("location", "/earn");',
    'const alias = headers;',
    'alias.set("Location", getRouteNavigationHref("headers", "/dashboard"));',
    'const setter = headers.set;',
    'setter("Location", "/wallet");',
    'const { append: addLocation } = headers;',
    'addLocation("Location", "/progress");',
    'response.headers.set("Location", "/invite");',
    'new Headers({ Location: "/dashboard" });',
    'new Headers([["Location", "/wallet"]]);',
    'new Headers({ Location: getRouteNavigationHref("headers", "/dashboard") });',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "location-header-mutation.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 7
    || counts["location-header"] !== 7
  ) {
    throw new Error("Location header mutation authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { permanentRedirect } from "next/navigation";',
    'import { NextResponse as NR } from "next/server";',
    'import { getProductRouteHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'permanentRedirect("/dashboard");',
    'permanentRedirect(getProductRouteHref("home"));',
    'Response.redirect("/earn", 302);',
    'globalThis.Response.redirect("/wallet", 307);',
    'const webRedirect = Response.redirect;',
    'webRedirect("/progress", 308);',
    'const { redirect: standardRedirect } = Response;',
    'standardRedirect("/invite", 302);',
    'Response.redirect(getRouteNavigationHref("server", "/earn"), 302);',
    'new Response(null, { status: 302, headers: { Location: "/dashboard" } });',
    'new NR(null, { status: 307, headers: { location: "/wallet" } });',
    'new Response(null, { status: 302, headers: { Location: getRouteNavigationHref("server", "/dashboard") } });',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "server-redirect-primitives.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 7
    || counts["server-redirect"] !== 1
    || counts["route-handler-redirect"] !== 4
    || counts["response-location-redirect"] !== 2
  ) {
    throw new Error("Server redirect primitive authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { getExternalNavigationHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'function onMessage(event: MessageEvent) {',
    '  event.source.location.assign("/dashboard");',
    '  event.source.history.pushState({}, "", "/progress");',
    '  event.source.navigation.navigate("/invite");',
    '  const source = event.source;',
    '  source.location.href = "/wallet";',
    '  event.source.open("https://example.com/raw", "_blank");',
    '  event.source.location.assign(getRouteNavigationHref("message-source", "/dashboard"));',
    '  event.source.open(getExternalNavigationHref("https://example.com/safe"), "_blank");',
    '}',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "message-source-window.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 5
    || counts["browser-location"] !== 2
    || counts["browser-history"] !== 1
    || counts["browser-navigation-api"] !== 1
    || counts["browser-window-open"] !== 1
  ) {
    throw new Error("Message source window authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { getExternalNavigationHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'window[0].location.assign("/dashboard");',
    'parent[1].location.href = "/wallet";',
    'const indexedChild = window[0];',
    'indexedChild.location.replace("/earn");',
    'window[0][1].history.pushState({}, "", "/progress");',
    'top[0].navigation.navigate("/invite");',
    'opener[0].open("https://example.com/raw", "_blank");',
    'window[0].location.assign(getRouteNavigationHref("indexed-context", "/dashboard"));',
    'opener[0].open(getExternalNavigationHref("https://example.com/safe"), "_blank");',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "indexed-child-context.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 6
    || counts["browser-location"] !== 3
    || counts["browser-history"] !== 1
    || counts["browser-navigation-api"] !== 1
    || counts["browser-window-open"] !== 1
  ) {
    throw new Error("Indexed child context authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { getRouteNavigationHref } from "@/lib/route-semantics";',
    'iframe.contentDocument.location.assign("/dashboard");',
    'iframe.contentDocument.defaultView.location.href = "/wallet";',
    'const embeddedDocument = iframe.contentDocument;',
    'embeddedDocument.location.replace("/earn");',
    'const embeddedView = iframe.contentDocument.defaultView;',
    'embeddedView.history.pushState({}, "", "/progress");',
    'embeddedView.navigation.navigate("/invite");',
    'iframe.contentDocument.location.assign(getRouteNavigationHref("embedded-document", "/dashboard"));',
    'embeddedView.location = getRouteNavigationHref("embedded-document", "/wallet");',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "embedded-document-handle.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 5
    || counts["browser-location"] !== 3
    || counts["browser-history"] !== 1
    || counts["browser-navigation-api"] !== 1
  ) {
    throw new Error("Embedded document handle authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { getRouteNavigationHref } from "@/lib/route-semantics";',
    'document.defaultView.location.assign("/dashboard");',
    'element.ownerDocument.defaultView.location.href = "/wallet";',
    'const view = document.defaultView;',
    'view.location.replace("/earn");',
    'function onClick(event: MouseEvent) { event.view.location.assign("/invite"); }',
    'function onReact(event: React.MouseEvent<HTMLButtonElement>) { event.nativeEvent.view.history.pushState({}, "", "/progress"); }',
    'function onKey(event: KeyboardEvent) { event.view.navigation.navigate("/wallet"); }',
    'const safeView = document.defaultView;',
    'safeView.location = getRouteNavigationHref("rehydrated-window", "/dashboard");',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "rehydrated-window-handle.self-test.tsx",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 6
    || counts["browser-location"] !== 4
    || counts["browser-history"] !== 1
    || counts["browser-navigation-api"] !== 1
  ) {
    throw new Error("Rehydrated window handle authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { getExternalNavigationHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'const popup = window.open();',
    'popup.location = "/dashboard";',
    'popup.location = getRouteNavigationHref("opened-context", "/dashboard");',
    'const child = top.open();',
    'child.location.assign("/earn");',
    'const launch = window.open;',
    'const aliasPopup = launch();',
    'aliasPopup.location.href = "/wallet";',
    'function spawnPopup() { return window.open(); }',
    'const helperPopup = spawnPopup();',
    'helperPopup.location.replace("/invite");',
    'const historyPopup = window.open();',
    'historyPopup.history.pushState({}, "", "/progress");',
    'const navPopup = window.open();',
    'navPopup.navigation.navigate("/progress");',
    'const safePopup = window.open(getExternalNavigationHref("https://example.com/start"));',
    'safePopup.location.replace(getExternalNavigationHref("https://example.com/next"));',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "opened-context-handle.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 6
    || counts["browser-location"] !== 4
    || counts["browser-history"] !== 1
    || counts["browser-navigation-api"] !== 1
  ) {
    throw new Error("Opened context handle provenance self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { getExternalNavigationHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'top.location.assign("/dashboard");',
    'parent.location.href = "/wallet";',
    'self.location = getRouteNavigationHref("context", "/dashboard");',
    'opener.location.replace("https://example.com/raw");',
    'opener.location.replace(getExternalNavigationHref("https://example.com/safe"));',
    'frames[0].location.assign("/earn");',
    'window.frames[1].location = "/progress";',
    'const ctx = parent;',
    'const loc = ctx.location;',
    'loc.assign("/invite");',
    'iframe.contentWindow.location.assign("/dashboard");',
    'top.history.pushState({}, "", "/wallet");',
    'parent.history.replaceState({}, "", getRouteNavigationHref("context", "/wallet"));',
    'parent.navigation.navigate("/earn");',
    'parent.navigation.navigate(getRouteNavigationHref("context", "/earn"));',
    'top.open("https://example.com/raw", "_blank");',
    'top.open(getExternalNavigationHref("https://example.com/safe"), "_blank");',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "browsing-context-navigation.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 10
    || counts["browser-location"] !== 7
    || counts["browser-history"] !== 1
    || counts["browser-navigation-api"] !== 1
    || counts["browser-window-open"] !== 1
  ) {
    throw new Error("Browsing context navigation authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { getExternalNavigationHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'history.pushState({}, "", "/earn");',
    'window.history.replaceState({}, "", getRouteNavigationHref("history", "/earn"));',
    'const hist = window.history;',
    'hist.pushState({}, "", "/wallet");',
    'const { replaceState: swapHistory } = history;',
    'swapHistory({}, "", "/progress");',
    'window.open("https://example.com", "_blank");',
    'const launch = window.open;',
    'launch("https://example.com/alias");',
    'window.open(getExternalNavigationHref("https://example.com/safe"), "_blank");',
    'document.location.assign("/dashboard");',
    'document.location.href = "/wallet";',
    'window.location = "/earn";',
    'document.location = getRouteNavigationHref("browser", "/dashboard");',
    'globalThis.location.replace("https://example.com/raw");',
    'globalThis.location.replace(getExternalNavigationHref("https://example.com/safe"));',
    'navigation.navigate("/invite");',
    'window.navigation.navigate(getRouteNavigationHref("browser", "/invite"));',
    'const navApi = window.navigation;',
    'navApi.navigate("/progress");',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "browser-navigation-primitives.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 11
    || counts["browser-history"] !== 3
    || counts["browser-window-open"] !== 2
    || counts["browser-location"] !== 4
    || counts["browser-navigation-api"] !== 2
  ) {
    throw new Error("Browser navigation primitive authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { getExternalNavigationHref, getRouteNavigationHref } from "@/lib/route-semantics";',
    'const iframe = document.createElement("iframe");',
    'iframe.src = "/dashboard";',
    'iframe.src = getRouteNavigationHref("embedded-runtime", "/dashboard");',
    'iframe.srcdoc = "<p>inline</p>";',
    'iframe.setAttribute("src", "https://example.com/raw");',
    'iframe.setAttribute("src", getExternalNavigationHref("https://example.com/safe"));',
    'iframe.setAttribute("srcdoc", "<p>inline</p>");',
    'const object = document.createElement("object");',
    'Object.assign(object, { data: "/wallet" });',
    'const embed = document.createElement("embed");',
    'Reflect.set(embed, "src", "/earn");',
    'const frame = document.querySelector<HTMLFrameElement>("#legacy");',
    'frame.src = "/progress";',
    'const embeddedRef = useRef<HTMLIFrameElement | null>(null);',
    'embeddedRef.current.src = "/invite";',
    'function onLoad(event: React.SyntheticEvent<HTMLIFrameElement>) { event.currentTarget.src = "/dashboard"; }',
    'Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src").set.call(iframe, "/wallet");',
    'Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src").set.call(iframe, getRouteNavigationHref("embedded-runtime", "/wallet"));',
    'Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "srcdoc").set.call(iframe, "<p>inline</p>");',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "embedded-context-runtime-source.self-test.tsx",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 11
    || counts["embedded-runtime-source"] !== 8
    || counts["embedded-runtime-srcdoc"] !== 3
  ) {
    throw new Error("Embedded context runtime source authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'const dynamicTransport = chooseTransport();',
    'const form = document.createElement("form");',
    'form.method = "get";',
    'form.method = "post";',
    'form.enctype = "text/plain";',
    'form.enctype = "multipart/form-data";',
    'form.encoding = "text/plain";',
    'const button = document.createElement("button");',
    'button.formMethod = dynamicTransport;',
    'button.formMethod = "get";',
    'const input = document.createElement("input");',
    'input.formEnctype = "text/plain";',
    'form.setAttribute("method", "get");',
    'Object.assign(form, { method: "get" });',
    'Reflect.set(form, "enctype", "text/plain");',
    'Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "method").set.call(form, "get");',
    'Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "enctype").set.call(form, "multipart/form-data");',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-form-submission-transport.self-test.ts",
    { formSubmissionTransportPolicy: true },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 10
    || counts["programmatic-form-method"] !== 5
    || counts["programmatic-form-enctype"] !== 4
    || counts["programmatic-form-transport-dynamic"] !== 1
  ) {
    throw new Error("Programmatic form submission transport policy self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { useEffect } from "react";',
    'const formA = document.createElement("form");',
    'const outside = document.createElement("div");',
    'const input = document.createElement("input");',
    'formA.append(input);',
    'const allIf = setTimeout(() => outside.append(input), 0);',
    'if (flag) { clearTimeout(allIf); } else { clearTimeout(allIf); }',
    'const partialIf = setTimeout(() => outside.append(input), 0);',
    'if (flag) { clearTimeout(partialIf); }',
    'const allSwitch = setInterval(() => outside.append(input), 1000);',
    'switch (mode) {',
    '  case "a": clearInterval(allSwitch); break;',
    '  default: clearInterval(allSwitch); break;',
    '}',
    'const partialSwitch = setTimeout(() => outside.append(input), 0);',
    'switch (mode) { case "a": clearTimeout(partialSwitch); break; }',
    'const finalAll = setTimeout(() => outside.append(input), 0);',
    'try { if (flag) { const marker = 1; } } finally { clearTimeout(finalAll); }',
    'const functionAll = setTimeout(() => outside.append(input), 0);',
    'function stopFunctionAll() {',
    '  if (flag) { clearTimeout(functionAll); return; }',
    '  clearTimeout(functionAll);',
    '}',
    'stopFunctionAll();',
    'const functionPartial = setTimeout(() => outside.append(input), 0);',
    'function stopFunctionPartial() {',
    '  if (flag) { clearTimeout(functionPartial); return; }',
    '  return;',
    '}',
    'stopFunctionPartial();',
    'useEffect(() => {',
    '  const effectAll = setTimeout(() => outside.append(input), 0);',
    '  return () => {',
    '    if (flag) { clearTimeout(effectAll); return; }',
    '    clearTimeout(effectAll);',
    '  };',
    '}, []);',
    'useEffect(() => {',
    '  const effectPartial = setTimeout(() => outside.append(input), 0);',
    '  return () => { if (flag) { clearTimeout(effectPartial); } };',
    '}, []);',
    'input.disabled = true;',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-ownership-callback-teardown-control-flow.self-test.ts",
    {
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
      formOwnershipLifecyclePolicy: true,
      formOwnershipRelocationPolicy: true,
      programmaticFormOwnershipStatePolicy: true,
      programmaticFormOwnershipControlFlowPolicy: true,
      programmaticFormOwnershipExecutionScopePolicy: true,
      programmaticFormOwnershipCallbackSchedulingPolicy: true,
      programmaticFormOwnershipCallbackLifetimePolicy: true,
      programmaticFormOwnershipCallbackTeardownPathPolicy: true,
      programmaticFormOwnershipCallbackTeardownControlFlowPolicy: true,
    },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 6
    || counts["programmatic-ownership-scheduled-teardown-path-dynamic"] !== 4
    || counts["programmatic-ownership-scheduled-bounded-dynamic"] !== 1
    || counts["programmatic-participation-weaken"] !== 1
    || counts["programmatic-ownership-scheduled-dynamic"] !== undefined
    || counts["programmatic-ownership-scheduled-repeat-dynamic"] !== undefined
  ) {
    throw new Error(
      "Programmatic ownership callback teardown control-flow authority self-test failed: "
      + JSON.stringify(violations),
    );
  }
}

{
  const selfTest = [
    'import { useEffect } from "react";',
    'const formA = document.createElement("form");',
    'const outside = document.createElement("div");',
    'const input = document.createElement("input");',
    'formA.append(input);',
    'const maybeWhile = setTimeout(() => outside.append(input), 0);',
    'while (flag) { clearTimeout(maybeWhile); }',
    'const maybeForOf = setTimeout(() => outside.append(input), 0);',
    'for (const item of items) { clearTimeout(maybeForOf); }',
    'const zeroOnly = setTimeout(() => outside.append(input), 0);',
    'while (false) { clearTimeout(zeroOnly); }',
    'const doAll = setTimeout(() => outside.append(input), 0);',
    'do { clearTimeout(doAll); } while (flag);',
    'const literalForOf = setTimeout(() => outside.append(input), 0);',
    'for (const item of [1]) { clearTimeout(literalForOf); }',
    'const breakCovered = setTimeout(() => outside.append(input), 0);',
    'do { if (flag) { break; } clearTimeout(breakCovered); } while (false);',
    'clearTimeout(breakCovered);',
    'const continueCovered = setTimeout(() => outside.append(input), 0);',
    'do { if (flag) { continue; } clearTimeout(continueCovered); } while (false);',
    'clearTimeout(continueCovered);',
    'const nestedAll = setTimeout(() => outside.append(input), 0);',
    'do {',
    '  do { clearTimeout(nestedAll); break; } while (true);',
    '  break;',
    '} while (true);',
    'useEffect(() => {',
    '  const effectLoop = setTimeout(() => outside.append(input), 0);',
    '  return () => { while (flag) { clearTimeout(effectLoop); } };',
    '}, []);',
    'input.disabled = true;',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-ownership-callback-teardown-loop.self-test.ts",
    {
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
      formOwnershipLifecyclePolicy: true,
      formOwnershipRelocationPolicy: true,
      programmaticFormOwnershipStatePolicy: true,
      programmaticFormOwnershipControlFlowPolicy: true,
      programmaticFormOwnershipExecutionScopePolicy: true,
      programmaticFormOwnershipCallbackSchedulingPolicy: true,
      programmaticFormOwnershipCallbackLifetimePolicy: true,
      programmaticFormOwnershipCallbackTeardownPathPolicy: true,
      programmaticFormOwnershipCallbackTeardownControlFlowPolicy: true,
      programmaticFormOwnershipCallbackTeardownLoopPolicy: true,
    },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 5
    || counts["programmatic-ownership-scheduled-teardown-loop-dynamic"] !== 3
    || counts["programmatic-ownership-scheduled-dynamic"] !== 1
    || counts["programmatic-participation-weaken"] !== 1
    || counts["programmatic-ownership-scheduled-teardown-path-dynamic"] !== undefined
    || counts["programmatic-ownership-scheduled-bounded-dynamic"] !== undefined
    || counts["programmatic-ownership-scheduled-repeat-dynamic"] !== undefined
  ) {
    throw new Error(
      "Programmatic ownership callback teardown loop authority self-test failed: "
      + JSON.stringify(violations),
    );
  }
}

{
  const selfTest = [
    'const formA = document.createElement("form");',
    'const outside = document.createElement("div");',
    'const input = document.createElement("input");',
    'formA.append(input);',
    'const finiteAscending = setTimeout(() => outside.append(input), 0);',
    'for (let i = 0; i < 3; i++) { const marker = i; }',
    'clearTimeout(finiteAscending);',
    'const finiteDescending = setTimeout(() => outside.append(input), 0);',
    'for (let i = 3; i > 0; i--) { const marker = i; }',
    'clearTimeout(finiteDescending);',
    'const staticZero = setTimeout(() => outside.append(input), 0);',
    'for (let i = 3; i < 3; i++) { clearTimeout(staticZero); }',
    'const unknownTermination = setTimeout(() => outside.append(input), 0);',
    'while (flag) { const marker = 1; }',
    'clearTimeout(unknownTermination);',
    'const labeledBreakCovered = setTimeout(() => outside.append(input), 0);',
    'outerBreak: do {',
    '  if (flag) { break outerBreak; }',
    '  clearTimeout(labeledBreakCovered);',
    '} while (false);',
    'clearTimeout(labeledBreakCovered);',
    'const labeledContinueCovered = setTimeout(() => outside.append(input), 0);',
    'outerContinue: do {',
    '  do { if (flag) { continue outerContinue; } break; } while (false);',
    '  clearTimeout(labeledContinueCovered);',
    '} while (false);',
    'clearTimeout(labeledContinueCovered);',
    'const chainedLabels = setTimeout(() => outside.append(input), 0);',
    'outerChain: innerChain: do { clearTimeout(chainedLabels); break outerChain; } while (true);',
    'const partialLabel = setTimeout(() => outside.append(input), 0);',
    'partialExit: do {',
    '  if (flag) { break partialExit; }',
    '  clearTimeout(partialLabel);',
    '} while (false);',
    'input.disabled = true;',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-ownership-callback-teardown-labeled-iteration.self-test.ts",
    {
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
      formOwnershipLifecyclePolicy: true,
      formOwnershipRelocationPolicy: true,
      programmaticFormOwnershipStatePolicy: true,
      programmaticFormOwnershipControlFlowPolicy: true,
      programmaticFormOwnershipExecutionScopePolicy: true,
      programmaticFormOwnershipCallbackSchedulingPolicy: true,
      programmaticFormOwnershipCallbackLifetimePolicy: true,
      programmaticFormOwnershipCallbackTeardownPathPolicy: true,
      programmaticFormOwnershipCallbackTeardownControlFlowPolicy: true,
      programmaticFormOwnershipCallbackTeardownLoopPolicy: true,
      programmaticFormOwnershipCallbackTeardownLabeledIterationPolicy: true,
    },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 4
    || counts["programmatic-ownership-scheduled-dynamic"] !== 1
    || counts["programmatic-ownership-scheduled-teardown-loop-dynamic"] !== 1
    || counts["programmatic-ownership-scheduled-teardown-path-dynamic"] !== 1
    || counts["programmatic-participation-weaken"] !== 1
    || counts["programmatic-ownership-scheduled-bounded-dynamic"] !== undefined
    || counts["programmatic-ownership-scheduled-repeat-dynamic"] !== undefined
  ) {
    throw new Error(
      "Programmatic ownership callback teardown labeled iteration authority self-test failed: "
      + JSON.stringify(violations),
    );
  }
}

{
  const selfTest = [
    'import { useEffect } from "react";',
    'const formA = document.createElement("form");',
    'const outside = document.createElement("div");',
    'const input = document.createElement("input");',
    'formA.append(input);',
    'const aliasedTimer = setTimeout(() => outside.append(input), 0);',
    'const aliasedHandle = aliasedTimer;',
    'clearTimeout(aliasedHandle);',
    'const functionTimer = setInterval(() => outside.append(input), 1000);',
    'function stopFunctionTimer() { clearInterval(functionTimer); }',
    'stopFunctionTimer();',
    'const finalTimer = setTimeout(() => outside.append(input), 0);',
    'try { const marker = 1; } finally { clearTimeout(finalTimer); }',
    'const conditionalTimer = setTimeout(() => outside.append(input), 0);',
    'if (flag) { clearTimeout(conditionalTimer); }',
    'useEffect(() => {',
    '  const effectTimer = setTimeout(() => outside.append(input), 0);',
    '  const effectInterval = setInterval(() => outside.append(input), 1000);',
    '  const effectListener = () => outside.append(input);',
    '  window.addEventListener("change", effectListener);',
    '  return () => {',
    '    clearTimeout(effectTimer);',
    '    clearInterval(effectInterval);',
    '    window.removeEventListener("change", effectListener);',
    '  };',
    '}, []);',
    'input.disabled = true;',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-ownership-callback-teardown-path.self-test.ts",
    {
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
      formOwnershipLifecyclePolicy: true,
      formOwnershipRelocationPolicy: true,
      programmaticFormOwnershipStatePolicy: true,
      programmaticFormOwnershipControlFlowPolicy: true,
      programmaticFormOwnershipExecutionScopePolicy: true,
      programmaticFormOwnershipCallbackSchedulingPolicy: true,
      programmaticFormOwnershipCallbackLifetimePolicy: true,
      programmaticFormOwnershipCallbackTeardownPathPolicy: true,
    },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 5
    || counts["programmatic-ownership-scheduled-dynamic"] !== 1
    || counts["programmatic-ownership-scheduled-bounded-dynamic"] !== 3
    || counts["programmatic-participation-weaken"] !== 1
  ) {
    throw new Error(
      "Programmatic ownership callback teardown path authority self-test failed: "
      + JSON.stringify(violations),
    );
  }
}

{
  const selfTest = [
    'const formA = document.createElement("form");',
    'const outside = document.createElement("div");',
    'const input = document.createElement("input");',
    'formA.append(input);',
    'const cancelledTimeout = setTimeout(() => outside.append(input), 0);',
    'clearTimeout(cancelledTimeout);',
    'const cancelledInterval = setInterval(() => outside.append(input), 1000);',
    'clearInterval(cancelledInterval);',
    'const listener = () => outside.append(input);',
    'window.addEventListener("click", listener);',
    'window.removeEventListener("click", listener);',
    'const controller = new AbortController();',
    'window.addEventListener("focus", () => outside.append(input), { signal: controller.signal });',
    'controller.abort();',
    'window.addEventListener("change", () => outside.append(input), { once: true });',
    'setTimeout(() => outside.append(input), 0);',
    'setInterval(() => outside.append(input), 1000);',
    'window.addEventListener("input", () => outside.append(input));',
    'input.disabled = true;',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-ownership-callback-lifetime.self-test.ts",
    {
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
      formOwnershipLifecyclePolicy: true,
      formOwnershipRelocationPolicy: true,
      programmaticFormOwnershipStatePolicy: true,
      programmaticFormOwnershipControlFlowPolicy: true,
      programmaticFormOwnershipExecutionScopePolicy: true,
      programmaticFormOwnershipCallbackSchedulingPolicy: true,
      programmaticFormOwnershipCallbackLifetimePolicy: true,
    },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 5
    || counts["programmatic-ownership-scheduled-dynamic"] !== 2
    || counts["programmatic-ownership-scheduled-repeat-dynamic"] !== 2
    || counts["programmatic-participation-weaken"] !== 1
  ) {
    throw new Error(
      "Programmatic ownership callback lifetime authority self-test failed: "
      + JSON.stringify(violations),
    );
  }
}

{
  const selfTest = [
    'const formA = document.createElement("form");',
    'const outside = document.createElement("div");',
    'const input = document.createElement("input");',
    'formA.append(input);',
    'setTimeout(() => outside.append(input), 0);',
    'input.disabled = true;',
    'queueMicrotask(() => { input.name = "later"; });',
    'Promise.resolve().then(() => { formA.append(input); input.readOnly = true; });',
    'window.addEventListener("click", () => outside.append(input));',
    'const later = () => { formA.append(input); input.name = "event"; };',
    'setInterval(later, 1000);',
    'input.disabled = true;',
    'function run(callback: () => void) { callback(); }',
    'run(() => outside.append(input));',
    'input.disabled = true;',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-ownership-callback-scheduling.self-test.ts",
    {
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
      formOwnershipLifecyclePolicy: true,
      formOwnershipRelocationPolicy: true,
      programmaticFormOwnershipStatePolicy: true,
      programmaticFormOwnershipControlFlowPolicy: true,
      programmaticFormOwnershipExecutionScopePolicy: true,
      programmaticFormOwnershipCallbackSchedulingPolicy: true,
    },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 10
    || counts["programmatic-ownership-scheduled-dynamic"] !== 5
    || counts["programmatic-participation-weaken"] !== 3
    || counts["programmatic-participation-identity"] !== 1
    || counts["programmatic-ownership-escape"] !== 1
  ) {
    throw new Error(
      "Programmatic ownership callback scheduling authority self-test failed: "
      + JSON.stringify(violations),
    );
  }
}

{
  const selfTest = [
    'const formA = document.createElement("form");',
    'const outside = document.createElement("div");',
    'const input = document.createElement("input");',
    'formA.append(input);',
    'function dormant() { outside.append(input); }',
    'input.disabled = true;',
    'dormant();',
    'input.disabled = true;',
    'function attach() { formA.append(input); }',
    'attach();',
    'input.name = "called-attach";',
    'const dormantArrow = () => outside.append(input);',
    'input.readOnly = true;',
    'function run(callback: () => void) { callback(); }',
    'run(() => outside.append(input));',
    'input.disabled = true;',
    '(() => formA.append(input))();',
    'input.readOnly = true;',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-ownership-execution-scope.self-test.ts",
    {
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
      formOwnershipLifecyclePolicy: true,
      formOwnershipRelocationPolicy: true,
      programmaticFormOwnershipStatePolicy: true,
      programmaticFormOwnershipControlFlowPolicy: true,
      programmaticFormOwnershipExecutionScopePolicy: true,
    },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 6
    || counts["programmatic-participation-weaken"] !== 3
    || counts["programmatic-participation-identity"] !== 1
    || counts["programmatic-ownership-escape"] !== 2
  ) {
    throw new Error(
      "Programmatic ownership execution scope authority self-test failed: "
      + JSON.stringify(violations),
    );
  }
}

{
  const selfTest = [
    'const formA = document.createElement("form");',
    'const formB = document.createElement("form");',
    'const outside = document.createElement("div");',
    'const input = document.createElement("input");',
    'if (flag) { formA.append(input); } else { formB.append(input); }',
    'input.disabled = true;',
    'formA.append(input);',
    'input.disabled = true;',
    'flag ? formA.append(input) : formB.append(input);',
    'input.name = "branch-name";',
    'formA.append(input);',
    'flag && outside.append(input);',
    'input.readOnly = true;',
    'formA.append(input);',
    'input.name = "definite";',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-ownership-control-flow.self-test.ts",
    {
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
      formOwnershipLifecyclePolicy: true,
      formOwnershipRelocationPolicy: true,
      programmaticFormOwnershipStatePolicy: true,
      programmaticFormOwnershipControlFlowPolicy: true,
    },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 10
    || counts["programmatic-ownership-control-flow-dynamic"] !== 6
    || counts["programmatic-participation-weaken"] !== 1
    || counts["programmatic-participation-identity"] !== 1
    || counts["programmatic-ownership-reassociate"] !== 1
    || counts["programmatic-ownership-escape"] !== 1
  ) {
    throw new Error(
      "Programmatic ownership control-flow authority self-test failed: "
      + JSON.stringify(violations),
    );
  }
}

{
  const selfTest = [
    'const formA = document.createElement("form");',
    'const formB = document.createElement("form");',
    'const outside = document.createElement("div");',
    'const input = document.createElement("input");',
    'input.disabled = true;',
    'formA.append(input);',
    'input.disabled = true;',
    'const alias = input;',
    'alias.name = "owned";',
    'formA.appendChild(alias);',
    'formB.append(input);',
    'input.readOnly = true;',
    'outside.append(input);',
    'input.disabled = true;',
    'formA.prepend(input);',
    'input.remove();',
    'input.name = "detached";',
    'formA.append(input);',
    'formA.replaceChildren();',
    'input.readOnly = true;',
    'formA.append(input);',
    'formA.replaceChildren(input);',
    'input.disabled = true;',
    'const replacement = document.createElement("input");',
    'input.replaceWith(replacement);',
    'replacement.name = "replacement-owned";',
    'replacement.remove();',
    'replacement.disabled = true;',
    'const nested = document.createElement("input");',
    'formA.append(nested.disabled = true as any);',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-ownership-state.self-test.ts",
    {
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
      formOwnershipLifecyclePolicy: true,
      formOwnershipRelocationPolicy: true,
      programmaticFormOwnershipStatePolicy: true,
    },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 11
    || counts["programmatic-participation-weaken"] !== 3
    || counts["programmatic-participation-identity"] !== 2
    || counts["programmatic-ownership-reassociate"] !== 1
    || counts["programmatic-ownership-escape"] !== 1
    || counts["programmatic-ownership-detach"] !== 2
    || counts["programmatic-ownership-replace"] !== 1
    || counts["programmatic-ownership-state-evict"] !== 1
  ) {
    throw new Error("Programmatic ownership state authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { useRef } from "react";',
    'const ownedRef = useRef<HTMLInputElement | null>(null);',
    'const explicitRef = useRef<HTMLInputElement | null>(null);',
    'const fieldsetRef = useRef<HTMLFieldSetElement | null>(null);',
    'const Fixture = () => (<>',
    '  <form id="form-a"><fieldset ref={fieldsetRef}><input id="owned" ref={ownedRef} /></fieldset></form>',
    '  <form id="form-b"></form>',
    '  <input id="explicit" ref={explicitRef} form="form-a" />',
    '</>);',
    'const formA = document.getElementById("form-a") as HTMLFormElement;',
    'const formB = document.getElementById("form-b") as HTMLFormElement;',
    'const outside = document.createElement("div");',
    'formA.append(ownedRef.current!);',
    'formA.appendChild(document.getElementById("owned")!);',
    'fieldsetRef.current!.prepend(ownedRef.current!);',
    'formA.insertBefore(ownedRef.current!, null);',
    'formA.replaceChildren(ownedRef.current!);',
    'formB.append(ownedRef.current!);',
    'formB.appendChild(document.getElementById("owned")!);',
    'formB.prepend(ownedRef.current!);',
    'formB.insertBefore(ownedRef.current!, null);',
    'formB.replaceChildren(ownedRef.current!);',
    'outside.append(ownedRef.current!);',
    'outside.appendChild(document.getElementById("owned")!);',
    'outside.prepend(ownedRef.current!);',
    'outside.insertBefore(ownedRef.current!, null);',
    'outside.replaceChildren(ownedRef.current!);',
    'outside.append(explicitRef.current!);',
    'formB.append(explicitRef.current!);',
    'const unknown = formA.elements.namedItem("email") as HTMLInputElement;',
    'outside.append(unknown);',
    'Element.prototype.append.call(formB, ownedRef.current!);',
    'Node.prototype.appendChild.call(formB, ownedRef.current!);',
    'Reflect.apply(Element.prototype.prepend, outside, [ownedRef.current!]);',
    'Reflect.apply(Node.prototype.insertBefore, outside, [ownedRef.current!, null]);',
    'const boundReplaceChildren = Element.prototype.replaceChildren.bind(formB, ownedRef.current!);',
    'boundReplaceChildren();',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "form-ownership-relocation.self-test.tsx",
    {
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
      formOwnershipLifecyclePolicy: true,
      formOwnershipRelocationPolicy: true,
    },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 16
    || counts["programmatic-ownership-reassociate"] !== 8
    || counts["programmatic-ownership-escape"] !== 7
    || counts["programmatic-ownership-relocation-dynamic"] !== 1
  ) {
    throw new Error("Form ownership relocation authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { useRef } from "react";',
    'const inputRef = useRef<HTMLInputElement | null>(null);',
    'const detachedRef = useRef<HTMLInputElement | null>(null);',
    'const Fixture = () => (<>',
    '  <form id="profile-form"><input id="email" ref={inputRef} /></form>',
    '  <input id="detached" ref={detachedRef} />',
    '</>);',
    'const form = document.createElement("form");',
    'inputRef.current!.remove();',
    'document.getElementById("email")!.replaceWith(document.createElement("input"));',
    'form.removeChild(document.getElementById("email")!);',
    'form.replaceChild(document.createElement("input"), document.querySelector("#email")!);',
    'const byElements = form.elements.namedItem("email") as HTMLInputElement;',
    'byElements.remove();',
    'Element.prototype.remove.call(inputRef.current!);',
    'Reflect.apply(Element.prototype.replaceWith, document.getElementById("email")!, [document.createElement("input")]);',
    'Node.prototype.removeChild.call(form, document.getElementById("email")!);',
    'Reflect.apply(Node.prototype.replaceChild, form, [document.createElement("input"), document.getElementById("email")!]);',
    'const boundRemove = Element.prototype.remove.bind(inputRef.current!);',
    'boundRemove();',
    'detachedRef.current!.remove();',
    '(document.getElementById("detached") as HTMLInputElement).remove();',
    'const future = document.createElement("input");',
    'future.remove();',
    'form.appendChild(future);',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "form-ownership-lifecycle.self-test.tsx",
    {
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
      formOwnershipLifecyclePolicy: true,
    },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 10
    || counts["programmatic-ownership-detach"] !== 6
    || counts["programmatic-ownership-replace"] !== 4
  ) {
    throw new Error("Form ownership lifecycle authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { useRef } from "react";',
    'const FORM_ID = "profile-form";',
    'const inputRef = useRef<HTMLInputElement | null>(null);',
    'const detachedRef = useRef<HTMLInputElement | null>(null);',
    'function onEmail(event: React.ChangeEvent<HTMLInputElement>) { event.currentTarget.name = "renamed"; }',
    'function onDetached(event: React.ChangeEvent<HTMLInputElement>) { event.currentTarget.readOnly = true; }',
    'const Fixture = () => (<>',
    '  <form id={FORM_ID}>',
    '    <input id="email" ref={inputRef} onChange={onEmail} onInput={(event: React.FormEvent<HTMLInputElement>) => { event.currentTarget.disabled = true; }} />',
    '  </form>',
    '  <input id="external" form={FORM_ID} />',
    '  <input id="detached" ref={detachedRef} onChange={onDetached} />',
    '</>);',
    'inputRef.current!.readOnly = true;',
    'document.getElementById("email")!.disabled = true;',
    'document.querySelector("#email")!.readOnly = true;',
    'document.querySelector(\'input[form="profile-form"]\')!.disabled = true;',
    'document.getElementById("external")!.name = "external-renamed";',
    '(document.getElementById("detached") as HTMLInputElement).disabled = true;',
    'detachedRef.current!.readOnly = true;',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "form-ownership-provenance.self-test.tsx",
    {
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
    },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 7
    || counts["programmatic-participation-weaken"] !== 5
    || counts["programmatic-participation-identity"] !== 2
  ) {
    throw new Error("Form ownership provenance authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'const dynamicValidity = chooseValidityMessage();',
    'const form = document.createElement("form");',
    'const input = document.createElement("input");',
    'form.appendChild(input);',
    'input.disabled = true;',
    'input.disabled = false;',
    'input.readOnly = true;',
    'input.readOnly = false;',
    'input.name = "renamed";',
    'input.setAttribute("disabled", "");',
    'input.removeAttribute("disabled");',
    'input.setAttribute("readonly", "");',
    'input.removeAttribute("readonly");',
    'input.setAttribute("name", "renamed-again");',
    'input.removeAttribute("name");',
    'input.setAttribute("form", "other-form");',
    'input.removeAttribute("form");',
    'input.toggleAttribute("disabled", true);',
    'input.toggleAttribute("disabled", false);',
    'input.setCustomValidity("");',
    'input.setCustomValidity("Still invalid");',
    'input.setCustomValidity(dynamicValidity);',
    'Reflect.set(input, "disabled", true);',
    'Object.assign(input, { name: "reflective-name" });',
    'Object.defineProperty(input, "readOnly", { value: true });',
    'Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "disabled").set.call(input, true);',
    'Reflect.apply(HTMLInputElement.prototype.setCustomValidity, input, [""]);',
    'const byElements = form.elements.namedItem("email") as HTMLInputElement;',
    'byElements.readOnly = true;',
    'const detached = document.createElement("textarea");',
    'detached.readOnly = true;',
    'detached.setCustomValidity("");',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-form-control-participation.self-test.ts",
    { formControlParticipationPolicy: true },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 18
    || counts["programmatic-participation-weaken"] !== 9
    || counts["programmatic-participation-identity"] !== 4
    || counts["programmatic-participation-association"] !== 2
    || counts["programmatic-participation-validity-clear"] !== 2
    || counts["programmatic-participation-dynamic"] !== 1
  ) {
    throw new Error("Programmatic form control participation authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'const dynamicConstraint = chooseConstraintMode();',
    'const input = document.createElement("input");',
    'input.required = false;',
    'input.required = true;',
    'input.required = dynamicConstraint;',
    'input.disabled = true;',
    'input.disabled = false;',
    'input.readOnly = true;',
    'input.readOnly = false;',
    'input.pattern = ".*";',
    'input.min = "0";',
    'input.max = "999";',
    'input.minLength = 0;',
    'input.maxLength = 999;',
    'input.step = "any";',
    'input.type = "hidden";',
    'input.setAttribute("required", "false");',
    'input.setAttribute("disabled", "false");',
    'input.removeAttribute("required");',
    'input.removeAttribute("disabled");',
    'input.toggleAttribute("required", false);',
    'input.toggleAttribute("required", true);',
    'input.toggleAttribute("disabled", true);',
    'input.toggleAttribute("disabled", false);',
    'const textarea = document.createElement("textarea");',
    'textarea.readOnly = true;',
    'textarea.maxLength = 5000;',
    'const select = document.createElement("select");',
    'select.required = false;',
    'select.disabled = true;',
    'const fieldset = document.createElement("fieldset");',
    'fieldset.disabled = true;',
    'Object.assign(input, { pattern: ".+" });',
    'Reflect.set(input, "type", "text");',
    'Object.defineProperty(input, "required", { value: false });',
    'Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "disabled").set.call(input, true);',
    'input.setAttributeNS(null, "readonly", "");',
    'input.removeAttributeNS(null, "required");',
    'Reflect.apply(Element.prototype.removeAttribute, input, ["pattern"]);',
    'Reflect.apply(Element.prototype.toggleAttribute, input, ["required", false]);',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-form-constraint-integrity.self-test.ts",
    { formConstraintIntegrityPolicy: true },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 20
    || counts["programmatic-constraint-weaken"] !== 8
    || counts["programmatic-constraint-dynamic"] !== 1
    || counts["programmatic-constraint-mutation"] !== 11
  ) {
    throw new Error("Programmatic form constraint integrity authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'const dynamicValidation = chooseValidationMode();',
    'const form = document.createElement("form");',
    'form.noValidate = true;',
    'form.noValidate = false;',
    'form.noValidate = dynamicValidation;',
    'form.setAttribute("novalidate", "false");',
    'form.setAttributeNS(null, "novalidate", "false");',
    'form.toggleAttribute("novalidate", true);',
    'form.toggleAttribute("novalidate", false);',
    'form.toggleAttribute("novalidate");',
    'Object.assign(form, { noValidate: true });',
    'Reflect.set(form, "noValidate", false);',
    'Object.defineProperty(form, "noValidate", { value: true });',
    'Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "noValidate").set.call(form, true);',
    'Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "noValidate").set.call(form, false);',
    'const button = document.createElement("button");',
    'button.formNoValidate = true;',
    'button.formNoValidate = false;',
    'button.setAttribute("formnovalidate", "");',
    'const input = document.createElement("input");',
    'input.formNoValidate = dynamicValidation;',
    'Reflect.set(input, "formNoValidate", true);',
    'Reflect.apply(Element.prototype.setAttributeNS, input, [null, "formnovalidate", ""]);',
    'Reflect.apply(Element.prototype.toggleAttribute, button, ["formnovalidate", true]);',
    'form.submit();',
    'form.requestSubmit(button);',
    'HTMLFormElement.prototype.submit.call(form);',
    'Reflect.apply(HTMLFormElement.prototype.requestSubmit, form, [button]);',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-form-validation-bypass.self-test.ts",
    { formValidationBypassPolicy: true },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 19
    || counts["programmatic-validation-bypass"] !== 12
    || counts["programmatic-validation-dynamic"] !== 3
    || counts["programmatic-validation-submit"] !== 2
    || counts["programmatic-validation-submitter"] !== 2
  ) {
    throw new Error("Programmatic form validation bypass authority self-test failed: " + JSON.stringify(violations));
  }
}

{
  const selfTest = [
    'import { getExternalNavigationHref } from "@/lib/route-semantics";',
    'const safeExternal = getExternalNavigationHref("https://example.com/safe");',
    'const dynamicTarget = chooseTarget();',
    'window.open(safeExternal, "_blank");',
    'window.open(safeExternal, "_blank", "noopener,noreferrer");',
    'window.open(safeExternal, "_self");',
    'window.open(safeExternal, "_top", "noopener");',
    'window.open(safeExternal, dynamicTarget, "noopener");',
    'window.open(safeExternal);',
    'const openAlias = window.open;',
    'openAlias(safeExternal, "named-window", "noopener");',
    'const boundSafeOpen = window.open.bind(window, safeExternal, "_blank", "noopener");',
    'boundSafeOpen();',
    'const anchor = document.createElement("a");',
    'anchor.target = "_blank";',
    'anchor.target = "_self";',
    'const form = document.createElement("form");',
    'form.target = "_parent";',
    'const button = document.createElement("button");',
    'button.formTarget = dynamicTarget;',
    'anchor.setAttribute("target", "named-frame");',
    'Object.assign(form, { target: "_blank" });',
    'Reflect.set(anchor, "target", "_self");',
    'Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "target").set.call(anchor, "_blank");',
  ].join("\n");
  const violations = auditImperativeNavigation(
    selfTest,
    "programmatic-target-context.self-test.ts",
    { programmaticTargetContextPolicy: true },
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 11
    || counts["programmatic-target-context"] !== 7
    || counts["programmatic-target-dynamic"] !== 2
    || counts["programmatic-target-blank-opener"] !== 1
    || counts["programmatic-target-implicit"] !== 1
  ) {
    throw new Error("Programmatic target context policy self-test failed: " + JSON.stringify(violations));
  }
}

function auditNavigationSideEffectBoundary(source, path) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const violations = [];
  const redirectBindings = new Set([
    ...importedBindingNames(sourceFile, "next/navigation", "redirect"),
    ...importedBindingNames(sourceFile, "next/navigation", "permanentRedirect"),
  ]);
  const useRouterBindings = importedBindingNames(sourceFile, "next/navigation", "useRouter");
  const nextResponseBindings = importedBindingNames(sourceFile, "next/server", "NextResponse");
  const sideEffectMessageEventVariables = new Set();

  function sideEffectIsMessageEventTypeNode(typeNode) {
    if (!typeNode) return false;
    if (ts.isParenthesizedTypeNode(typeNode)) {
      return sideEffectIsMessageEventTypeNode(typeNode.type);
    }
    if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
      return typeNode.types.some(sideEffectIsMessageEventTypeNode);
    }
    if (!ts.isTypeReferenceNode(typeNode)) return false;
    return typeNode.typeName.getText(sourceFile).split(".").pop() === "MessageEvent";
  }

  function collectSideEffectMessageEvents(node) {
    if (
      (ts.isParameter(node) || ts.isVariableDeclaration(node))
      && ts.isIdentifier(node.name)
      && node.type
      && sideEffectIsMessageEventTypeNode(node.type)
    ) {
      sideEffectMessageEventVariables.add(node.name.text);
    }
    ts.forEachChild(node, collectSideEffectMessageEvents);
  }

  collectSideEffectMessageEvents(sourceFile);

  function sideEffectPropertyName(expression) {
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    if (
      ts.isElementAccessExpression(expression)
      && expression.argumentExpression
      && ts.isStringLiteralLike(expression.argumentExpression)
    ) return expression.argumentExpression.text;
    return null;
  }

  function sideEffectPropertyOwner(expression) {
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      return expression.expression;
    }
    return null;
  }

  function sideEffectBrowsingContextText(text) {
    if (!text) return false;
    if (text.endsWith(".source")) {
      const eventText = text.slice(0, -".source".length);
      if (sideEffectMessageEventVariables.has(eventText)) return true;
    }
    if (text.endsWith(".defaultView")) {
      const documentText = text.slice(0, -".defaultView".length);
      if (sideEffectDocumentText(documentText)) return true;
    }
    if (
      text === "window"
      || text === "globalThis"
      || text === "self"
      || text === "top"
      || text === "parent"
      || text === "opener"
    ) return true;

    if (
      /^(?:window|globalThis|self|top|parent|opener)(?:\.(?:self|top|parent|opener))+$/.test(text)
    ) return true;

    if (
      /^(?:(?:window|globalThis|self|top|parent|opener)\.)?frames\[[^\]]+\](?:\[\s*\d+\s*\])*$/.test(text)
    ) return true;

    if (
      /^(?:window|globalThis|self|top|parent|opener)(?:\.(?:self|top|parent|opener))*(?:\[\s*\d+\s*\])+$/.test(text)
    ) return true;

    return /\.contentWindow$/.test(text);
  }

  function sideEffectDocumentText(text) {
    if (text === "document") return true;
    if (text?.endsWith(".ownerDocument") || text?.endsWith(".contentDocument")) return true;
    if (!text?.endsWith(".document")) return false;
    return sideEffectBrowsingContextText(text.slice(0, -".document".length));
  }

  function sideEffectLocationText(text) {
    if (text === "location") return true;
    if (!text?.endsWith(".location")) return false;
    const owner = text.slice(0, -".location".length);
    return sideEffectBrowsingContextText(owner) || sideEffectDocumentText(owner);
  }

  function sideEffectHistoryText(text) {
    if (text === "history") return true;
    if (!text?.endsWith(".history")) return false;
    return sideEffectBrowsingContextText(text.slice(0, -".history".length));
  }

  function sideEffectNavigationText(text) {
    if (text === "navigation") return true;
    if (!text?.endsWith(".navigation")) return false;
    return sideEffectBrowsingContextText(text.slice(0, -".navigation".length));
  }

  function sideEffectObjectProperty(objectLiteral, name) {
    if (!objectLiteral || !ts.isObjectLiteralExpression(objectLiteral)) return null;
    for (const property of objectLiteral.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = ts.isIdentifier(property.name)
        ? property.name.text
        : ts.isStringLiteralLike(property.name)
          ? property.name.text
          : null;
      if (key?.toLowerCase() === name.toLowerCase()) return property.initializer;
    }
    return null;
  }

  function sideEffectRedirectConstructor(node) {
    if (!ts.isNewExpression(node)) return false;
    const constructorText = node.expression.getText(sourceFile);
    const isResponseConstructor = (
      constructorText === "Response"
      || constructorText === "globalThis.Response"
      || (
        ts.isIdentifier(node.expression)
        && nextResponseBindings.has(node.expression.text)
      )
    );
    if (!isResponseConstructor) return false;

    const init = node.arguments?.[1];
    if (!init || !ts.isObjectLiteralExpression(init)) return false;
    const statusExpression = sideEffectObjectProperty(init, "status");
    if (!statusExpression || !ts.isNumericLiteral(statusExpression)) return false;
    const status = Number(statusExpression.text);
    if (status < 300 || status > 399) return false;

    const headers = sideEffectObjectProperty(init, "headers");
    return Boolean(
      headers
      && ts.isObjectLiteralExpression(headers)
      && sideEffectObjectProperty(headers, "location")
    );
  }

  function report(node, kind) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({
      kind,
      path,
      line: position.line + 1,
      column: position.character + 1,
      targets: [],
    });
  }

  function browserOwnerText(expression) {
    if (!expression) return "";
    return expression.getText(sourceFile);
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;

      if (
        ts.isIdentifier(expression)
        && (redirectBindings.has(expression.text) || useRouterBindings.has(expression.text))
      ) {
        report(node, redirectBindings.has(expression.text) ? "server-navigation" : "router-capability");
      }

      if (
        (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))
      ) {
        const owner = sideEffectPropertyOwner(expression);
        const method = sideEffectPropertyName(expression);
        const ownerText = browserOwnerText(owner);

        if (
          owner
          && ts.isIdentifier(owner)
          && nextResponseBindings.has(owner.text)
          && method === "redirect"
        ) {
          report(node, "route-handler-navigation");
        }

        if (
          (ownerText === "Response" || ownerText === "globalThis.Response")
          && method === "redirect"
        ) {
          report(node, "web-response-navigation");
        }

        if (
          sideEffectLocationText(ownerText)
          && (method === "assign" || method === "replace")
        ) {
          report(node, "browser-navigation");
        }

        if (sideEffectLocationText(ownerText) && method === "reload") {
          report(node, "browser-reload");
        }

        if (
          sideEffectHistoryText(ownerText)
          && (method === "pushState" || method === "replaceState")
        ) {
          report(node, "history-navigation");
        }

        if (
          sideEffectHistoryText(ownerText)
          && (method === "back" || method === "forward" || method === "go")
        ) {
          report(node, "history-traversal");
        }

        if (sideEffectNavigationText(ownerText) && method === "navigate") {
          report(node, "navigation-api");
        }

        if (
          sideEffectNavigationText(ownerText)
          && (method === "back" || method === "forward" || method === "reload" || method === "traverseTo")
        ) {
          report(node, "navigation-api-traversal");
        }

        if (sideEffectBrowsingContextText(ownerText) && method === "open") {
          report(node, "browser-window-navigation");
        }
      }
    }

    if (sideEffectRedirectConstructor(node)) {
      report(node, "response-location-navigation");
    }

    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const leftText = node.left.getText(sourceFile);
      const locationAssignment = sideEffectLocationText(leftText);
      const hrefAssignment = leftText.endsWith(".href")
        && sideEffectLocationText(leftText.slice(0, -".href".length));
      if (locationAssignment || hrefAssignment) {
        report(node, "browser-navigation");
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

{
  const selfTest = [
    'import { redirect, useRouter } from "next/navigation";',
    'import { NextResponse } from "next/server";',
    'import { getRouteNavigationHref } from "@/lib/route-semantics";',
    'export function hiddenRedirect(target) { redirect(target); }',
    'export function hiddenRouter() { return useRouter(); }',
    'export function hiddenResponse(target) { return NextResponse.redirect(target); }',
    'export function hiddenWebResponse(target) { return Response.redirect(target); }',
    'export function hiddenResponseInit(target) { return new Response(null, { status: 302, headers: { Location: target } }); }',
    'export function hiddenBrowser(target) { window.location.assign(target); }',
    'export function hiddenDocument(target) { document.location.replace(target); }',
    'export function hiddenEmbeddedDocument(target) { iframe.contentDocument.location.assign(target); }',
    'export function hiddenTop(target) { top.location.assign(target); }',
    'export function hiddenFrame(target) { frames[0].location.replace(target); }',
    'export function hiddenIndexedContext(target) { window[0].location.assign(target); }',
    'export function hiddenMessageSource(event: MessageEvent, target) { event.source.location.assign(target); }',
    'export function hiddenHistory(target) { history.pushState({}, "", target); }',
    'export function hiddenMessageSourceHistory(event: MessageEvent, target) { event.source.history.pushState({}, "", target); }',
    'export function hiddenIndexedContextHistory(target) { parent[1].history.pushState({}, "", target); }',
    'export function hiddenEmbeddedViewHistory(target) { iframe.contentDocument.defaultView.history.pushState({}, "", target); }',
    'export function hiddenParentHistory(target) { parent.history.pushState({}, "", target); }',
    'export function hiddenHistoryBack() { history.back(); }',
    'export function hiddenReload() { location.reload(); }',
    'export function hiddenWindow(target) { window.open(target, "_blank"); }',
    'export function hiddenOpenerWindow(target) { opener.open(target, "_blank"); }',
    'export function hiddenNavigationApi(target) { navigation.navigate(target); }',
    'export function hiddenSelfNavigation(target) { self.navigation.navigate(target); }',
    'export function hiddenNavigationBack() { navigation.back(); }',
    'export function pureHref(target) { return getRouteNavigationHref("lib", target); }',
  ].join("\n");
  const violations = auditNavigationSideEffectBoundary(
    selfTest,
    "lib/navigation-side-effect.self-test.ts",
  );
  const counts = violations.reduce((acc, violation) => {
    acc[violation.kind] = (acc[violation.kind] ?? 0) + 1;
    return acc;
  }, {});
  if (
    violations.length !== 24
    || counts["browser-navigation"] !== 7
    || counts["browser-reload"] !== 1
    || counts["browser-window-navigation"] !== 2
    || counts["history-navigation"] !== 5
    || counts["history-traversal"] !== 1
    || counts["navigation-api"] !== 2
    || counts["navigation-api-traversal"] !== 1
    || counts["response-location-navigation"] !== 1
    || counts["route-handler-navigation"] !== 1
    || counts["router-capability"] !== 1
    || counts["server-navigation"] !== 1
    || counts["web-response-navigation"] !== 1
  ) {
    throw new Error("Navigation side-effect boundary self-test failed: " + JSON.stringify(violations));
  }
}

const navigationTargetContextViolations = ["app", "components"]
  .flatMap(collectTsxFiles)
  .flatMap((path) => auditNavigationTargetContexts(read(path), path));
if (navigationTargetContextViolations.length > 0) {
  throw new Error(
    "Navigation target context policy failed:\n"
    + navigationTargetContextViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.target ? " [" + violation.target + "]" : "")
      )
      .join("\n"),
  );
}

const navigationTransportViolations = ["app", "components"]
  .flatMap(collectTsxFiles)
  .flatMap((path) => auditStaticNavigationTransport(read(path), path));
if (navigationTransportViolations.length > 0) {
  throw new Error(
    "Navigation transport policy failed:\n"
    + navigationTransportViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.transport
        + " [" + violation.targets.join(", ") + "]"
      )
      .join("\n"),
  );
}

const embeddedContextSourceViolations = ["app", "components"]
  .flatMap(collectTsxFiles)
  .flatMap((path) => auditEmbeddedContextSources(read(path), path));
if (embeddedContextSourceViolations.length > 0) {
  throw new Error(
    "Embedded context source authority failed:\n"
    + embeddedContextSourceViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const executableUrlSchemeViolations = ["app", "components"]
  .flatMap(collectTsxFiles)
  .flatMap((path) => auditExecutableUrlSchemes(read(path), path));
if (executableUrlSchemeViolations.length > 0) {
  throw new Error(
    "Executable URL scheme boundary failed:\n"
    + executableUrlSchemeViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.schemes.join(", ")
        + " [" + violation.targets.join(", ") + "]"
      )
      .join("\n"),
  );
}

const semanticLinkViolations = SEMANTIC_LINK_ROOTS
  .flatMap(collectTsxFiles)
  .flatMap((path) => auditSemanticLinks(read(path), path));

const dynamicRouteProvenanceViolations = semanticLinkViolations
  .filter((violation) => violation.kind === "provenance");
if (dynamicRouteProvenanceViolations.length > 0) {
  throw new Error(
    "Dynamic Link route provenance failed:\n"
    + dynamicRouteProvenanceViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> unresolved href must use getRouteLinkProps() or a route/external href authority"
      )
      .join("\n"),
  );
}

const staticSemanticCoverageViolations = semanticLinkViolations
  .filter((violation) => violation.kind === "coverage");
if (staticSemanticCoverageViolations.length > 0) {
  throw new Error(
    "Product Link semantic coverage failed:\n"
    + staticSemanticCoverageViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.targets.join(", ") + " lacks transitionTypes"
      )
      .join("\n"),
  );
}

const verifiedReplayFormViolations = ["app", "components"]
  .flatMap(collectTsxFiles)
  .flatMap((path) => auditVerifiedReplayForms(read(path), path));
if (verifiedReplayFormViolations.length > 0) {
  throw new Error(
    "Verified replay form authority failed:\n"
    + verifiedReplayFormViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
      )
      .join("\n"),
  );
}

const declarativeNavigationViolations = SEMANTIC_LINK_ROOTS
  .flatMap(collectTsxFiles)
  .flatMap((path) => auditDeclarativeNavigation(read(path), path));
if (declarativeNavigationViolations.length > 0) {
  throw new Error(
    "Declarative navigation surface authority failed:\n"
    + declarativeNavigationViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const formSubmissionTransportViolations = SEMANTIC_LINK_ROOTS
  .flatMap(collectTsxFiles)
  .flatMap((path) => auditFormSubmissionTransport(read(path), path));
if (formSubmissionTransportViolations.length > 0) {
  throw new Error(
    "Form submission transport policy failed:\n"
    + formSubmissionTransportViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.value !== null ? " [" + violation.value + "]" : "")
      )
      .join("\n"),
  );
}

const formValidationBypassViolations = SEMANTIC_LINK_ROOTS
  .flatMap(collectTsxFiles)
  .flatMap((path) => auditFormValidationBypass(read(path), path));
if (formValidationBypassViolations.length > 0) {
  throw new Error(
    "Form validation bypass authority failed:\n"
    + formValidationBypassViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
      )
      .join("\n"),
  );
}

const nativeAnchorViolations = SEMANTIC_LINK_ROOTS
  .flatMap(collectTsxFiles)
  .flatMap((path) => auditNativeAnchors(read(path), path));
if (nativeAnchorViolations.length > 0) {
  throw new Error(
    "Native anchor navigation provenance failed:\n"
    + nativeAnchorViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + (
          violation.kind === "dynamic-provenance"
            ? " -> dynamic native href must be outside-product and use route/external href authority"
            : " -> native anchor must be explicitly outside-product"
        )
      )
      .join("\n"),
  );
}

const hiddenNavigationModuleViolations = ["lib", "providers"]
  .flatMap(collectTypeScriptFiles)
  .flatMap((path) => auditNavigationSideEffectBoundary(read(path), path));
if (hiddenNavigationModuleViolations.length > 0) {
  throw new Error(
    "Navigation side-effect boundary failed:\n"
    + hiddenNavigationModuleViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
      )
      .join("\n"),
  );
}

const allImperativeNavigationViolations = ["app", "components", "lib", "providers"]
  .flatMap(collectTypeScriptFiles)
  .flatMap((path) => auditImperativeNavigation(
    read(path),
    path,
    {
      programmaticTargetContextPolicy: true,
      formSubmissionTransportPolicy: true,
      formValidationBypassPolicy: true,
      formConstraintIntegrityPolicy: true,
      formControlParticipationPolicy: true,
      formOwnershipProvenancePolicy: true,
      formOwnershipLifecyclePolicy: true,
      formOwnershipRelocationPolicy: true,
      programmaticFormOwnershipStatePolicy: true,
      programmaticFormOwnershipControlFlowPolicy: true,
      programmaticFormOwnershipExecutionScopePolicy: true,
      programmaticFormOwnershipCallbackSchedulingPolicy: true,
      programmaticFormOwnershipCallbackLifetimePolicy: true,
      programmaticFormOwnershipCallbackTeardownPathPolicy: true,
      programmaticFormOwnershipCallbackTeardownControlFlowPolicy: true,
      programmaticFormOwnershipCallbackTeardownLoopPolicy: true,
      programmaticFormOwnershipCallbackTeardownLabeledIterationPolicy: true,
    },
  ));

const dynamicCodeExecutionViolations = allImperativeNavigationViolations
  .filter((violation) => violation.kind.startsWith("dynamic-code-"));
if (dynamicCodeExecutionViolations.length > 0) {
  throw new Error(
    "Dynamic code execution boundary failed:\n"
    + dynamicCodeExecutionViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
      )
      .join("\n"),
  );
}

const proxyNavigationViolations = allImperativeNavigationViolations
  .filter((violation) => violation.kind.startsWith("proxy-navigation-"));
if (proxyNavigationViolations.length > 0) {
  throw new Error(
    "Proxy navigation capability boundary failed:\n"
    + proxyNavigationViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
      )
      .join("\n"),
  );
}

const nativeInvocationViolations = allImperativeNavigationViolations
  .filter((violation) => violation.kind.startsWith("native-invoke-"));
if (nativeInvocationViolations.length > 0) {
  throw new Error(
    "Native invocation boundary failed:\n"
    + nativeInvocationViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " targets " + violation.targets.join(", ") : "")
      )
      .join("\n"),
  );
}

const programmaticFormOwnershipCallbackTeardownLoopViolations = allImperativeNavigationViolations
  .filter(
    (violation) =>
      violation.kind === "programmatic-ownership-scheduled-teardown-loop-dynamic",
  );
if (programmaticFormOwnershipCallbackTeardownLoopViolations.length > 0) {
  throw new Error(
    "Programmatic form ownership callback teardown loop authority failed:\n"
    + programmaticFormOwnershipCallbackTeardownLoopViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticFormOwnershipCallbackTeardownControlFlowViolations = allImperativeNavigationViolations
  .filter(
    (violation) =>
      violation.kind === "programmatic-ownership-scheduled-teardown-path-dynamic",
  );
if (programmaticFormOwnershipCallbackTeardownControlFlowViolations.length > 0) {
  throw new Error(
    "Programmatic form ownership callback teardown control-flow authority failed:\n"
    + programmaticFormOwnershipCallbackTeardownControlFlowViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticFormOwnershipCallbackTeardownPathViolations = allImperativeNavigationViolations
  .filter(
    (violation) =>
      violation.kind === "programmatic-ownership-scheduled-bounded-dynamic",
  );
if (programmaticFormOwnershipCallbackTeardownPathViolations.length > 0) {
  throw new Error(
    "Programmatic form ownership callback teardown path authority failed:\n"
    + programmaticFormOwnershipCallbackTeardownPathViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticFormOwnershipCallbackLifetimeViolations = allImperativeNavigationViolations
  .filter(
    (violation) =>
      violation.kind === "programmatic-ownership-scheduled-repeat-dynamic",
  );
if (programmaticFormOwnershipCallbackLifetimeViolations.length > 0) {
  throw new Error(
    "Programmatic form ownership callback lifetime authority failed:\n"
    + programmaticFormOwnershipCallbackLifetimeViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticFormOwnershipCallbackSchedulingViolations = allImperativeNavigationViolations
  .filter(
    (violation) =>
      violation.kind === "programmatic-ownership-scheduled-dynamic",
  );
if (programmaticFormOwnershipCallbackSchedulingViolations.length > 0) {
  throw new Error(
    "Programmatic form ownership callback scheduling authority failed:\n"
    + programmaticFormOwnershipCallbackSchedulingViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticFormOwnershipControlFlowViolations = allImperativeNavigationViolations
  .filter(
    (violation) =>
      violation.kind === "programmatic-ownership-control-flow-dynamic",
  );
if (programmaticFormOwnershipControlFlowViolations.length > 0) {
  throw new Error(
    "Programmatic form ownership control-flow authority failed:\n"
    + programmaticFormOwnershipControlFlowViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticFormOwnershipStateViolations = allImperativeNavigationViolations
  .filter((violation) => violation.kind === "programmatic-ownership-state-evict");
if (programmaticFormOwnershipStateViolations.length > 0) {
  throw new Error(
    "Programmatic form ownership state authority failed:\n"
    + programmaticFormOwnershipStateViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticFormOwnershipRelocationViolations = allImperativeNavigationViolations
  .filter((violation) =>
    violation.kind === "programmatic-ownership-reassociate"
    || violation.kind === "programmatic-ownership-escape"
    || violation.kind === "programmatic-ownership-relocation-dynamic"
  );
if (programmaticFormOwnershipRelocationViolations.length > 0) {
  throw new Error(
    "Programmatic form ownership relocation authority failed:\n"
    + programmaticFormOwnershipRelocationViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticFormOwnershipLifecycleViolations = allImperativeNavigationViolations
  .filter((violation) =>
    violation.kind === "programmatic-ownership-detach"
    || violation.kind === "programmatic-ownership-replace"
  );
if (programmaticFormOwnershipLifecycleViolations.length > 0) {
  throw new Error(
    "Programmatic form ownership lifecycle authority failed:\n"
    + programmaticFormOwnershipLifecycleViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticFormControlParticipationViolations = allImperativeNavigationViolations
  .filter((violation) => violation.kind.startsWith("programmatic-participation-"));
if (programmaticFormControlParticipationViolations.length > 0) {
  throw new Error(
    "Programmatic form control participation authority failed:\n"
    + programmaticFormControlParticipationViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticFormConstraintIntegrityViolations = allImperativeNavigationViolations
  .filter((violation) => violation.kind.startsWith("programmatic-constraint-"));
if (programmaticFormConstraintIntegrityViolations.length > 0) {
  throw new Error(
    "Programmatic form constraint integrity authority failed:\n"
    + programmaticFormConstraintIntegrityViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticFormValidationBypassViolations = allImperativeNavigationViolations
  .filter((violation) => violation.kind.startsWith("programmatic-validation-"));
if (programmaticFormValidationBypassViolations.length > 0) {
  throw new Error(
    "Programmatic form validation bypass authority failed:\n"
    + programmaticFormValidationBypassViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticFormSubmissionTransportViolations = allImperativeNavigationViolations
  .filter((violation) => violation.kind.startsWith("programmatic-form-"));
if (programmaticFormSubmissionTransportViolations.length > 0) {
  throw new Error(
    "Programmatic form submission transport policy failed:\n"
    + programmaticFormSubmissionTransportViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " [" + violation.targets.join(", ") + "]" : "")
      )
      .join("\n"),
  );
}

const programmaticTargetContextViolations = allImperativeNavigationViolations
  .filter((violation) => violation.kind.startsWith("programmatic-target-"));
if (programmaticTargetContextViolations.length > 0) {
  throw new Error(
    "Programmatic target context policy failed:\n"
    + programmaticTargetContextViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " targets " + violation.targets.join(", ") : "")
      )
      .join("\n"),
  );
}

const embeddedContextRuntimeSourceViolations = allImperativeNavigationViolations
  .filter((violation) => violation.kind.startsWith("embedded-runtime-"));
if (embeddedContextRuntimeSourceViolations.length > 0) {
  throw new Error(
    "Embedded context runtime source authority failed:\n"
    + embeddedContextRuntimeSourceViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " targets " + violation.targets.join(", ") : "")
      )
      .join("\n"),
  );
}

const domNavigationMutationViolations = allImperativeNavigationViolations
  .filter((violation) => violation.kind.startsWith("dom-"));
if (domNavigationMutationViolations.length > 0) {
  throw new Error(
    "DOM navigation mutation authority failed:\n"
    + domNavigationMutationViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " targets " + violation.targets.join(", ") : "")
      )
      .join("\n"),
  );
}

const imperativeNavigationViolations = allImperativeNavigationViolations
  .filter((violation) =>
    !violation.kind.startsWith("programmatic-target-")
    && !violation.kind.startsWith("programmatic-form-")
    && !violation.kind.startsWith("programmatic-validation-")
    && !violation.kind.startsWith("programmatic-constraint-")
    && !violation.kind.startsWith("programmatic-participation-")
    && !violation.kind.startsWith("programmatic-ownership-")
    && !violation.kind.startsWith("embedded-runtime-")
    && !violation.kind.startsWith("dom-")
    && !violation.kind.startsWith("native-invoke-")
    && !violation.kind.startsWith("proxy-navigation-")
    && !violation.kind.startsWith("dynamic-code-")
  );
if (imperativeNavigationViolations.length > 0) {
  throw new Error(
    "Imperative navigation provenance failed:\n"
    + imperativeNavigationViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> " + violation.kind
        + (violation.targets.length ? " targets " + violation.targets.join(", ") : "")
      )
      .join("\n"),
  );
}

for (const [contextPath, fragments] of [
  ["lib/route-semantics.ts", [
    "export type RouteNavigationHref",
    "export type ProductRouteSuffix",
    "export function getRouteNavigationHref",
    "export function getExternalNavigationHref",
  ]],
  ["components/direct-start-button.tsx", [
    'getRouteNavigationHref("earn"',
    'getExternalNavigationHref(payload.destination)',
  ]],
  ["app/api/pulse/claim/route.ts", [
    'getProductRouteHref("home",',
  ]],
  ["app/api/withdrawals/route.ts", [
    'getProductRouteHref("wallet",',
  ]],
  ["app/auth/callback/route.ts", [
    'getRouteNavigationHref("auth", next)',
  ]],
  ["app/auth/confirm/route.ts", [
    'getRouteNavigationHref("auth", next)',
  ]],
  ["lib/experience-presentation.ts", [
    "type ProductRouteHref",
    "href: ProductRouteHref | `/auth${string}`",
    'href: getProductRouteHref("home")',
  ]],
  ["lib/pulse-ecosystem.ts", [
    "href: ProductRouteHref",
    'href: getProductRouteHref("home")',
    'href: getProductRouteHref("earn")',
    'href: getProductRouteHref("invite")',
  ]],
  ["components/app-shell.tsx", [
    'href: getProductRouteHref("home")',
    'getRouteLinkProps(active, href)',
  ]],
]) {
  requireText(contextPath, fragments);
}

console.log("Native route continuity static contract PASS");
