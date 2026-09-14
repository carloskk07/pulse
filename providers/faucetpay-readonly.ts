import { CREDITS_PER_USD } from "@/lib/credits";

const BASE_URL = "https://faucetpay.io/api/v2";
const USD_NOMINAL_ASSETS = new Set(["USDT", "USDC"]);

type FaucetPayEnvelope<T> = {
  success?: boolean;
  status?: number;
  message?: string;
  data?: T;
};

type JsonRecord = Record<string, unknown>;

export type FaucetPayReadinessState =
  | "READ_KEY_REQUIRED"
  | "READ_API_FAILED"
  | "ASSET_NOT_SUPPORTED"
  | "SETTLEMENT_ASSET_UNSUPPORTED"
  | "UNIT_SCALE_UNRESOLVED"
  | "PACK_ECONOMICS_MISMATCH"
  | "PACK_MISMATCH"
  | "READ_ONLY_VERIFIED";

export type FaucetPayReadOnlyPreflight = {
  state: FaucetPayReadinessState;
  asset: string;
  readKeyPresent: boolean;
  assetSupported: boolean | null;
  balanceSmallestUnits: number | null;
  balanceDisplay: number | null;
  inferredUnitScale: number | null;
  inferredDecimals: number | null;
  configuredPackCredits: number | null;
  configuredPackUnits: number | null;
  configuredPackLabel: string;
  expectedPackCredits: number | null;
  expectedPackUnits: number | null;
  packMatchesCredits: boolean | null;
  packMatchesScale: boolean | null;
  detail: string;
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function finiteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function positiveInteger(value: string | undefined) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function containsExactString(value: unknown, expected: string, depth = 0): boolean {
  if (depth > 8) return false;
  if (typeof value === "string") return value.trim().toUpperCase() === expected;
  if (Array.isArray(value)) return value.some((item) => containsExactString(item, expected, depth + 1));
  const obj = record(value);
  if (!obj) return false;
  return Object.entries(obj).some(([key, child]) => key.toUpperCase() === expected || containsExactString(child, expected, depth + 1));
}

function findAssetRecord(value: unknown, asset: string, depth = 0): JsonRecord | null {
  if (depth > 8) return null;
  const obj = record(value);
  if (obj) {
    const identifiers = ["currency", "coin", "symbol", "acronym", "code"];
    if (identifiers.some((key) => typeof obj[key] === "string" && String(obj[key]).trim().toUpperCase() === asset)) return obj;
    const direct = obj[asset] ?? obj[asset.toLowerCase()];
    if (record(direct)) return record(direct);
    for (const child of Object.values(obj)) {
      const match = findAssetRecord(child, asset, depth + 1);
      if (match) return match;
    }
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const match = findAssetRecord(child, asset, depth + 1);
      if (match) return match;
    }
  }
  return null;
}

function powerOfTenInfo(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  const exponent = Math.log10(value);
  const rounded = Math.round(exponent);
  if (rounded < 0 || rounded > 18 || Math.abs(exponent - rounded) > 1e-9) return null;
  return { scale: value, decimals: rounded };
}

function scaleFromCurrencyMetadata(value: unknown, asset: string) {
  const assetRow = findAssetRecord(value, asset);
  if (!assetRow) return null;

  for (const key of ["decimals", "decimal_places", "decimalPlaces", "precision"]) {
    const decimals = finiteNumber(assetRow[key]);
    if (decimals !== null && Number.isInteger(decimals) && decimals >= 0 && decimals <= 15) {
      const scale = 10 ** decimals;
      if (Number.isSafeInteger(scale)) return { scale, decimals };
    }
  }

  for (const key of ["multiplier", "unit_scale", "unitScale", "smallest_unit_scale", "smallestUnitScale", "scale"]) {
    const scale = finiteNumber(assetRow[key]);
    if (scale !== null) {
      const info = powerOfTenInfo(scale);
      if (info) return info;
    }
  }

  return null;
}

