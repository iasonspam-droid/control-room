import {
  addDays,
  differenceInMinutes,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

export const DAY_KEY = "yyyy-MM-dd";

export function dayKey(d: Date | string): string {
  return format(typeof d === "string" ? parseISO(d) : d, DAY_KEY);
}

export function weekBounds(d: Date, weekStartsOn: 0 | 1 = 1) {
  return {
    start: startOfWeek(d, { weekStartsOn }),
    end: endOfWeek(d, { weekStartsOn }),
  };
}

export function weekDays(d: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const { start } = weekBounds(d, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Minutes from local midnight — the unit the timeline is drawn in. */
export function minutesIntoDay(iso: string): number {
  const d = parseISO(iso);
  return differenceInMinutes(d, startOfDay(d));
}

export function atHour(day: Date, hour: number, minute = 0): Date {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function fmtClock(iso: string): string {
  return format(parseISO(iso), "H:mm");
}

export function fmtRange(startIso: string, endIso: string): string {
  return `${format(parseISO(startIso), "H:mm")}–${format(parseISO(endIso), "H:mm")}`;
}

/** 95 → "1h35". The mono readout format used everywhere a duration appears. */
export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function fmtHours(min: number): string {
  return (min / 60).toFixed(1);
}
