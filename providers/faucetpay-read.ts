const BASE_URL = "https://faucetpay.io/api/v2";

type FaucetPayEnvelope<T> = {
  success?: boolean;
  status?: number;
  message?: string;
  data?: T;
};

export type FaucetPayReadCheck = {
  ok: boolean;
  retryable: boolean;
  message: string;
};

export async function validateFaucetPayDestinationReadOnly(destination: string): Promise<FaucetPayReadCheck> {
  const key = process.env.FAUCETPAY_READ_KEY?.trim();
  if (!key) {
    return { ok: false, retryable: false, message: "FaucetPay read-only key is not configured." };
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/check-address`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address: destination }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return { ok: false, retryable: true, message: "FaucetPay destination validation did not complete." };
  }

  let payload: FaucetPayEnvelope<unknown>;
  try {
    payload = (await response.json()) as FaucetPayEnvelope<unknown>;
  } catch {
    return { ok: false, retryable: true, message: "FaucetPay returned an unreadable destination response." };
  }

  if (response.ok && payload.success === true) {
    return { ok: true, retryable: false, message: payload.message || "Destination verified." };
  }

  const retryable = response.status === 429 || response.status >= 500;
  return {
    ok: false,
    retryable,
    message: payload.message || `FaucetPay destination validation failed (${response.status}).`,
  };
}
