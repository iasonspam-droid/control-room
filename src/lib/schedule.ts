import { addMinutes, isSameDay, parseISO } from "date-fns";
import { atHour } from "./time";
import type { Profile, Task } from "./types";

/**
 * First gap on `day` big enough for `minutes`, searched forward from the later
 * of (day start, now + 5 min), rounded up to the next quarter hour.
 * Returns null if the day has no room left inside the working window.
 */
export function nextFreeSlot(
  tasks: Task[],
  day: Date,
  minutes: number,
  profile: Profile,
  now = new Date(),
): Date | null {
  const dayStart = atHour(day, profile.dayStartHour);
  const dayEnd = atHour(day, profile.dayEndHour);

  let cursor = dayStart;
  if (isSameDay(day, now)) {
    const soon = addMinutes(now, 5);
    if (soon > cursor) cursor = soon;
  }
  cursor = ceilToQuarter(cursor);

  const busy = tasks
    .filter(
      (t) =>
        t.scheduledStart &&
        t.scheduledEnd &&
        isSameDay(parseISO(t.scheduledStart), day),
    )
    .map((t) => ({
      start: parseISO(t.scheduledStart!),
      end: parseISO(t.scheduledEnd!),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const b of busy) {
    if (addMinutes(cursor, minutes) <= b.start) break;
    if (b.end > cursor) cursor = ceilToQuarter(b.end);
  }

  if (addMinutes(cursor, minutes) > dayEnd) return null;
  return cursor;
}

function ceilToQuarter(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  const m = out.getMinutes();
  const add = (15 - (m % 15)) % 15;
  return addMinutes(out, add);
}
