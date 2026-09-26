export type RouteSemanticDimension = "value" | "signal" | "network";

export type RouteSemanticTransfer =
  `pc-transfer-${RouteSemanticDimension}-${RouteSemanticDimension}`;

const ROUTE_SEMANTIC_DIMENSIONS = {
  home: "value",
  earn: "value",
  wallet: "value",
  progress: "signal",
  invite: "network",
} as const satisfies Record<string, RouteSemanticDimension>;

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
