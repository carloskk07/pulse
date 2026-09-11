type TurnstileResult = {
  success: boolean;
  missingConfig?: boolean;
  errorCodes?: string[];
};

type TurnstileResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstile(token: string, remoteIp?: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    return {
      success: process.env.NODE_ENV !== "production",
      missingConfig: true,
      errorCodes: ["missing-secret"],
    };
  }

  if (!token) return { success: false, errorCodes: ["missing-token"] };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
    });

    if (!response.ok) return { success: false, errorCodes: ["verification-unavailable"] };

    const payload = (await response.json()) as TurnstileResponse;
    return {
      success: payload.success === true,
      errorCodes: payload["error-codes"] ?? [],
    };
  } catch {
    return { success: false, errorCodes: ["verification-unavailable"] };
  }
}
