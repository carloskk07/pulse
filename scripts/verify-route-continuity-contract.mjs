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

function firstUrlArgument(expression) {
  if (
    expression
    && ts.isNewExpression(expression)
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === "URL"
  ) return expression.arguments?.[0] ?? null;
  return null;
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
  const redirectBindings = importedBindingNames(sourceFile, "next/navigation", "redirect");
  const nextResponseBindings = importedBindingNames(sourceFile, "next/server", "NextResponse");
  const navigationBindings = importedBindingNames(sourceFile, "@/lib/route-semantics", "getRouteNavigationHref");
  const productHrefBindings = importedBindingNames(sourceFile, "@/lib/route-semantics", "getProductRouteHref");
  const externalHrefBindings = importedBindingNames(sourceFile, "@/lib/route-semantics", "getExternalNavigationHref");

  const routerVariables = new Set();
  const routerMethodBindings = new Set();
  const responseRedirectBindings = new Set();
  const browserLocationVariables = new Set();
  const browserLocationMethodBindings = new Set();
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
    return text === "window.location" || text === "location";
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
      if (
        initializer
        && (initializer.getText(sourceFile) === "window.location" || initializer.getText(sourceFile) === "location")
      ) {
        changed = addBinding(browserLocationVariables, local) || changed;
      }
      if (initializer && ts.isIdentifier(initializer) && browserLocationVariables.has(initializer.text)) {
        changed = addBinding(browserLocationVariables, local) || changed;
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
        if (isBrowserLocationObject(owner) && (method === "assign" || method === "replace")) {
          changed = addBinding(browserLocationMethodBindings, local) || changed;
        }
      }

      if (initializer && ts.isIdentifier(initializer)) {
        if (routerMethodBindings.has(initializer.text)) {
          changed = addBinding(routerMethodBindings, local) || changed;
        }
        if (responseRedirectBindings.has(initializer.text)) {
          changed = addBinding(responseRedirectBindings, local) || changed;
        }
        if (browserLocationMethodBindings.has(initializer.text)) {
          changed = addBinding(browserLocationMethodBindings, local) || changed;
        }
      }
    }

    if (ts.isObjectBindingPattern(node.name) && initializer) {
      const fromRouter = isRouterObject(initializer);
      const fromResponse = ts.isIdentifier(initializer) && nextResponseBindings.has(initializer.text);
      const fromLocation = isBrowserLocationObject(initializer);

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
        if (fromLocation && (sourceName === "assign" || sourceName === "replace")) {
          changed = addBinding(browserLocationMethodBindings, localName) || changed;
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
    if (ts.isIdentifier(resolved) && responseRedirectBindings.has(resolved.text)) return true;
    return Boolean(
      (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved))
      && propertyName(resolved) === "redirect"
      && propertyOwner(resolved)
      && ts.isIdentifier(propertyOwner(resolved))
      && nextResponseBindings.has(propertyOwner(resolved).text)
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

  function browserNavigationAuthority(expression, env = new Map(), callStack = new Set()) {
    return authorityExpressionResolved(expression, navigationBindings, env, callStack)
      || authorityExpressionResolved(expression, externalHrefBindings, env, callStack);
  }

  function isBrowserHrefAssignmentTarget(expression, env = new Map()) {
    const resolved = resolveDataExpression(expression, env);
    if (!resolved) return false;
    if (ts.isPropertyAccessExpression(resolved)) {
      if (resolved.getText(sourceFile) === "window.location") return true;
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
        if (
          targets.length > 0
          && !authorityExpressionResolved(firstArg, navigationBindings, env, callStack)
          && !authorityExpressionResolved(firstArg, productHrefBindings, env, callStack)
        ) report(node, "server-redirect", targets);
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
        }
      }

      if (
        isBrowserLocationMethodReference(expression, env)
        && !browserNavigationAuthority(firstArg, env, callStack)
      ) {
        report(node, "browser-location");
      }

      const definition = localFunctionFromCallee(expression, env);
      if (definition && !callStack.has(definition.key)) {
        const nextStack = new Set(callStack);
        nextStack.add(definition.key);
        const childEnv = functionEnvironment(definition, node, env);
        visit(definition.body, childEnv, nextStack);
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

const imperativeNavigationViolations = ["app", "components"]
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
