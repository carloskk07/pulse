import type { NextRequest } from "next/server";

export function isTrustedSameOriginMutation(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim();
  if (origin) {
    try {
      return new URL(origin).origin === request.nextUrl.origin;
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (!fetchSite) return false;
  return fetchSite === "same-origin" || fetchSite === "none";
}
