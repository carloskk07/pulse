export type RouteDimension = "value" | "signal" | "network";

const ROUTE_DIMENSION_BY_SECTION: Record<string, RouteDimension> = {
  home: "value",
  earn: "value",
  wallet: "value",
  progress: "signal",
  invite: "network",
};

const ROUTE_SECTION_BY_PATHNAME: Record<string, string> = {
  "/dashboard": "home",
  "/earn": "earn",
  "/wallet": "wallet",
  "/progress": "progress",
  "/invite": "invite",
};

export function getRouteDimension(section: string | null | undefined): RouteDimension | null {
  if (!section) return null;
  return ROUTE_DIMENSION_BY_SECTION[section] ?? null;
}

export function getRouteDimensionFromHref(href: string | null | undefined): RouteDimension | null {
  if (!href) return null;
  const pathname = href.split(/[?#]/, 1)[0] ?? "";
  const section = ROUTE_SECTION_BY_PATHNAME[pathname];
  return getRouteDimension(section);
}
