export type RouteSemanticDimension = "value" | "signal" | "network";
export type ProductRouteId = "home" | "progress" | "earn" | "wallet" | "invite";

declare const PRODUCT_ROUTE_HREF_BRAND: unique symbol;
declare const ROUTE_NAVIGATION_HREF_BRAND: unique symbol;
export type ProductRouteHref = string & { readonly [PRODUCT_ROUTE_HREF_BRAND]: true };
export type RouteNavigationHref = string & { readonly [ROUTE_NAVIGATION_HREF_BRAND]: true };
export type ProductRouteSuffix = "" | `?${string}` | `#${string}`;

export type RouteSemanticTransfer =
  `pc-transfer-${RouteSemanticDimension}-${RouteSemanticDimension}`;

const PRODUCT_ROUTE_ORDER: ProductRouteId[] = ["home", "progress", "earn", "wallet", "invite"];

const PRODUCT_ROUTE_PATHS: Record<ProductRouteId, string> = {
  home: "/dashboard",
  progress: "/progress",
  earn: "/earn",
  wallet: "/wallet",
  invite: "/invite",
};

export function getProductRouteHref(
  route: ProductRouteId,
  suffix: ProductRouteSuffix = "",
): ProductRouteHref {
  return `${PRODUCT_ROUTE_PATHS[route]}${suffix}` as ProductRouteHref;
}

const ROUTE_SEMANTIC_DIMENSIONS = {
  home: "value",
  earn: "value",
  wallet: "value",
  progress: "signal",
  invite: "network",
} as const satisfies Record<ProductRouteId, RouteSemanticDimension>;

export function getRouteSemanticDimension(route: string): RouteSemanticDimension | null {
  return ROUTE_SEMANTIC_DIMENSIONS[route as keyof typeof ROUTE_SEMANTIC_DIMENSIONS] ?? null;
}

export function getRouteSemanticTransfer(
  currentRoute: string,
  targetRoute: string,
): RouteSemanticTransfer | null {
  const current = getRouteSemanticDimension(currentRoute);
  const target = getRouteSemanticDimension(targetRoute);
  if (!current || !target || current === target) return null;
  return `pc-transfer-${current}-${target}`;
}


function routePathFromHref(href: string) {
  return href.split("#", 1)[0]?.split("?", 1)[0] ?? href;
}

export function getProductRouteIdFromHref(href: string): ProductRouteId | null {
  const path = routePathFromHref(href);
  for (const route of PRODUCT_ROUTE_ORDER) {
    if (PRODUCT_ROUTE_PATHS[route] === path) return route;
  }
  return null;
}

export function getRouteTransitionTypes(
  currentRoute: string,
  targetRoute: string,
): string[] | undefined {
  const currentIndex = PRODUCT_ROUTE_ORDER.indexOf(currentRoute as ProductRouteId);
  const targetIndex = PRODUCT_ROUTE_ORDER.indexOf(targetRoute as ProductRouteId);
  if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) return undefined;

  const direction = targetIndex > currentIndex ? "pc-forward" : "pc-back";
  const semanticTransfer = getRouteSemanticTransfer(currentRoute, targetRoute);
  return semanticTransfer ? [direction, semanticTransfer] : [direction];
}

export function getRouteTransitionTypesForHref(
  currentRoute: string,
  targetHref: string,
): string[] | undefined {
  const targetRoute = getProductRouteIdFromHref(targetHref);
  return targetRoute ? getRouteTransitionTypes(currentRoute, targetRoute) : undefined;
}

export function getRouteLinkProps(currentRoute: string, targetHref: string) {
  return {
    href: targetHref,
    transitionTypes: getRouteTransitionTypesForHref(currentRoute, targetHref),
    "data-route-provenance": "route-semantics" as const,
  };
}

export function getRouteNavigationHref(
  currentRoute: string,
  targetHref: string,
): RouteNavigationHref {
  if (!targetHref.startsWith("/") && !targetHref.startsWith("#")) {
    throw new Error("Route navigation authority only accepts internal hrefs");
  }
  const targetRoute = getProductRouteIdFromHref(targetHref);
  if (targetRoute) getRouteTransitionTypes(currentRoute, targetRoute);
  return targetHref as RouteNavigationHref;
}

export function getExternalNavigationHref(targetHref: string): string {
  const url = new URL(targetHref);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("External navigation authority requires credential-free HTTPS");
  }
  return url.toString();
}