function balancePair(value: unknown, depth = 0): { smallest: number; display: number; scale: number; decimals: number } | null {
  if (depth > 8) return null;
  const obj = record(value);
  if (obj) {
    const smallest = finiteNumber(obj.balance);
    if (smallest !== null && Number.isSafeInteger(smallest) && smallest > 0) {
      for (const [key, raw] of Object.entries(obj)) {
        if (key === "balance" || !key.toLowerCase().startsWith("balance")) continue;
        const display = finiteNumber(raw);
        if (display === null || display <= 0) continue;
        const ratio = smallest / display;
        const roundedScale = Math.round(ratio);
        const info = powerOfTenInfo(roundedScale);
        if (info && Math.abs(ratio - roundedScale) / roundedScale < 1e-8) {
          return { smallest, display, scale: info.scale, decimals: info.decimals };
        }
      }
    }
    for (const child of Object.values(obj)) {
      const match = balancePair(child, depth + 1);
      if (match) return match;
    }
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const match = balancePair(child, depth + 1);
      if (match) return match;
    }
  }
  return null;
}

function configuredDisplayAmount(label: string, asset: string) {
  const match = label.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s+([A-Za-z0-9]+)$/);
  if (!match || match[2].toUpperCase() !== asset) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function expectedCreditsForNominalUsd(displayAmount: number | null) {
  if (displayAmount === null) return null;
  const raw = displayAmount * CREDITS_PER_USD;
  const rounded = Math.round(raw);
  if (!Number.isSafeInteger(rounded) || rounded <= 0 || Math.abs(raw - rounded) > 1e-8) return null;
  return rounded;
}

async function readRequest<T>(path: string, body: JsonRecord = {}) {
  const key = process.env.FAUCETPAY_READ_KEY?.trim();
  if (!key) throw new Error("FaucetPay read-only key is not configured.");

  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  const payload = (await response.json()) as FaucetPayEnvelope<T>;
  if (!response.ok || payload.success !== true) {
    throw new Error(payload.message || `FaucetPay read request failed (${response.status}).`);
  }
  return payload.data;
}

