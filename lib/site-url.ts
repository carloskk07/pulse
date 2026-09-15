export const CANONICAL_SITE_ORIGIN = "https://pulsercuit.pro";

function parseSiteUrl(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const normalized = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export function isCanonicalProductionSiteUrl(value = process.env.NEXT_PUBLIC_SITE_URL) {
  const url = parseSiteUrl(value);
  if (!url) return false;
  const rootPath = url.pathname === "" || url.pathname === "/";
  return url.origin === CANONICAL_SITE_ORIGIN && rootPath && !url.search && !url.hash;
}

export function getCanonicalSiteUrl() {
  if (process.env.NODE_ENV === "production") {
    return new URL(CANONICAL_SITE_ORIGIN);
  }

  const configured = parseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) {
    configured.pathname = "/";
    configured.search = "";
    configured.hash = "";
    return configured;
  }

  return new URL(CANONICAL_SITE_ORIGIN);
}
