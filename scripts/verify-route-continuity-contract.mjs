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
  'import { getProductRouteHref, getRouteLinkProps, getRouteSemanticDimension } from "@/lib/route-semantics";',
  'href: getProductRouteHref("home")',
  "getRouteLinkProps(active, href)",
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
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

      if (unresolvedDynamicHref && !routeLinkAuthority && !explicitOutsideProduct) {
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
    'import { getRouteLinkProps } from "@/lib/route-semantics";',
    "const Fixture = ({ signedIn, mission, admin }) => (",
    "  <>",
    "    <Link href=\"/progress\">Missing static coverage</Link>",
    "    <Link href={\"/wallet?tab=history\"} transitionTypes={[\"pc-forward\"]}>Covered static product route</Link>",
    "    <Link href={signedIn ? \"/invite#network\" : \"/auth\"} transitionTypes={routeTypes}>Conditional static candidates</Link>",
    "    <Link href={mission.href} transitionTypes={getRouteTransitionTypesForHref(\"earn\", mission.href)}>Unproven dynamic route</Link>",
    "    <Link {...getRouteLinkProps(\"earn\", mission.href)}>Authoritative dynamic route</Link>",
    "    <Link href={admin.href} data-route-semantic=\"outside-product\">Explicit dynamic escape</Link>",
    "    <Link href=\"/dashboard\" data-route-semantic=\"outside-product\">Explicit public escape</Link>",
    "  </>",
    ");",
  ].join("\n");
  const violations = auditSemanticLinks(selfTest, "semantic-link-coverage.self-test.tsx");
  if (
    violations.length !== 2
    || violations.filter((violation) => violation.kind === "coverage").length !== 1
    || violations.filter((violation) => violation.kind === "provenance").length !== 1
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

  function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && node.tagName.getText(sourceFile) === "a"
    ) {
      const href = jsxAttribute(node, "href");
      const targets = hrefCandidates(href)
        .map(normalizedProductRoute)
        .filter(Boolean);
      const explicitOutsideProduct = literalJsxAttributeValue(
        jsxAttribute(node, "data-route-semantic"),
      ) === OUTSIDE_PRODUCT_ROUTE_MARKER;
      const unresolvedDynamicHref = hasUnresolvedDynamicHref(href);
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

      if ((targets.length > 0 || unresolvedDynamicHref) && !explicitOutsideProduct) {
        violations.push({
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

function authorityCall(expression, bindings) {
  return Boolean(
    expression
    && ts.isCallExpression(expression)
    && ts.isIdentifier(expression.expression)
    && bindings.has(expression.expression.text)
  );
}

function auditImperativeNavigation(source, path) {
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
  const responseRedirectBindings = new Set();
  const webResponseRedirectBindings = new Set();
  const browserLocationVariables = new Set();
  const browserLocationMethodBindings = new Set();
  const browserHistoryVariables = new Set();
  const browserHistoryMethodBindings = new Set();
  const browserNavigationApiVariables = new Set();
  const browserNavigationApiMethodBindings = new Set();
  const browserWindowOpenBindings = new Set();
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

  function collectDeclarations(node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      registerLocalFunction(node.name.text, node);
    }

    if (ts.isVariableDeclaration(node)) {
      declarations.push(node);
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

  function isBrowserLocationObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && browserLocationVariables.has(resolved.text)) return true;
    const text = resolved.getText(sourceFile);
    return (
      text === "window.location"
      || text === "document.location"
      || text === "globalThis.location"
      || text === "location"
    );
  }

  function isBrowserHistoryObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && browserHistoryVariables.has(resolved.text)) return true;
    const text = resolved.getText(sourceFile);
    return text === "window.history" || text === "globalThis.history" || text === "history";
  }

  function isBrowserNavigationApiObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isIdentifier(resolved) && browserNavigationApiVariables.has(resolved.text)) return true;
    const text = resolved.getText(sourceFile);
    return text === "window.navigation" || text === "globalThis.navigation" || text === "navigation";
  }

  function isBrowserWindowObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    const text = resolved.getText(sourceFile);
    return text === "window" || text === "globalThis";
  }

  function isWebResponseObject(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    const text = resolved.getText(sourceFile);
    return text === "Response" || text === "globalThis.Response";
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
        const initializerText = initializer.getText(sourceFile);
        if (
          initializerText === "window.location"
          || initializerText === "document.location"
          || initializerText === "globalThis.location"
          || initializerText === "location"
        ) {
          changed = addBinding(browserLocationVariables, local) || changed;
        }
        if (
          initializerText === "window.history"
          || initializerText === "globalThis.history"
          || initializerText === "history"
        ) {
          changed = addBinding(browserHistoryVariables, local) || changed;
        }
        if (
          initializerText === "window.navigation"
          || initializerText === "globalThis.navigation"
          || initializerText === "navigation"
        ) {
          changed = addBinding(browserNavigationApiVariables, local) || changed;
        }
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

      if (initializer && (ts.isPropertyAccessExpression(initializer) || ts.isElementAccessExpression(initializer))) {
        const owner = propertyOwner(initializer);
        const method = propertyName(initializer);
        if (isRouterObject(owner) && (method === "push" || method === "replace")) {
          changed = addBinding(routerMethodBindings, local) || changed;
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
        if (isBrowserHistoryObject(owner) && (method === "pushState" || method === "replaceState")) {
          changed = addBinding(browserHistoryMethodBindings, local) || changed;
        }
        if (isBrowserNavigationApiObject(owner) && method === "navigate") {
          changed = addBinding(browserNavigationApiMethodBindings, local) || changed;
        }
        if (isBrowserWindowObject(owner) && method === "open") {
          changed = addBinding(browserWindowOpenBindings, local) || changed;
        }
      }

      if (initializer && ts.isIdentifier(initializer)) {
        if (routerMethodBindings.has(initializer.text)) {
          changed = addBinding(routerMethodBindings, local) || changed;
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
        if (browserHistoryMethodBindings.has(initializer.text)) {
          changed = addBinding(browserHistoryMethodBindings, local) || changed;
        }
        if (browserNavigationApiMethodBindings.has(initializer.text)) {
          changed = addBinding(browserNavigationApiMethodBindings, local) || changed;
        }
        if (browserWindowOpenBindings.has(initializer.text)) {
          changed = addBinding(browserWindowOpenBindings, local) || changed;
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

      for (const element of node.name.elements) {
        const sourceName = bindingSourceName(element);
        const localName = bindingLocalName(element);
        if (!sourceName || !localName) continue;
        if (fromRouter && (sourceName === "push" || sourceName === "replace")) {
          changed = addBinding(routerMethodBindings, localName) || changed;
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
        if (fromHistory && (sourceName === "pushState" || sourceName === "replaceState")) {
          changed = addBinding(browserHistoryMethodBindings, localName) || changed;
        }
        if (fromNavigationApi && sourceName === "navigate") {
          changed = addBinding(browserNavigationApiMethodBindings, localName) || changed;
        }
        if (fromWindow && sourceName === "open") {
          changed = addBinding(browserWindowOpenBindings, localName) || changed;
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

  function isBrowserHrefAssignmentTarget(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isPropertyAccessExpression(resolved)) {
      const text = resolved.getText(sourceFile);
      if (
        text === "window.location"
        || text === "document.location"
        || text === "globalThis.location"
      ) return true;
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

  function numericLiteralValue(expression) {
    const resolved = resolveDataExpression(expression);
    if (resolved && ts.isNumericLiteral(resolved)) return Number(resolved.text);
    return null;
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

  function visit(node, env = new Map(), callStack = new Set()) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const firstArg = node.arguments[0];

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

      if (
        isBrowserLocationMethodReference(expression, env)
        && !browserNavigationAuthority(firstArg, env, callStack)
      ) {
        report(node, "browser-location");
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

      if (
        isBrowserWindowOpenReference(expression, env)
        && firstArg
        && !browserNavigationAuthority(firstArg, env, callStack)
      ) {
        report(node, "browser-window-open");
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
          || isBrowserLocationObject(argument, env)
          || isBrowserLocationMethodReference(argument, env)
          || isBrowserHistoryObject(argument, env)
          || isBrowserHistoryMethodReference(argument, env)
          || isBrowserNavigationApiObject(argument, env)
          || isBrowserNavigationApiMethodReference(argument, env)
          || isBrowserWindowOpenReference(argument, env)
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
      && isBrowserHrefAssignmentTarget(node.left, env)
      && !browserNavigationAuthority(node.right, env, callStack)
    ) {
      report(node, "browser-location");
    }

    ts.forEachChild(node, (child) => visit(child, env, callStack));
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
          (
            ownerText === "window.location"
            || ownerText === "document.location"
            || ownerText === "globalThis.location"
            || ownerText === "location"
          )
          && (method === "assign" || method === "replace")
        ) {
          report(node, "browser-navigation");
        }

        if (
          (
            ownerText === "window.history"
            || ownerText === "globalThis.history"
            || ownerText === "history"
          )
          && (method === "pushState" || method === "replaceState")
        ) {
          report(node, "history-navigation");
        }

        if (
          (
            ownerText === "window.navigation"
            || ownerText === "globalThis.navigation"
            || ownerText === "navigation"
          )
          && method === "navigate"
        ) {
          report(node, "navigation-api");
        }

        if ((ownerText === "window" || ownerText === "globalThis") && method === "open") {
          report(node, "browser-window-navigation");
        }
      }
    }

    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const leftText = node.left.getText(sourceFile);
      if (
        leftText === "window.location"
        || leftText === "document.location"
        || leftText === "globalThis.location"
        || leftText === "location.href"
        || leftText === "window.location.href"
        || leftText === "document.location.href"
        || leftText === "globalThis.location.href"
      ) {
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
    'export function hiddenBrowser(target) { window.location.assign(target); }',
    'export function hiddenDocument(target) { document.location.replace(target); }',
    'export function hiddenHistory(target) { history.pushState({}, "", target); }',
    'export function hiddenWindow(target) { window.open(target, "_blank"); }',
    'export function hiddenNavigationApi(target) { navigation.navigate(target); }',
    'export function pureHref(target) { return getRouteNavigationHref("lib", target); }',
  ].join("\n");
  const violations = auditNavigationSideEffectBoundary(
    selfTest,
    "lib/navigation-side-effect.self-test.ts",
  );
  const kinds = violations.map((violation) => violation.kind).sort();
  if (
    violations.length !== 8
    || kinds.join(",") !== "browser-navigation,browser-navigation,browser-window-navigation,history-navigation,navigation-api,route-handler-navigation,router-capability,server-navigation"
  ) {
    throw new Error("Navigation side-effect boundary self-test failed: " + JSON.stringify(violations));
  }
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
        + " -> unresolved href must use getRouteLinkProps() or an explicit outside-product contract"
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

const nativeAnchorViolations = SEMANTIC_LINK_ROOTS
  .flatMap(collectTsxFiles)
  .flatMap((path) => auditNativeAnchors(read(path), path));
if (nativeAnchorViolations.length > 0) {
  throw new Error(
    "Native anchor navigation provenance failed:\n"
    + nativeAnchorViolations
      .map((violation) =>
        "- " + violation.path + ":" + violation.line + ":" + violation.column
        + " -> native anchor must be explicitly outside-product"
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

const imperativeNavigationViolations = ["app", "components", "lib", "providers"]
  .flatMap(collectTypeScriptFiles)
  .flatMap((path) => auditImperativeNavigation(read(path), path));
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
