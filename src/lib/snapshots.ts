import { addDays, parseISO, startOfWeek, subDays } from "date-fns";
import { prisma } from "./db";
import {
  minutesByCategory,
  productivityPct,
  realityScorePct,
  taskRealityBlocks,
} from "./derive";
import { dayKey } from "./time";
import type { Profile, Quadrant, Task, TaskStatus } from "./types";

/**
 * Closing out finished periods.
 *
 * Today's numbers are always computed live — a snapshot is only ever written
 * for a period that has completely ended, which is what makes a row safe to
 * treat as final and never revisit.
 *
 * There is no scheduler here on purpose. The only thing a cron would buy is
 * writing the row at midnight rather than the next time you open the app, and
 * since a finished day's data cannot change either way, that is a whole piece
 * of infrastructure to make a number appear earlier in a table nobody is
 * looking at yet. Opening the app is a good enough trigger, and the unique
 * constraints make a repeat call free.
 */

/** How far back to look for unwritten periods. Bounds the work after a long gap. */
const LOOKBACK_DAYS = 60;
const LOOKBACK_WEEKS = 12;

interface PeriodMetrics {
  xp: number;
  productivityPct: number;
  realityScorePct: number;
  tasksCompleted: number;
  minutesByCategory: Record<string, number>;
}

/** Prisma rows → the client `Task` shape the derive functions expect. */
interface TaskRow {
  id: string;
  title: string;
  categoryId: string;
  quadrant: string;
  estimateMin: number;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  status: string;
  completedAt: Date | null;
  actualMin: number | null;
  createdAt: Date;
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.categoryId,
    quadrant: row.quadrant as Quadrant,
    estimateMin: row.estimateMin,
    scheduledStart: row.scheduledStart?.toISOString(),
    scheduledEnd: row.scheduledEnd?.toISOString(),
    status: row.status as TaskStatus,
    completedAt: row.completedAt?.toISOString(),
    actualMin: row.actualMin ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The numbers for one closed window.
 *
 * XP is summed from the database rather than the client's event feed, which is
 * capped — a permanent record should not quietly under-count a busy week just
 * because the in-memory list had a ceiling.
 *
 * External calendar events are deliberately not fetched here. Doing so would
 * mean holding a Google token for a backfill that may run days later, for a
 * window whose events may since have been edited or deleted; a stored score
 * that silently disagrees with what the dashboard showed at the time is worse
 * than one that only counts the app's own blocks. Live reality scores do
 * include calendar time — see derive.eventRealityBlocks.
 */
async function metricsFor(
  userId: string,
  start: Date,
  end: Date,
  days: number,
  profile: Pick<Profile, "dayStartHour" | "dayEndHour">,
): Promise<PeriodMetrics> {
  const [rows, xpAgg] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        OR: [
          { scheduledStart: { gte: start, lt: end } },
          { completedAt: { gte: start, lt: end } },
        ],
      },
    }),
    prisma.xpEvent.aggregate({
      where: { userId, at: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ]);

  const tasks = rows.map(toTask);
  const completed = tasks.filter(
    (t) =>
      t.status === "done" &&
      t.completedAt &&
      +parseISO(t.completedAt) >= +start &&
      +parseISO(t.completedAt) < +end,
  );

  return {
    xp: xpAgg._sum.amount ?? 0,
    productivityPct: productivityPct(tasks, profile, start, end, days),
    realityScorePct: realityScorePct(taskRealityBlocks(tasks, start, end)),
    tasksCompleted: completed.length,
    minutesByCategory: minutesByCategory(tasks, start, end),
  };
}

/** Local midnight for a YYYY-MM-DD key, matching how the client reads dates. */
function dayStart(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Write the elapsed days and weeks that have no row yet.
 *
 * `todayLocal` comes from the client because the boundary that matters is the
 * user's midnight, not the server's — the same reason dates are stored as
 * YYYY-MM-DD strings throughout.
 */
export async function closeElapsedPeriods(
  userId: string,
  todayLocal: string,
  weekStartsOn: 0 | 1,
): Promise<{ daysWritten: number; weeksWritten: number }> {
  const profileRow = await prisma.profile.findUnique({ where: { userId } });
  const profile = {
    dayStartHour: profileRow?.dayStartHour ?? 7,
    dayEndHour: profileRow?.dayEndHour ?? 23,
  };

  const today = dayStart(todayLocal);

  /* ── days ─────────────────────────────────────────────────── */
  const dayKeys: string[] = [];
  for (let i = 1; i <= LOOKBACK_DAYS; i++) dayKeys.push(dayKey(subDays(today, i)));

  const existingDays = new Set(
    (
      await prisma.dailySnapshot.findMany({
        where: { userId, date: { in: dayKeys } },
        select: { date: true },
      })
    ).map((r) => r.date),
  );

  let daysWritten = 0;
  for (const key of dayKeys) {
    if (existingDays.has(key)) continue;
    const start = dayStart(key);
    const end = addDays(start, 1);
    const m = await metricsFor(userId, start, end, 1, profile);
    // A day with nothing in it at all is not worth a row — it would only
    // dilute averages with days the app was never opened.
    if (m.xp === 0 && m.tasksCompleted === 0 && m.realityScorePct === 0) continue;
    await prisma.dailySnapshot.create({
      data: { userId, date: key, ...m },
    });
    daysWritten++;
  }

  /* ── weeks ────────────────────────────────────────────────── */
  const thisWeekStart = startOfWeek(today, { weekStartsOn });
  const weekKeys: string[] = [];
  for (let i = 1; i <= LOOKBACK_WEEKS; i++) {
    weekKeys.push(dayKey(subDays(thisWeekStart, i * 7)));
  }

  const existingWeeks = new Set(
    (
      await prisma.weeklySnapshot.findMany({
        where: { userId, weekStart: { in: weekKeys } },
        select: { weekStart: true },
      })
    ).map((r) => r.weekStart),
  );

  let weeksWritten = 0;
  for (const key of weekKeys) {
    if (existingWeeks.has(key)) continue;
    const start = dayStart(key);
    const end = addDays(start, 7);
    const m = await metricsFor(userId, start, end, 7, profile);
    if (m.xp === 0 && m.tasksCompleted === 0 && m.realityScorePct === 0) continue;
    await prisma.weeklySnapshot.create({
      data: { userId, weekStart: key, ...m },
    });
    weeksWritten++;
  }

  return { daysWritten, weeksWritten };
}

export async function bestRecords(userId: string): Promise<{
  bestDayXp: number;
  bestWeekXp: number;
  bestDayReality: number;
  bestWeekReality: number;
  bestDayProductivity: number;
}> {
  const [day, week] = await Promise.all([
    prisma.dailySnapshot.aggregate({
      where: { userId },
      _max: { xp: true, realityScorePct: true, productivityPct: true },
    }),
    prisma.weeklySnapshot.aggregate({
      where: { userId },
      _max: { xp: true, realityScorePct: true },
    }),
  ]);

  return {
    bestDayXp: day._max.xp ?? 0,
    bestWeekXp: week._max.xp ?? 0,
    bestDayReality: day._max.realityScorePct ?? 0,
    bestWeekReality: week._max.realityScorePct ?? 0,
    bestDayProductivity: day._max.productivityPct ?? 0,
  };
}
