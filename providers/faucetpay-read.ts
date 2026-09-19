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

type FaucetPayBalanceData = {
  currency?: string;
  balance?: number | string;
};

export type FaucetPayBalanceCheck = {
  ok: boolean;
  retryable: boolean;
  message: string;
  asset: string;
  balanceSmallestUnits: number | null;
};

function nonNegativeSafeInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function getFaucetPayBalanceReadOnly(asset: string): Promise<FaucetPayBalanceCheck> {
  const normalizedAsset = asset.trim().toUpperCase();
  const key = process.env.FAUCETPAY_READ_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      retryable: false,
      message: "FaucetPay read-only key is not configured.",
      asset: normalizedAsset,
      balanceSmallestUnits: null,
    };
  }
  if (!/^[A-Z0-9]{2,16}$/.test(normalizedAsset)) {
    return {
      ok: false,
      retryable: false,
      message: "FaucetPay balance asset is invalid.",
      asset: normalizedAsset,
      balanceSmallestUnits: null,
    };
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/balance`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ currency: normalizedAsset }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return {
      ok: false,
      retryable: true,
      message: "FaucetPay balance check did not complete.",
      asset: normalizedAsset,
      balanceSmallestUnits: null,
    };
  }

  let payload: FaucetPayEnvelope<FaucetPayBalanceData>;
  try {
    payload = (await response.json()) as FaucetPayEnvelope<FaucetPayBalanceData>;
  } catch {
    return {
      ok: false,
      retryable: true,
      message: "FaucetPay returned an unreadable balance response.",
      asset: normalizedAsset,
      balanceSmallestUnits: null,
    };
  }

  const returnedAsset = String(payload.data?.currency ?? normalizedAsset).trim().toUpperCase();
  const balanceSmallestUnits = nonNegativeSafeInteger(payload.data?.balance);
  if (response.ok && payload.success === true && returnedAsset === normalizedAsset && balanceSmallestUnits !== null) {
    return {
      ok: true,
      retryable: false,
      message: payload.message || "Balance verified.",
      asset: normalizedAsset,
      balanceSmallestUnits,
    };
  }

  return {
    ok: false,
    retryable: response.status === 429 || response.status >= 500,
    message: payload.message || `FaucetPay balance check failed (${response.status}).`,
    asset: normalizedAsset,
    balanceSmallestUnits: null,
  };
}

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
