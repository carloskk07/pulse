import "server-only";

import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
]);

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".test",
  ".invalid",
  ".example",
];

function normalizeHostname(value: string) {
  const clean = value.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  return clean;
}

function parseIpv4(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (
    octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) return null;
  return octets;
}

function publicIpv4(hostname: string) {
  const octets = parseIpv4(hostname);
  if (!octets) return false;
  const [a, b, c] = octets;

  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;

  return true;
}

function publicIpv6(hostname: string) {
  const host = normalizeHostname(hostname);
  if (!host || host === "::" || host === "::1") return false;
  if (host.startsWith("::ffff:")) return false;

  const first = host.split(":", 1)[0] ?? "";
  const firstWord = Number.parseInt(first || "0", 16);
  if (!Number.isFinite(firstWord)) return false;

  if ((firstWord & 0xfe00) === 0xfc00) return false; // fc00::/7
  if ((firstWord & 0xffc0) === 0xfe80) return false; // fe80::/10
  if ((firstWord & 0xff00) === 0xff00) return false; // multicast
  if (host.startsWith("2001:db8:") || host === "2001:db8::") return false;

  return true;
}

export function isPublicExternalHostname(value: string) {
  const hostname = normalizeHostname(value);
  if (!hostname) return false;
  if (BLOCKED_HOSTNAMES.has(hostname)) return false;
  if (BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return false;

  const ipVersion = isIP(hostname);
  if (ipVersion === 4) return publicIpv4(hostname);
  if (ipVersion === 6) return publicIpv6(hostname);

  if (!hostname.includes(".")) return false;
  if (hostname.startsWith(".") || hostname.endsWith(".")) return false;
  return true;
}

export function parsePublicExternalUrl(
  value: string,
  options: { allowHttp?: boolean } = {},
) {
  try {
    const url = new URL(value.trim());
    const allowedProtocol = url.protocol === "https:"
      || (options.allowHttp === true && url.protocol === "http:");

    if (
      !allowedProtocol
      || url.username
      || url.password
      || !isPublicExternalHostname(url.hostname)
      || (url.port && url.port !== "443" && !(options.allowHttp && url.port === "80"))
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function cleanPublicExternalUrl(
  value: string,
  options: { allowHttp?: boolean } = {},
) {
  return parsePublicExternalUrl(value, options)?.toString() ?? null;
}
