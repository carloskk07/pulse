export type CircuitAchievement = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  tone: "lime" | "cyan" | "violet" | "warm";
};

export function getCircuitAchievements(input: {
  hourlyClaimCount: number;
  streakDays: number;
  trustLevel: number;
  signal: number;
}): CircuitAchievement[] {
  const claims = Math.max(0, Math.floor(Number(input.hourlyClaimCount) || 0));
  const streak = Math.max(0, Math.floor(Number(input.streakDays) || 0));
  const trust = Math.max(0, Math.min(5, Math.floor(Number(input.trustLevel) || 0)));
  const signal = Math.max(0, Math.min(100, Math.floor(Number(input.signal) || 0)));

  return [
    { id: "first-pulse", title: "First Pulse", description: "Complete one authoritative Hourly Pulse claim.", unlocked: claims >= 1, tone: "lime" },
    { id: "rhythm-3", title: "Rhythm 3", description: "Build a three-day factual return rhythm.", unlocked: streak >= 3, tone: "cyan" },
    { id: "pulse-10", title: "Ten Pulses", description: "Complete ten funded Pulse claims.", unlocked: claims >= 10, tone: "violet" },
    { id: "signal-40", title: "Signal 40", description: "Reach the Rhythm stage of Circuit Signal.", unlocked: signal >= 40, tone: "cyan" },
    { id: "trust-3", title: "Verified Trust", description: "Reach Trust level 3 from real product history.", unlocked: trust >= 3, tone: "warm" },
    { id: "rhythm-7", title: "Seven-day Circuit", description: "Maintain a seven-day factual rhythm.", unlocked: streak >= 7, tone: "lime" },
  ];
}
