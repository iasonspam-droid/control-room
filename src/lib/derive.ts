import { differenceInMinutes, isWithinInterval, parseISO } from "date-fns";
import { categorizedEvents } from "./calendar-category";
import { dayKey, weekBounds } from "./time";
import type { CalendarRule, Category, Profile, Task } from "./types";
import type { ExternalEvent } from "./use-google-calendar-events";
import { taskXp } from "./xp";

export const CAT_VAR: Record<Category["color"], string> = {
  amber: "var(--color-cat-amber)",
  clay: "var(--color-cat-clay)",
  olive: "var(--color-cat-olive)",
  teal: "var(--color-cat-teal)",
  steel: "var(--color-cat-steel)",
  slate: "var(--color-cat-slate)",
  plum: "var(--color-cat-plum)",
};

export function catOf(cats: Category[], id: string): Category | undefined {
  return cats.find((c) => c.id === id);
}

export function catColor(cats: Category[], id: string): string {
  const c = catOf(cats, id);
  return c ? CAT_VAR[c.color] : "var(--color-line-hot)";
}

export function tasksOnDay(tasks: Task[], day: Date): Task[] {
  const key = dayKey(day);
  return tasks
    .filter((t) => t.scheduledStart && dayKey(t.scheduledStart) === key)
    .sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
}

export function eventsOnDay(events: ExternalEvent[], day: Date): ExternalEvent[] {
  const key = dayKey(day);
  return events
    .filter((e) => dayKey(e.start) === key)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function unscheduled(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.scheduledStart && t.status === "open");
}

/** Minutes banked (done) and minutes scheduled-but-open, per category, this week. */
export function weekMinutes(
  tasks: Task[],
  ref: Date,
  weekStartsOn: 0 | 1 = 1,
): Record<string, { done: number; planned: number }> {
  const { start, end } = weekBounds(ref, weekStartsOn);
  const out: Record<string, { done: number; planned: number }> = {};
  for (const t of tasks) {
    const stamp = t.status === "done" ? t.completedAt ?? t.scheduledStart : t.scheduledStart;
    if (!stamp) continue;
    if (!isWithinInterval(parseISO(stamp), { start, end })) continue;
    const bucket = (out[t.categoryId] ??= { done: 0, planned: 0 });
    const mins = t.actualMin ?? t.estimateMin;
    if (t.status === "done") bucket.done += mins;
    else bucket.planned += mins;
  }
  return out;
}

export function weekTotals(
  tasks: Task[],
  cats: Category[],
  ref: Date,
  weekStartsOn: 0 | 1 = 1,
) {
  const per = weekMinutes(tasks, ref, weekStartsOn);
  const done = Object.values(per).reduce((a, b) => a + b.done, 0);
  const planned = Object.values(per).reduce((a, b) => a + b.planned, 0);
  const target = cats.reduce((a, c) => a + c.weeklyTargetHours * 60, 0);
  return { per, done, planned, target };
}

export function xpThisWeek(
  tasks: Task[],
  ref: Date,
  weekStartsOn: 0 | 1 = 1,
): number {
  const { start, end } = weekBounds(ref, weekStartsOn);
  return tasks
    .filter(
      (t) =>
        t.status === "done" &&
        t.completedAt &&
        isWithinInterval(parseISO(t.completedAt), { start, end }),
    )
    .reduce((a, t) => a + taskXp(t.actualMin ?? t.estimateMin), 0);
}

// ---------------------------------------------------------------------------
// Reality score and productivity — two different questions about the same hours
//
// Reality score asks "did you do the work you said you would?" and is measured
// against what you specifically planned. Productivity asks "of the hours you
// had, how many became work?" and is measured against your whole working day.
// A week can score 100% on the first and 30% on the second — that means you
// kept every promise you made, and made very few. Both numbers are worth
// having precisely because they can disagree.
// ---------------------------------------------------------------------------

/** One planned commitment and what actually came of it, in minutes. */
export interface RealityBlock {
  plannedMin: number;
  actualMin: number;
}

/**
 * Σ min(actual, planned) / Σ planned, as a percentage.
 *
 * Weighted by time, never by count: missing one four-hour block should hurt
 * more than missing one fifteen-minute block, and a tasks-completed ratio
 * can't express that. Overshooting a block is capped at its planned length so
 * a single long session can't paper over everything else you skipped.
 *
 * Nothing planned scores 0 rather than 100 — an empty plan is not a perfect
 * one, and rewarding it would make the easiest way to a high score be to
 * stop planning.
 */
