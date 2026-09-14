export type CircuitAchievement = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  tone: "lime" | "cyan" | "violet" | "warm";
  current: number;
  target: number;
  progress: number;
  remaining: number;
  unit: "Pulse" | "day" | "Signal point" | "Trust level";
};

function achievement(input: Omit<CircuitAchievement, "unlocked" | "progress" | "remaining">): CircuitAchievement {
  const current = Math.max(0, Number(input.current) || 0);
  const target = Math.max(1, Number(input.target) || 1);
  const unlocked = current >= target;
  const progress = Math.max(0, Math.min(100, (current / target) * 100));

  return {
    ...input,
    current,
    target,
    unlocked,
    progress,
    remaining: Math.max(0, target - current),
  };
}

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
    achievement({ id: "first-pulse", title: "First Pulse", description: "Complete one authoritative Hourly Pulse claim.", tone: "lime", current: claims, target: 1, unit: "Pulse" }),
    achievement({ id: "rhythm-3", title: "Rhythm 3", description: "Build a three-day factual return rhythm.", tone: "cyan", current: streak, target: 3, unit: "day" }),
    achievement({ id: "pulse-10", title: "Ten Pulses", description: "Complete ten funded Pulse claims.", tone: "violet", current: claims, target: 10, unit: "Pulse" }),
    achievement({ id: "signal-40", title: "Signal 40", description: "Reach the Rhythm stage of Circuit Signal.", tone: "cyan", current: signal, target: 40, unit: "Signal point" }),
    achievement({ id: "trust-3", title: "Verified Trust", description: "Reach Trust level 3 from real product history.", tone: "warm", current: trust, target: 3, unit: "Trust level" }),
    achievement({ id: "rhythm-7", title: "Seven-day Circuit", description: "Maintain a seven-day factual rhythm.", tone: "lime", current: streak, target: 7, unit: "day" }),
  ];
}

export function getNextCircuitAchievement(achievements: CircuitAchievement[]) {
  return achievements
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.unlocked)
    .sort((a, b) => b.item.progress - a.item.progress || a.index - b.index)[0]?.item ?? null;
}
