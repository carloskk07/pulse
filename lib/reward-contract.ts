export type CurrentRewardContract = {
  variable: boolean;
  valid: boolean;
  credits: number[];
};

type JsonRecord = Record<string, unknown>;

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function booleanFlag(value: unknown, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "on"].includes(String(value).trim().toLowerCase());
}

export function getCurrentRewardContract(baseCredits: number, economyValue: unknown): CurrentRewardContract {
  const baseValid = Number.isInteger(baseCredits) && baseCredits > 0 && baseCredits <= 1_000_000;
  const economy = objectValue(economyValue);
  const variableEnabled = booleanFlag(economy.variable_reward_enabled);
  const reviewRequired = booleanFlag(economy.variable_reward_review_required, true);

  if (!variableEnabled || reviewRequired) {
    return {
      variable: false,
      valid: baseValid,
      credits: baseValid ? [baseCredits] : [],
    };
  }

  const rawBands = Array.isArray(economy.reward_bands) ? economy.reward_bands : [];
  const credits: number[] = [];
  let totalProbabilityBps = 0;

  for (const rawBand of rawBands) {
    const band = objectValue(rawBand);
    const creditsValue = Number(band.credits ?? 0);
    const probabilityBps = Number(band.probability_bps ?? 0);

    if (
      !Number.isInteger(creditsValue)
      || !Number.isInteger(probabilityBps)
      || creditsValue < baseCredits
      || creditsValue > 1_000_000
      || probabilityBps <= 0
      || probabilityBps > 10_000
    ) {
      return { variable: true, valid: false, credits: [] };
    }

    credits.push(creditsValue);
    totalProbabilityBps += probabilityBps;
  }

  return {
    variable: true,
    valid: baseValid && credits.length > 0 && totalProbabilityBps === 10_000,
    credits: [...new Set(credits)].sort((left, right) => left - right),
  };
}
