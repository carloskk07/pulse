export type ProductRouteId = "home" | "progress" | "earn" | "wallet" | "invite";
export type ProductRouteDimension = "value" | "signal" | "network";

const routeOrder: ProductRouteId[] = ["home", "progress", "earn", "wallet", "invite"];

const routeHref: Record<ProductRouteId, string> = {
  home: "/dashboard",
  progress: "/progress",
  earn: "/earn",
  wallet: "/wallet",
  invite: "/invite",
};

const routeDimension: Record<ProductRouteId, ProductRouteDimension> = {
  home: "value",
  progress: "signal",
  earn: "value",
  wallet: "value",
  invite: "network",
};

const routeByPath = new Map(
  (Object.entries(routeHref) as [ProductRouteId, string][]).map(([id, href]) => [href, id]),
);

function pathnameFromHref(href: string) {
  const [withoutHash] = href.split("#", 1);
  const [pathname] = withoutHash.split("?", 1);
  return pathname;
}

export function productRouteIdFromHref(href: string): ProductRouteId | null {
  return routeByPath.get(pathnameFromHref(href)) ?? null;
}

export function productRouteTransitionTypes(
  source: string,
  targetHref: string,
): string[] | undefined {
  const sourceId = routeOrder.includes(source as ProductRouteId)
    ? source as ProductRouteId
    : productRouteIdFromHref(source);
  const targetId = productRouteIdFromHref(targetHref);

  if (!sourceId || !targetId || sourceId === targetId) return undefined;

  const sourceIndex = routeOrder.indexOf(sourceId);
  const targetIndex = routeOrder.indexOf(targetId);
  const direction = targetIndex > sourceIndex ? "pc-forward" : "pc-back";

  const sourceDimension = routeDimension[sourceId];
  const targetDimension = routeDimension[targetId];

  if (sourceDimension === targetDimension) return [direction];

  return [direction, `pc-transfer-${sourceDimension}-${targetDimension}`];
}

export function productRouteHref(id: ProductRouteId) {
  return routeHref[id];
}
