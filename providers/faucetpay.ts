import type { PayoutProvider, PayoutRequest } from "./contracts";

const BASE_URL = "https://faucetpay.io/api/v2";

type FaucetPayEnvelope<T> = {
  success?: boolean;
  status?: number;
  message?: string;
  data?: T;
};

type FaucetPayPayoutData = {
  payout_id?: string | number;
};

export class FaucetPayApiError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly statusCode?: number) {
    super(message);
    this.name = "FaucetPayApiError";
  }
}

function positiveInteger(value: string | undefined, fallback?: number) {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getFaucetPayPackConfig() {
  const asset = (process.env.FAUCETPAY_PAYOUT_CURRENCY ?? "USDT").trim().toUpperCase();
  const amountCredits = positiveInteger(process.env.FAUCETPAY_PAYOUT_CREDITS, 5000);
  const amountSmallestUnits = positiveInteger(process.env.FAUCETPAY_PAYOUT_UNITS);
  const display = process.env.FAUCETPAY_PAYOUT_LABEL?.trim() ?? "";
  const keyPresent = Boolean(process.env.FAUCETPAY_SCOPED_KEY);

  return {
    asset,
    amountCredits,
    amountSmallestUnits,
    display,
    ready: Boolean(keyPresent && asset && amountCredits && amountSmallestUnits && display),
  };
}

export class FaucetPayProvider implements PayoutProvider {
  readonly name = "faucetpay";

  private async request<T>(path: string, body: Record<string, unknown>): Promise<FaucetPayEnvelope<T>> {
    const key = process.env.FAUCETPAY_SCOPED_KEY;
    if (!key) throw new FaucetPayApiError("FaucetPay is not configured.", false);

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new FaucetPayApiError("FaucetPay request did not complete.", true);
    }

    let payload: FaucetPayEnvelope<T>;
    try {
      payload = (await response.json()) as FaucetPayEnvelope<T>;
    } catch {
      throw new FaucetPayApiError("FaucetPay returned an unreadable response.", true, response.status);
    }

    if (!response.ok || payload.success !== true) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new FaucetPayApiError(payload.message || `FaucetPay request failed (${response.status}).`, retryable, response.status);
    }

    return payload;
  }

  async validateDestination(destination: string, asset: string) {
    void asset;
    await this.request("/check-address", { address: destination });
    return true;
  }

  async send(input: PayoutRequest) {
    const payload = await this.request<FaucetPayPayoutData>("/send", {
      idempotency_key: input.idempotencyKey,
      to: input.destination,
      amount: input.amountSmallestUnits,
      currency: input.asset,
      ...(input.ipAddress ? { ip_address: input.ipAddress } : {}),
      referral: "reward-pulse",
    });

    const payoutId = payload.data?.payout_id;
    if (payoutId === undefined || payoutId === null) {
      throw new FaucetPayApiError("FaucetPay confirmed the request without a payout id.", true);
    }

    return { externalId: String(payoutId), status: "paid" as const };
  }
}
