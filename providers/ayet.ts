import { createHmac, timingSafeEqual } from "node:crypto";
import type { MonetizationProvider, NormalizedConversion } from "./contracts";

const PROVIDER = "ayet";
const CREDITS_PER_USD = 1000;

function sortedQueryString(url: URL) {
  const entries = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries).toString();
}

function safeHashEqual(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function decimalToMicros(value: string | null | undefined) {
  if (!value) return 0;
  const normalized = value.trim();
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error("INVALID_DECIMAL");
  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number(match[2]);
  const fraction = Number((match[3] ?? "").padEnd(6, "0").slice(0, 6));
  const micros = whole * 1_000_000 + fraction;
  if (!Number.isSafeInteger(micros)) throw new Error("DECIMAL_OUT_OF_RANGE");
  return sign * micros;
}

function rewardShareBps() {
  const configured = Number(process.env.AYET_REWARD_SHARE_BPS ?? "7000");
  if (!Number.isFinite(configured)) return 7000;
  return Math.max(0, Math.min(10_000, Math.round(configured)));
}

function expectedCurrencyRateMicros() {
  return Math.round((CREDITS_PER_USD * rewardShareBps() * 1_000_000) / 10_000);
}

function rewardCreditsForPayout(payoutUsdMicros: number) {
  return Math.floor((Math.abs(payoutUsdMicros) * CREDITS_PER_USD * rewardShareBps()) / 10_000 / 1_000_000);
}

function callbackType(url: URL): "conversion" | "chargeback" {
  const explicit = url.searchParams.get("callback_type");
  if (explicit === "chargeback" || url.searchParams.get("is_chargeback") === "1") return "chargeback";
  if (!explicit || explicit === "conversion") return "conversion";
  throw new Error("UNSUPPORTED_CALLBACK_TYPE");
}

function callbackTime(url: URL) {
  const timestamp = Number(url.searchParams.get("callback_ts"));
  if (Number.isFinite(timestamp) && timestamp > 0) return new Date(timestamp * 1000).toISOString();
  return new Date().toISOString();
}

export class AyetProvider implements MonetizationProvider {
  readonly name = PROVIDER;

  async verifyCallback(request: Request) {
    const apiKey = process.env.AYET_API_KEY;
    const provided = request.headers.get("x-ayetstudios-security-hash") ?? "";
    if (!apiKey || !provided) return false;

    const url = new URL(request.url);
    const computed = createHmac("sha256", apiKey).update(sortedQueryString(url)).digest("hex");
    return safeHashEqual(provided, computed);
  }

  async normalizeCallback(request: Request): Promise<NormalizedConversion> {
    const url = new URL(request.url);
    const type = callbackType(url);
    const transactionId = url.searchParams.get("transaction_id")?.trim();
    const userId = (url.searchParams.get("external_identifier") ?? url.searchParams.get("uid") ?? url.searchParams.get("sub_id"))?.trim() || undefined;
    if (!transactionId) throw new Error("MISSING_TRANSACTION_ID");
    if (type === "conversion" && !userId) throw new Error("MISSING_USER_ID");

    const payoutUsdMicros = decimalToMicros(url.searchParams.get("payout_usd"));
    const originalExternalId = type === "chargeback" ? transactionId.replace(/^r-/, "") : undefined;

    return {
      provider: PROVIDER,
      externalId: transactionId,
      originalExternalId,
      callbackType: type,
      userId,
      payoutUsdMicros,
      rewardCredits: type === "conversion" ? rewardCreditsForPayout(payoutUsdMicros) : 0,
      status: type === "chargeback" ? "reversed" : "confirmed",
      occurredAt: callbackTime(url),
      raw: Object.fromEntries(url.searchParams.entries()),
    };
  }
}

export function isAyetRewardRateAligned(value: string | undefined) {
  if (!value) return false;
  try {
    return decimalToMicros(value) === expectedCurrencyRateMicros();
  } catch {
    return false;
  }
}

export function isAyetRewardAmountAligned(value: string | undefined, rewardCredits: number) {
  if (!value || !Number.isSafeInteger(rewardCredits) || rewardCredits <= 0) return false;
  try {
    return decimalToMicros(value) === rewardCredits * 1_000_000;
  } catch {
    return false;
  }
}

export function getAyetExpectedCurrencyRate() {
  return expectedCurrencyRateMicros() / 1_000_000;
}

export function buildAyetOfferwallUrl(userId: string) {
  const adslot = process.env.AYET_ADSLOT_ID;
  if (!adslot) return null;
  const url = new URL("https://offerwall.ayet.io/offers");
  url.searchParams.set("adSlot", adslot);
  url.searchParams.set("externalIdentifier", userId);
  return url.toString();
}

export function isAyetConfigured() {
  return Boolean(process.env.AYET_ADSLOT_ID && process.env.AYET_API_KEY);
}
