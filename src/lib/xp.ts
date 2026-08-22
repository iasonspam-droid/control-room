export const LOG_ENTRY_XP = 15;

/**
 * XP for finishing a task: 5 XP per quarter-hour, and nothing else.
 *
 * Time is the one input here that isn't a judgement call, so it is the only
 * one the score uses — no multiplier for how urgent or important you decided
 * something was. A score that moves with a subjective call ends up measuring
 * your labelling rather than your week.
 */
export function taskXp(minutes: number): number {
  const units = Math.max(1, minutes / 15);
  return Math.max(5, Math.round(units * 5));
}

/**
 * XP earned inside a window — this is what "XP today" and "XP this week" are.
 *
 * There is no stored daily or weekly counter, and deliberately so: every award
 * is already timestamped in the event feed, so a period total is a sum rather
 * than a number that has to be reset on a schedule and can drift if a reset is
 * ever missed. Lifetime XP (`profile.xp`) is untouched by the same reasoning —
 * it is a different question, not a stale version of this one.
 *
 * Note the feed is capped (see the store), so for a genuinely enormous week
 * this is a floor rather than an exact figure. Permanent history is summed
 * from the uncapped ledger server-side instead — see lib/snapshots.ts.
 */
export function xpInRange(
  events: { at: string; amount: number }[],
  start: Date,
  end: Date,
): number {
  const from = +start;
  const to = +end;
  return events.reduce((total, e) => {
    const at = +new Date(e.at);
    return at >= from && at < to ? total + e.amount : total;
  }, 0);
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
