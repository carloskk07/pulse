export type CircuitProgressInput = {
  hourlyClaimCount: number;
  streakDays: number;
  trustLevel: number;
};

export type CircuitProgress = {
  signal: number;
  stage: "Spark" | "Flow" | "Rhythm" | "Circuit" | "Resonance";
  nextStageAt: number | null;
  progressToNext: number;
};

const stages = [
  { name: "Spark" as const, min: 0, next: 20 },
  { name: "Flow" as const, min: 20, next: 40 },
  { name: "Rhythm" as const, min: 40, next: 60 },
  { name: "Circuit" as const, min: 60, next: 80 },
  { name: "Resonance" as const, min: 80, next: null },
];

export function getCircuitProgress(input: CircuitProgressInput): CircuitProgress {
  const claims = Math.max(0, Math.floor(Number(input.hourlyClaimCount) || 0));
  const streak = Math.max(0, Math.floor(Number(input.streakDays) || 0));
  const trust = Math.max(0, Math.min(5, Math.floor(Number(input.trustLevel) || 0)));

  // Signal is display-only, non-financial progress derived from authoritative product history.
  const claimPoints = Math.min(55, claims * 3);
  const streakPoints = Math.min(30, streak * 4);
  const trustPoints = Math.min(15, trust * 3);
  const signal = Math.min(100, claimPoints + streakPoints + trustPoints);
  const stage = [...stages].reverse().find((item) => signal >= item.min) ?? stages[0];
  const nextStageAt = stage.next;
  const progressToNext = nextStageAt === null ? 100 : Math.max(0, Math.min(100, ((signal - stage.min) / (nextStageAt - stage.min)) * 100));

  return { signal, stage: stage.name, nextStageAt, progressToNext };
}
