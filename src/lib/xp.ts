import type { Quadrant } from "./types";

/**
 * Quadrant weights.
 *
 * Q2 pays the most — deliberately. Urgent-and-important work already rewards
 * itself with relief; the work that actually compounds is the important thing
 * that isn't screaming yet, and that is the only kind a scoring system can
 * meaningfully bribe you into doing. Q3 and Q4 are priced low on purpose.
 */
export const QUADRANT_WEIGHT: Record<Quadrant, number> = {
  q1: 1.0,
  q2: 1.5,
  q3: 0.6,
  q4: 0.3,
};

export const QUADRANT_META: Record<
  Quadrant,
  { key: string; name: string; blurb: string }
> = {
  q1: { key: "Q1", name: "Do now", blurb: "Urgent and important" },
  q2: { key: "Q2", name: "Book time", blurb: "Important, not urgent" },
  q3: { key: "Q3", name: "Cut or hand off", blurb: "Urgent, not important" },
  q4: { key: "Q4", name: "Drop", blurb: "Neither" },
};

export const LOG_ENTRY_XP = 15;

/** XP for finishing a task: 5 XP per quarter-hour, scaled by quadrant. */
export function taskXp(minutes: number, quadrant: Quadrant): number {
  const units = Math.max(1, minutes / 15);
  return Math.max(5, Math.round(units * 5 * QUADRANT_WEIGHT[quadrant]));
}

/** Cumulative XP required to *reach* a level. Level 1 is zero. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(150 * Math.pow(level - 1, 1.5));
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return {
    level,
    floor,
    ceil,
    into: xp - floor,
    span: ceil - floor,
    pct: (xp - floor) / (ceil - floor),
  };
}

/**
 * Cosmetic ranks. No mechanical effect whatsoever — that is the deal.
 * Named for how a physical system behaves as you put energy into it.
 */
const RANKS = [
  "Cold start",
  "Warm-up",
  "Bench test",
  "Calibrated",
  "Nominal",
  "Steady state",
  "In phase",
  "Resonant",
  "Coherent",
  "Critical",
  "Runaway",
] as const;

export function rankForLevel(level: number): string {
  return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 2))];
}
