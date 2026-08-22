import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { databaseConfigured, prisma } from "@/lib/db";
import type { XpEvent } from "@/lib/store";
import type {
  CalendarRule,
  CatColor,
  Category,
  Goal,
  LogEntry,
  Profile,
  Quadrant,
  StreakState,
  Task,
  TaskStatus,
} from "@/lib/types";

// The whole point of this route is per-user state, so never cache or prerender it.
export const dynamic = "force-dynamic";

/**
 * The client store is still the source of truth in the browser (localStorage).
 * This endpoint is the mirror it will eventually write through to: GET rehydrates
 * a fresh device, PUT pushes the whole snapshot back. Whole-snapshot rather than
 * per-entity CRUD because the store already holds the complete state in memory and
 * a single-user app has no concurrent-writer problem worth designing around.
 */
export interface SyncState {
  categories: Category[];
  tasks: Task[];
  goals: Goal[];
  log: LogEntry[];
  profile: Profile;
  streak: StreakState;
  xp: number;
  events: XpEvent[];
}

type Tx = Prisma.TransactionClient;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function iso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

function date(value: string | undefined | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const DEFAULT_PROFILE: Profile = {
  name: "",
  weekStartsOn: 1,
  dayStartHour: 7,
  dayEndHour: 23,
  remindersEnabled: true,
  remindLeadMin: 10,
  calendarConnected: false,
};

const DEFAULT_STREAK: StreakState = {
  current: 0,
  longest: 0,
  freezesUsed: 0,
  freezesPerWeek: 2,
  frozenDates: [],
};

/** GET — the signed-in user's entire state, in the exact shape src/lib/types.ts uses. */
export async function GET(): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return json({ error: "unauthenticated" }, 401);
  if (!databaseConfigured()) return json({ error: "database_not_configured" }, 503);

  const [categories, tasks, goals, log, profile, streak, events] =
    await Promise.all([
      prisma.category.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.task.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.logEntry.findMany({ where: { userId }, orderBy: { date: "desc" } }),
      prisma.profile.findUnique({ where: { userId } }),
      prisma.streak.findUnique({ where: { userId } }),
      prisma.xpEvent.findMany({
        where: { userId },
        orderBy: { at: "desc" },
        take: 60,
      }),
    ]);

  const state: SyncState = {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      short: c.short,
      color: c.color as CatColor,
      weeklyTargetHours: c.weeklyTargetHours,
      archived: c.archived,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      categoryId: t.categoryId,
      quadrant: t.quadrant as Quadrant,
      estimateMin: t.estimateMin,
      scheduledStart: iso(t.scheduledStart),
      scheduledEnd: iso(t.scheduledEnd),
      calendarEventId: t.calendarEventId ?? undefined,
      status: t.status as TaskStatus,
      completedAt: iso(t.completedAt),
      actualMin: t.actualMin ?? undefined,
      goalId: t.goalId ?? undefined,
      notes: t.notes ?? undefined,
      createdAt: t.createdAt.toISOString(),
    })),
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      categoryId: g.categoryId,
      target: g.target,
      current: g.current,
      unit: g.unit,
      due: iso(g.due),
      done: g.done,
    })),
    log: log.map((l) => ({
      id: l.id,
      date: l.date,
      body: l.body,
      energy: (l.energy ?? undefined) as LogEntry["energy"],
      createdAt: l.createdAt.toISOString(),
    })),
    profile: profile
      ? {
          name: profile.name,
          weekStartsOn: (profile.weekStartsOn === 0 ? 0 : 1) as Profile["weekStartsOn"],
          dayStartHour: profile.dayStartHour,
          dayEndHour: profile.dayEndHour,
          remindersEnabled: profile.remindersEnabled,
          remindLeadMin: profile.remindLeadMin,
          calendarConnected: profile.calendarConnected,
          calendarId: profile.calendarId ?? undefined,
          calendarRules: (profile.calendarRules as CalendarRule[] | null) ?? [],
          calendarMiscColor:
            (profile.calendarMiscColor as CatColor | null) ?? undefined,
          completedEventIds: profile.completedEventIds ?? [],
        }
      : { ...DEFAULT_PROFILE, name: session.user?.name ?? "" },
    streak: streak
      ? {
          current: streak.current,
          longest: streak.longest,
          freezesUsed: streak.freezesUsed,
          freezesPerWeek: streak.freezesPerWeek,
          lastActiveDate: streak.lastActiveDate ?? undefined,
          frozenDates: streak.frozenDates,
        }
      : DEFAULT_STREAK,
    xp: profile?.xp ?? 0,
    events: events.map((e) => ({
      id: e.id,
      at: e.at.toISOString(),
      amount: e.amount,
      label: e.label,
      kind: e.kind as XpEvent["kind"],
    })),
  };

  return json(state);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function array<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Ids are minted by the client, so a row could in principle collide with another
 * user's. Rather than blind-upserting by primary key (which would let one account
 * overwrite another's row), we only ever update ids this user already owns and
 * create the rest — a genuine collision surfaces as a unique-constraint error.
 */
