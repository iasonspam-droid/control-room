import { auth, getGoogleAccessToken, type AccessTokenResult } from "@/lib/auth";
import { databaseConfigured, prisma } from "@/lib/db";
import {
  CalendarApiError,
  createEvent,
  deleteEvent,
  listEvents,
  updateEvent,
} from "@/lib/google-calendar";

// Every branch reads the session cookie, so there is nothing to prerender.
export const dynamic = "force-dynamic";

interface EventBody {
  taskId?: string;
  eventId?: string;
  calendarId?: string;
  timeZone?: string;
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

async function readBody(request: Request): Promise<EventBody> {
  try {
    return ((await request.json()) as EventBody) ?? {};
  } catch {
    return {};
  }
}

/** Turn the token result into the error the client can actually act on. */
function tokenError(result: Extract<AccessTokenResult, { ok: false }>): Response {
  if (result.reason === "missing-scope") {
    return json(
      {
        error: "calendar_scope_missing",
        message:
          "This Google account is connected but has not granted calendar access. Sign out and sign in again to approve the calendar permission.",
      },
      403,
    );
  }
  if (result.reason === "refresh-failed") {
    return json(
      {
        error: "google_reauth_required",
        message:
          "Google rejected the stored refresh token. Sign in with Google again to reconnect the calendar.",
      },
      403,
    );
  }
  return json(
    {
      error: "google_not_connected",
      message: "No Google account is connected to this profile.",
    },
    403,
  );
}

function calendarFailure(error: unknown): Response {
  if (error instanceof CalendarApiError) {
    return json(
      { error: "calendar_request_failed", message: error.message },
      error.status === 401 || error.status === 403 ? 403 : 502,
    );
  }
  throw error;
}

interface Authorized {
  userId: string;
  accessToken: string;
}

async function authorize(): Promise<Authorized | Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return json({ error: "unauthenticated" }, 401);
  }

  const token = await getGoogleAccessToken(userId);
  if (!token.ok) return tokenError(token);

  return { userId, accessToken: token.accessToken };
}

/** Fill in title and times from the stored task when the client only sends an id. */
async function loadTask(userId: string, taskId: string) {
  if (!databaseConfigured()) return null;
  return prisma.task.findFirst({
    where: { id: taskId, userId },
    select: {
      id: true,
      title: true,
      notes: true,
      scheduledStart: true,
      scheduledEnd: true,
      calendarEventId: true,
    },
  });
}

/**
 * GET — the user's real calendar, read-only, for display alongside their
 * planned blocks. All-day events are dropped: neither Today nor Week has an
 * all-day strip, so there's nowhere on the hour grid to put one.
 */
export async function GET(request: Request): Promise<Response> {
  const authorized = await authorize();
  if (authorized instanceof Response) return authorized;

  const url = new URL(request.url);
  const timeMin = url.searchParams.get("timeMin");
  const timeMax = url.searchParams.get("timeMax");
  const calendarId = url.searchParams.get("calendarId") ?? undefined;
  const exclude = new Set(
    (url.searchParams.get("exclude") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );

  if (!timeMin || !timeMax) {
    return json(
      {
        error: "invalid_request",
        message: "timeMin and timeMax are required ISO timestamps.",
      },
      400,
    );
  }

  try {
    const events = await listEvents(
      authorized.accessToken,
      { timeMin, timeMax },
      calendarId,
    );

    const visible = events
      .filter((e) => e.status !== "cancelled")
      .filter((e) => e.start?.dateTime && e.end?.dateTime)
      .filter((e) => !exclude.has(e.id))
      .map((e) => ({
        id: e.id,
        summary: e.summary ?? "(untitled)",
        start: e.start!.dateTime!,
        end: e.end!.dateTime!,
        htmlLink: e.htmlLink,
      }));

    return json({ events: visible });
  } catch (error) {
    return calendarFailure(error);
  }
}

/** POST — write a new block onto the calendar and return its event id. */
export async function POST(request: Request): Promise<Response> {
  const authorized = await authorize();
  if (authorized instanceof Response) return authorized;

  const body = await readBody(request);
  const task = body.taskId ? await loadTask(authorized.userId, body.taskId) : null;
  if (body.taskId && databaseConfigured() && !task) {
    return json({ error: "task_not_found" }, 404);
  }

  const summary = body.summary ?? task?.title;
  const start = body.start ?? task?.scheduledStart?.toISOString();
  const end = body.end ?? task?.scheduledEnd?.toISOString();

  if (!summary || !start || !end) {
    return json(
      {
        error: "invalid_request",
        message: "summary, start and end are required (or a scheduled taskId).",
      },
      400,
    );
  }

  try {
    const event = await createEvent(
      authorized.accessToken,
      {
        summary,
        description: body.description ?? task?.notes ?? undefined,
        start,
        end,
        timeZone: body.timeZone,
      },
      body.calendarId,
    );

    if (task) {
      await prisma.task.update({
        where: { id: task.id },
        data: { calendarEventId: event.id },
      });
    }

    return json({ eventId: event.id, htmlLink: event.htmlLink }, 201);
  } catch (error) {
    return calendarFailure(error);
  }
}

/** PATCH — the block moved; only its times (and title) ever change. */
export async function PATCH(request: Request): Promise<Response> {
  const authorized = await authorize();
  if (authorized instanceof Response) return authorized;

  const body = await readBody(request);
  const task = body.taskId ? await loadTask(authorized.userId, body.taskId) : null;
  const eventId = body.eventId ?? task?.calendarEventId;

  if (!eventId) {
    return json(
      {
        error: "invalid_request",
        message: "eventId, or a taskId with a linked calendar event, is required.",
      },
      400,
    );
  }

  const start = body.start ?? task?.scheduledStart?.toISOString();
  const end = body.end ?? task?.scheduledEnd?.toISOString();

  try {
    const event = await updateEvent(
      authorized.accessToken,
      eventId,
      {
        summary: body.summary,
        description: body.description,
        start,
        end,
        timeZone: body.timeZone,
      },
      body.calendarId,
    );
    return json({ eventId: event.id });
  } catch (error) {
    return calendarFailure(error);
  }
}

/** DELETE — the task was unscheduled, so the block should not linger. */
export async function DELETE(request: Request): Promise<Response> {
  const authorized = await authorize();
  if (authorized instanceof Response) return authorized;

  const url = new URL(request.url);
  const body = await readBody(request);
  const taskId = body.taskId ?? url.searchParams.get("taskId") ?? undefined;
  const calendarId =
    body.calendarId ?? url.searchParams.get("calendarId") ?? undefined;

  const task = taskId ? await loadTask(authorized.userId, taskId) : null;
  const eventId =
    body.eventId ?? url.searchParams.get("eventId") ?? task?.calendarEventId;

  if (!eventId) {
    return json(
      {
        error: "invalid_request",
        message: "eventId, or a taskId with a linked calendar event, is required.",
      },
      400,
    );
  }

  try {
    await deleteEvent(authorized.accessToken, eventId, calendarId);
    if (task) {
      await prisma.task.update({
        where: { id: task.id },
        data: { calendarEventId: null },
      });
    }
    return json({ ok: true });
  } catch (error) {
    return calendarFailure(error);
  }
}
