import type { ReactNode } from "react";
import { ViewTransition } from "react";

const routePageTransition = {
  default: "none",
  "pc-forward": "pc-route-content-forward",
  "pc-back": "pc-route-content-back",
} as const;

export function RoutePageTransition({
  route,
  children,
}: {
  route: string;
  children: ReactNode;
}) {
  return (
    <ViewTransition
      key={`route-page-${route}`}
      enter={routePageTransition}
      exit={routePageTransition}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
