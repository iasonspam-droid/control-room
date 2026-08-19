import { isWithinInterval, parseISO } from "date-fns";
import { dayKey, weekBounds } from "./time";
import type { Category, Task } from "./types";
import { taskXp } from "./xp";

export const CAT_VAR: Record<Category["color"], string> = {
  amber: "var(--color-cat-amber)",
  clay: "var(--color-cat-clay)",
  olive: "var(--color-cat-olive)",
  teal: "var(--color-cat-teal)",
  steel: "var(--color-cat-steel)",
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
    .reduce((a, t) => a + taskXp(t.actualMin ?? t.estimateMin, t.quadrant), 0);
}
