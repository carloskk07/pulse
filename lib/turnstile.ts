type TurnstileResult = {
  success: boolean;
  missingConfig?: boolean;
  errorCodes?: string[];
};

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

type TurnstileOptions = {
  expectedAction: string | string[];
};

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function allowedHostnames() {
  const hostnames = new Set<string>();
  const configured = process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? "";
  for (const raw of configured.split(",")) {
    const hostname = normalizeHostname(raw);
    if (hostname) hostnames.add(hostname);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    try {
      hostnames.add(normalizeHostname(new URL(siteUrl).hostname));
    } catch {
      // Release readiness validates the public URL separately. An invalid URL must
      // not silently become a hostname wildcard here.
    }
  }

  return [...hostnames];
}

function actionMatches(actual: string | undefined, expected: string | string[]) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  return Boolean(actual && allowed.includes(actual));
}

export async function verifyTurnstile(
  token: string,
  remoteIp: string | null | undefined,
  options: TurnstileOptions,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    return {
      success: process.env.NODE_ENV !== "production",
      missingConfig: true,
      errorCodes: ["missing-secret"],
    };
  }

  if (!token) return { success: false, errorCodes: ["missing-token"] };
  if (token.length > 2048) return { success: false, errorCodes: ["token-too-long"] };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return { success: false, errorCodes: ["verification-unavailable"] };

    const payload = (await response.json()) as TurnstileResponse;
    if (payload.success !== true) {
      return { success: false, errorCodes: payload["error-codes"] ?? [] };
    }

    if (!actionMatches(payload.action, options.expectedAction)) {
      return { success: false, errorCodes: ["action-mismatch"] };
    }

    const hostnames = allowedHostnames();
    if (hostnames.length > 0) {
      const hostname = payload.hostname ? normalizeHostname(payload.hostname) : "";
      if (!hostname || !hostnames.includes(hostname)) {
        return { success: false, errorCodes: ["hostname-mismatch"] };
      }
    }

    return { success: true, errorCodes: [] };
  } catch {
    return { success: false, errorCodes: ["verification-unavailable"] };
  }
}
