import "server-only";

import { isIP } from "node:net";

const BLOCKED_EXACT_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
]);

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".test",
  ".invalid",
  ".example",
];

function normalizedHostname(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[/, "")
    .replace(/\]$/, "");
}

export function parsePublicHttpsDestination(
  value: string,
  maxLength = 2_048,
): URL | null {
  const raw = value.trim();
  if (!raw || raw.length > maxLength) return null;

  try {
    const url = new URL(raw);
    const hostname = normalizedHostname(url.hostname);

    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.port
      || !hostname
      || !hostname.includes(".")
      || BLOCKED_EXACT_HOSTS.has(hostname)
      || BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
      || isIP(hostname) !== 0
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function cleanPublicHttpsDestination(
  value: string,
  maxLength = 2_048,
) {
  return parsePublicHttpsDestination(value, maxLength)?.toString() ?? null;
}