function ownedIds(rows: Array<{ id: string }>): Set<string> {
  return new Set(rows.map((r) => r.id));
}

/** PUT — replace the stored snapshot with the one the client just sent. */
export async function PUT(request: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return json({ error: "unauthenticated" }, 401);
  if (!databaseConfigured()) return json({ error: "database_not_configured" }, 503);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!isRecord(payload)) return json({ error: "invalid_payload" }, 400);

  const categories = array<Category>(payload.categories);
  const tasks = array<Task>(payload.tasks);
  const goals = array<Goal>(payload.goals);
  const log = array<LogEntry>(payload.log);
  const events = array<XpEvent>(payload.events);
  const profile = isRecord(payload.profile)
    ? ({ ...DEFAULT_PROFILE, ...payload.profile } as Profile)
    : DEFAULT_PROFILE;
  const streak = isRecord(payload.streak)
    ? ({ ...DEFAULT_STREAK, ...payload.streak } as StreakState)
    : DEFAULT_STREAK;
  const xp = typeof payload.xp === "number" ? Math.max(0, Math.round(payload.xp)) : 0;

  // Foreign keys are checked up front so a bad payload fails as 400, not as a
  // half-applied transaction.
  const categoryIds = new Set(categories.map((c) => c.id));
  const goalIds = new Set(goals.map((g) => g.id));
  const orphan = tasks.find((t) => !categoryIds.has(t.categoryId));
  if (orphan) {
    return json(
      {
        error: "unknown_category",
        message: `Task ${orphan.id} references category ${orphan.categoryId}, which is not in the payload.`,
      },
      400,
    );
  }
  const orphanGoal = goals.find((g) => !categoryIds.has(g.categoryId));
  if (orphanGoal) {
    return json(
      {
        error: "unknown_category",
        message: `Goal ${orphanGoal.id} references category ${orphanGoal.categoryId}, which is not in the payload.`,
      },
      400,
    );
  }

  try {
    await prisma.$transaction(
      async (tx: Tx) => {
        // Order matters: categories and goals exist before the tasks that point at
        // them, and deletions run after so nothing is orphaned mid-flight.
        const existingCategories = ownedIds(
          await tx.category.findMany({ where: { userId }, select: { id: true } }),
        );
        for (const c of categories) {
          const data = {
            name: c.name,
            short: c.short,
            color: c.color,
            weeklyTargetHours: c.weeklyTargetHours,
            archived: Boolean(c.archived),
          };
          if (existingCategories.has(c.id)) {
            await tx.category.update({ where: { id: c.id }, data });
          } else {
            await tx.category.create({ data: { ...data, id: c.id, userId } });
          }
        }

        const existingGoals = ownedIds(
          await tx.goal.findMany({ where: { userId }, select: { id: true } }),
        );
        for (const g of goals) {
          const data = {
            title: g.title,
            categoryId: g.categoryId,
            target: g.target,
            current: g.current,
            unit: g.unit,
            due: date(g.due),
            done: Boolean(g.done),
          };
          if (existingGoals.has(g.id)) {
            await tx.goal.update({ where: { id: g.id }, data });
          } else {
            await tx.goal.create({ data: { ...data, id: g.id, userId } });
          }
        }

        const existingTasks = ownedIds(
          await tx.task.findMany({ where: { userId }, select: { id: true } }),
        );
        for (const t of tasks) {
          const data = {
            title: t.title,
            categoryId: t.categoryId,
            quadrant: t.quadrant,
            estimateMin: t.estimateMin,
            scheduledStart: date(t.scheduledStart),
            scheduledEnd: date(t.scheduledEnd),
            calendarEventId: t.calendarEventId ?? null,
            status: t.status,
            completedAt: date(t.completedAt),
            actualMin: t.actualMin ?? null,
            goalId: t.goalId && goalIds.has(t.goalId) ? t.goalId : null,
            notes: t.notes ?? null,
          };
          if (existingTasks.has(t.id)) {
            await tx.task.update({ where: { id: t.id }, data });
          } else {
            await tx.task.create({
              data: {
                ...data,
                id: t.id,
                userId,
                createdAt: date(t.createdAt) ?? new Date(),
              },
            });
          }
        }

        const existingLog = ownedIds(
          await tx.logEntry.findMany({ where: { userId }, select: { id: true } }),
        );
        for (const l of log) {
          const data = { date: l.date, body: l.body, energy: l.energy ?? null };
          if (existingLog.has(l.id)) {
            await tx.logEntry.update({ where: { id: l.id }, data });
          } else {
            await tx.logEntry.create({
              data: {
                ...data,
                id: l.id,
                userId,
                createdAt: date(l.createdAt) ?? new Date(),
              },
            });
          }
        }

        const existingEvents = ownedIds(
          await tx.xpEvent.findMany({ where: { userId }, select: { id: true } }),
        );
        for (const e of events) {
          if (existingEvents.has(e.id)) continue; // XP events are immutable
          await tx.xpEvent.create({
            data: {
              id: e.id,
              userId,
              at: date(e.at) ?? new Date(),
              amount: e.amount,
              kind: e.kind,
              label: e.label,
            },
          });
        }

        // Anything the client no longer knows about was deleted there.
        await tx.task.deleteMany({
          where: { userId, id: { notIn: tasks.map((t) => t.id) } },
        });
        await tx.goal.deleteMany({
          where: { userId, id: { notIn: goals.map((g) => g.id) } },
        });
        await tx.category.deleteMany({
          where: { userId, id: { notIn: categories.map((c) => c.id) } },
        });
        await tx.logEntry.deleteMany({
          where: { userId, id: { notIn: log.map((l) => l.id) } },
        });

        const profileData = {
          name: profile.name,
          weekStartsOn: profile.weekStartsOn,
          dayStartHour: profile.dayStartHour,
          dayEndHour: profile.dayEndHour,
          remindersEnabled: profile.remindersEnabled,
          remindLeadMin: profile.remindLeadMin,
          calendarConnected: profile.calendarConnected,
          calendarId: profile.calendarId ?? null,
          calendarRules: (profile.calendarRules ??
            []) as unknown as Prisma.InputJsonValue,
          calendarMiscColor: profile.calendarMiscColor ?? null,
          completedEventIds: profile.completedEventIds ?? [],
          xp,
        };
        await tx.profile.upsert({
          where: { userId },
          create: { ...profileData, userId },
          update: profileData,
        });

        const streakData = {
          current: streak.current,
          longest: streak.longest,
          freezesUsed: streak.freezesUsed,
          freezesPerWeek: streak.freezesPerWeek,
          lastActiveDate: streak.lastActiveDate ?? null,
          frozenDates: streak.frozenDates ?? [],
        };
        await tx.streak.upsert({
          where: { userId },
          create: { ...streakData, userId },
          update: streakData,
        });
      },
      // A full snapshot is many small writes; the 5s default is too tight.
      { timeout: 30_000, maxWait: 10_000 },
    );
  } catch (error) {
    const code = (error as Prisma.PrismaClientKnownRequestError).code;
    if (code === "P2002") {
      return json({ error: "id_conflict", message: "An id in this payload is already in use." }, 409);
    }
    return json(
      { error: "sync_failed", message: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }

  return json({ ok: true });
}
