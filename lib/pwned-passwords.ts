import { createHash } from "node:crypto";

const PWNED_PASSWORDS_RANGE_ORIGIN = "https://api.pwnedpasswords.com/range/";
const PWNED_PASSWORDS_TIMEOUT_MS = 4_000;
const PWNED_PASSWORDS_USER_AGENT = "Pulsercuit/0.1 password-security";

// SHA-1("password"). We keep only the hash in source so the production
// self-test never needs a plaintext compromised password.
const KNOWN_PWNED_SHA1 = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8";

export type PasswordBreachState = "safe" | "compromised" | "unavailable";

export type PasswordBreachResult = {
  state: PasswordBreachState;
  occurrences: number;
};

function sha1(value: string) {
  return createHash("sha1").update(value, "utf8").digest("hex").toUpperCase();
}

function parseOccurrences(body: string, expectedSuffix: string) {
  for (const line of body.split(/\r?\n/)) {
    const [rawSuffix, rawCount] = line.trim().split(":", 2);
    if (!rawSuffix || rawSuffix.toUpperCase() !== expectedSuffix) continue;
    const count = Number(rawCount ?? 0);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  }
  return 0;
}

async function queryHash(fullHash: string): Promise<PasswordBreachResult> {
  const normalized = fullHash.trim().toUpperCase();
  if (!/^[A-F0-9]{40}$/.test(normalized)) return { state: "unavailable", occurrences: 0 };

  const prefix = normalized.slice(0, 5);
  const suffix = normalized.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PWNED_PASSWORDS_TIMEOUT_MS);

  try {
    const response = await fetch(`${PWNED_PASSWORDS_RANGE_ORIGIN}${prefix}`, {
      method: "GET",
      headers: {
        "User-Agent": PWNED_PASSWORDS_USER_AGENT,
        "Add-Padding": "true",
        Accept: "text/plain",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return { state: "unavailable", occurrences: 0 };

    const occurrences = parseOccurrences(await response.text(), suffix);
    return {
      state: occurrences > 0 ? "compromised" : "safe",
      occurrences,
    };
  } catch {
    return { state: "unavailable", occurrences: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

export function getPwnedPasswordProtectionContract() {
  return [
    "provider:haveibeenpwned-pwned-passwords",
    "lookup:sha1-k-anonymity-prefix-5",
    "response-padding:true",
    `timeout-ms:${PWNED_PASSWORDS_TIMEOUT_MS}`,
    "new-password:fail-closed-on-unavailable",
    "existing-signin:fail-open-on-unavailable",
    "confirmed-compromise:force-password-upgrade",
  ] as const;
}

export async function checkPasswordBreach(password: string) {
  return queryHash(sha1(password));
}

export async function probePwnedPasswordProtection() {
  const result = await queryHash(KNOWN_PWNED_SHA1);
  return result.state === "compromised" && result.occurrences > 0;
}