export async function getFaucetPayReadOnlyPreflight(): Promise<FaucetPayReadOnlyPreflight> {
  const asset = (process.env.FAUCETPAY_PAYOUT_CURRENCY ?? "USDT").trim().toUpperCase();
  const readKeyPresent = Boolean(process.env.FAUCETPAY_READ_KEY?.trim());
  const configuredPackCredits = positiveInteger(process.env.FAUCETPAY_PAYOUT_CREDITS);
  const configuredPackUnits = positiveInteger(process.env.FAUCETPAY_PAYOUT_UNITS);
  const configuredPackLabel = process.env.FAUCETPAY_PAYOUT_LABEL?.trim() ?? "";

  const base = {
    asset,
    readKeyPresent,
    configuredPackCredits,
    configuredPackUnits,
    configuredPackLabel,
  };

  const emptyDerived = {
    expectedPackCredits: null,
    expectedPackUnits: null,
    packMatchesCredits: null,
    packMatchesScale: null,
  };

  if (!readKeyPresent) {
    return {
      ...base,
      ...emptyDerived,
      state: "READ_KEY_REQUIRED",
      assetSupported: null,
      balanceSmallestUnits: null,
      balanceDisplay: null,
      inferredUnitScale: null,
      inferredDecimals: null,
      detail: "Create a FaucetPay scoped key with read scope only. No send permission is needed for this preflight.",
    };
  }

  let currencies: unknown;
  let balance: unknown;
  try {
    [currencies, balance] = await Promise.all([
      readRequest<unknown>("/currencies"),
      readRequest<unknown>("/balance", { currency: asset }),
    ]);
  } catch (error) {
    return {
      ...base,
      ...emptyDerived,
      state: "READ_API_FAILED",
      assetSupported: null,
      balanceSmallestUnits: null,
      balanceDisplay: null,
      inferredUnitScale: null,
      inferredDecimals: null,
      detail: error instanceof Error ? error.message : "FaucetPay read-only preflight failed.",
    };
  }

  const assetSupported = containsExactString(currencies, asset);
  if (!assetSupported) {
    return {
      ...base,
      ...emptyDerived,
      state: "ASSET_NOT_SUPPORTED",
      assetSupported: false,
      balanceSmallestUnits: null,
      balanceDisplay: null,
      inferredUnitScale: null,
      inferredDecimals: null,
      detail: `${asset} was not confirmed by the live FaucetPay currencies response.`,
    };
  }

  if (!USD_NOMINAL_ASSETS.has(asset)) {
    return {
      ...base,
      ...emptyDerived,
      state: "SETTLEMENT_ASSET_UNSUPPORTED",
      assetSupported: true,
      balanceSmallestUnits: null,
      balanceDisplay: null,
      inferredUnitScale: null,
      inferredDecimals: null,
      detail: `${asset} is live, but Pulsercuit credits are USD-denominated and no price oracle is authorized. Use a nominal USD stablecoin (USDT or USDC) or add a separately proven oracle contract before enabling this asset.`,
    };
  }

  const pair = balancePair(balance);
  const metadataScale = scaleFromCurrencyMetadata(currencies, asset);
  const scaleInfo = pair ? { scale: pair.scale, decimals: pair.decimals } : metadataScale;

  if (!scaleInfo) {
    return {
      ...base,
      ...emptyDerived,
      state: "UNIT_SCALE_UNRESOLVED",
      assetSupported: true,
      balanceSmallestUnits: pair?.smallest ?? null,
      balanceDisplay: pair?.display ?? null,
      inferredUnitScale: null,
      inferredDecimals: null,
      detail: `${asset} is live, but the read-only response did not expose enough non-zero balance/precision evidence to prove its smallest-unit scale. No payout assumption was made.`,
    };
  }

  const displayAmount = configuredDisplayAmount(configuredPackLabel, asset);
  const expectedPackCredits = expectedCreditsForNominalUsd(displayAmount);
  const packMatchesCredits = expectedPackCredits !== null && configuredPackCredits !== null
    ? expectedPackCredits === configuredPackCredits
    : null;

  if (packMatchesCredits !== true) {
    return {
      ...base,
      state: "PACK_ECONOMICS_MISMATCH",
      assetSupported: true,
      balanceSmallestUnits: pair?.smallest ?? null,
      balanceDisplay: pair?.display ?? null,
      inferredUnitScale: scaleInfo.scale,
      inferredDecimals: scaleInfo.decimals,
      expectedPackCredits,
      expectedPackUnits: null,
      packMatchesCredits,
      packMatchesScale: null,
      detail: expectedPackCredits !== null
        ? `${configuredPackLabel || asset} represents ${expectedPackCredits.toLocaleString("en-US")} internal credits at ${CREDITS_PER_USD.toLocaleString("en-US")} credits per USD; configure FAUCETPAY_PAYOUT_CREDITS to exactly that value.`
        : `The payout label must express an exact positive ${asset} amount that maps to a whole number of internal credits.`,
    };
  }

  const expectedPackUnits = displayAmount === null ? null : Math.round(displayAmount * scaleInfo.scale);
  const expectedSafe = expectedPackUnits !== null && Number.isSafeInteger(expectedPackUnits) && expectedPackUnits > 0;
  const packMatchesScale = expectedSafe && configuredPackUnits !== null ? expectedPackUnits === configuredPackUnits : null;

  if (packMatchesScale !== true) {
    return {
      ...base,
      state: "PACK_MISMATCH",
      assetSupported: true,
      balanceSmallestUnits: pair?.smallest ?? null,
      balanceDisplay: pair?.display ?? null,
      inferredUnitScale: scaleInfo.scale,
      inferredDecimals: scaleInfo.decimals,
      expectedPackCredits,
      expectedPackUnits: expectedSafe ? expectedPackUnits : null,
      packMatchesCredits: true,
      packMatchesScale,
      detail: expectedSafe
        ? `Live read-only evidence implies ${scaleInfo.scale.toLocaleString("en-US")} smallest units per ${asset}; configure the payout pack to exactly ${expectedPackUnits?.toLocaleString("en-US")} units for ${configuredPackLabel || "the display amount"}.`
        : "The live unit scale was inferred, but the configured payout label cannot be converted deterministically into provider units.",
    };
  }

  return {
    ...base,
    state: "READ_ONLY_VERIFIED",
    assetSupported: true,
    balanceSmallestUnits: pair?.smallest ?? null,
    balanceDisplay: pair?.display ?? null,
    inferredUnitScale: scaleInfo.scale,
    inferredDecimals: scaleInfo.decimals,
    expectedPackCredits,
    expectedPackUnits,
    packMatchesCredits: true,
    packMatchesScale: true,
    detail: `Live FaucetPay read-only evidence confirms ${asset}; internal credits match the nominal USD pack and provider units match the inferred smallest-unit scale. No payout endpoint was called.`,
  };
}
