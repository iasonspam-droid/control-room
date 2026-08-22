import { auth } from "@/lib/auth";
import { databaseConfigured, prisma } from "@/lib/db";
import { bestRecords, closeElapsedPeriods } from "@/lib/snapshots";

// Per-user history, never cacheable.
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

async function requireUser(): Promise<string | Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return json({ error: "unauthenticated" }, 401);
  if (!databaseConfigured()) return json({ error: "database_not_configured" }, 503);
  return userId;
}

/**
 * GET — the dashboard's history: personal bests plus the recent rows.
 *
 * `range=day|week` and `limit` control the trailing list; bests always come
 * from the full table, not the returned window.
 */
export async function GET(request: Request): Promise<Response> {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const url = new URL(request.url);
  const range = url.searchParams.get("range") === "week" ? "week" : "day";
  const limit = Math.min(
    52,
    Math.max(1, Number(url.searchParams.get("limit") ?? 14) || 14),
  );

  const [best, recent] = await Promise.all([
    bestRecords(userId),
    range === "week"
      ? prisma.weeklySnapshot.findMany({
          where: { userId },
          orderBy: { weekStart: "desc" },
          take: limit,
        })
      : prisma.dailySnapshot.findMany({
          where: { userId },
          orderBy: { date: "desc" },
          take: limit,
        }),
  ]);

  return json({
    best,
    range,
    recent: recent.map((r) => ({
      key: "date" in r ? r.date : r.weekStart,
      xp: r.xp,
      productivityPct: r.productivityPct,
      realityScorePct: r.realityScorePct,
      tasksCompleted: r.tasksCompleted,
      minutesByCategory: r.minutesByCategory,
    })),
  });
}

/**
 * POST — write any elapsed day/week that has no row yet.
 *
 * The client sends its own local date so period boundaries land on the user's
 * midnight rather than the server's. Idempotent: calling it on every load is
 * the intended usage.
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  let body: { today?: string; weekStartsOn?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // An empty body is fine — fall through to the validation below.
  }

  const today = body.today;
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return json(
      { error: "invalid_request", message: "today must be a YYYY-MM-DD date." },
      400,
    );
  }
  const weekStartsOn = body.weekStartsOn === 0 ? 0 : 1;

  const result = await closeElapsedPeriods(userId, today, weekStartsOn);
  return json(result);
}
