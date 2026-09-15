const CANONICAL_SITE_URL = "https://pulsercuit.pro";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function getCanonicalSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const production = process.env.NODE_ENV === "production";

  for (const candidate of [configured, CANONICAL_SITE_URL]) {
    if (!candidate) continue;

    try {
      const normalized = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
      const url = new URL(normalized);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (production && (url.protocol !== "https:" || LOCAL_HOSTS.has(url.hostname))) continue;
      url.pathname = "/";
      url.search = "";
      url.hash = "";
      return url;
    } catch {
      // Fall through to the canonical production domain.
    }
  }

  return new URL(CANONICAL_SITE_URL);
}