export function realityScorePct(blocks: RealityBlock[]): number {
  let planned = 0;
  let actual = 0;
  for (const b of blocks) {
    planned += b.plannedMin;
    actual += Math.min(b.actualMin, b.plannedMin);
  }
  if (planned <= 0) return 0;
  return Math.round((actual / planned) * 1000) / 10;
}

/**
 * Scheduled tasks in the window, as planned-vs-actual pairs.
 *
 * Membership is by `scheduledStart`, not `completedAt`: planned time belongs
 * to the day you meant to spend it, so finishing Monday's block on Thursday
 * should show as a hole in Monday — which is exactly the thing this score
 * exists to make visible.
 */
export function taskRealityBlocks(
  tasks: Task[],
  start: Date,
  end: Date,
): RealityBlock[] {
  return tasks
    .filter((t) => {
      if (!t.scheduledStart) return false;
      const at = +parseISO(t.scheduledStart);
      return at >= +start && at < +end;
    })
    .map((t) => ({
      plannedMin: t.estimateMin,
      actualMin:
        t.status === "done" ? Math.min(t.actualMin ?? t.estimateMin, t.estimateMin) : 0,
    }));
}

/**
 * Categorized calendar events in the window, as planned-vs-actual pairs.
 *
 * A booked hour is planned time; it only becomes actual time once you tick it
 * off. Counting every booking as kept would make the score unable to say
 * anything but 100%, which is the one number a reality score must be able to
 * withhold. Events matching no category are excluded entirely — see
 * calendar-category.ts.
 */
export function eventRealityBlocks(
  events: ExternalEvent[],
  rules: CalendarRule[],
  start: Date,
  end: Date,
  completedIds: Iterable<string> = [],
): RealityBlock[] {
  const done = new Set(completedIds);
  return categorizedEvents(events, rules)
    .filter((e) => {
      const at = +parseISO(e.start);
      return at >= +start && at < +end;
    })
    .map((e) => {
      const mins = Math.max(0, differenceInMinutes(parseISO(e.end), parseISO(e.start)));
      return { plannedMin: mins, actualMin: done.has(e.id) ? mins : 0 };
    });
}

/** Minutes of calendar time in the window that were actually ticked off. */
export function completedEventMinutes(
  events: ExternalEvent[],
  start: Date,
  end: Date,
  completedIds: Iterable<string>,
): number {
  const done = new Set(completedIds);
  let total = 0;
  for (const e of events) {
    if (!done.has(e.id)) continue;
    const at = +parseISO(e.start);
    if (at < +start || at >= +end) continue;
    total += Math.max(0, differenceInMinutes(parseISO(e.end), parseISO(e.start)));
  }
  return total;
}

/** Minutes in the working window the profile defines, over `days` days. */
export function workingWindowMinutes(
  profile: Pick<Profile, "dayStartHour" | "dayEndHour">,
  days: number,
): number {
  const hours = Math.max(0, profile.dayEndHour - profile.dayStartHour);
  return hours * 60 * days;
}

/**
 * Productive minutes as a share of the working window you set in Settings.
 *
 * Membership is by `completedAt`, deliberately unlike the reality score: this
 * measures how much of your available day turned into work, so unscheduled
 * work counts too. Capped at 100 — a day where you outwork your own stated
 * hours reads as full, not as 130%.
 */
export function productivityPct(
  tasks: Task[],
  profile: Pick<Profile, "dayStartHour" | "dayEndHour">,
  start: Date,
  end: Date,
  days: number,
  /** Ticked-off calendar time — work that happened without being a task here. */
  extraMinutes = 0,
): number {
  const window = workingWindowMinutes(profile, days);
  if (window <= 0) return 0;
  const worked = tasks
    .filter((t) => {
      if (t.status !== "done" || !t.completedAt) return false;
      const at = +parseISO(t.completedAt);
      return at >= +start && at < +end;
    })
    .reduce((a, t) => a + (t.actualMin ?? t.estimateMin), 0);
  return Math.min(100, Math.round(((worked + extraMinutes) / window) * 1000) / 10);
}

/** Minutes banked per category in a window — the shape a snapshot stores. */
export function minutesByCategory(
  tasks: Task[],
  start: Date,
  end: Date,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tasks) {
    if (t.status !== "done" || !t.completedAt) continue;
    const at = +parseISO(t.completedAt);
    if (at < +start || at >= +end) continue;
    out[t.categoryId] = (out[t.categoryId] ?? 0) + (t.actualMin ?? t.estimateMin);
  }
  return out;
}
