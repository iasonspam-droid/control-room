/**
 * Google Calendar v3, over plain fetch.
 *
 * No `googleapis` package on purpose: we touch four endpoints, and the SDK costs
 * more in bundle size and cold start than the ~40 lines it would save.
 *
 * Scope of the sync, deliberately narrow: Control Room writes the *block* — it
 * creates an event when a task is scheduled, moves it when the block moves, and
 * deletes it when the task is unscheduled. Completion is never written back.
 * By the time a task is ticked off, the slot has already passed; retitling a past
 * event "[done]" would rewrite history in a calendar other people can see, and
 * would tell you nothing the Control Room log doesn't already show. Calendar
 * holds intent; the app holds outcome.
 */

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const DEFAULT_CALENDAR_ID = "primary";

export interface CalendarEventTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface CalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: CalendarEventTime;
  end?: CalendarEventTime;
}

export interface EventInput {
  summary: string;
  description?: string;
  /** ISO datetime. */
  start: string;
  /** ISO datetime. */
  end: string;
  /** IANA zone; omitted means the calendar's own default. */
  timeZone?: string;
}

export interface ListEventsOptions {
  timeMin: string;
  timeMax: string;
  maxResults?: number;
}

export class CalendarApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CalendarApiError";
    this.status = status;
  }
}

interface CalendarEventList {
  items?: CalendarEvent[];
}

function toEventTime(iso: string, timeZone?: string): CalendarEventTime {
  return timeZone ? { dateTime: iso, timeZone } : { dateTime: iso };
}

async function request<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    // Google returns a JSON error envelope; fall back to the raw body if not.
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      message = parsed.error?.message ?? body;
    } catch {
      // keep the raw text
    }
    throw new CalendarApiError(response.status, message || response.statusText);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function createEvent(
  accessToken: string,
  input: EventInput,
  calendarId: string = DEFAULT_CALENDAR_ID,
): Promise<CalendarEvent> {
  return request<CalendarEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: toEventTime(input.start, input.timeZone),
        end: toEventTime(input.end, input.timeZone),
      }),
    },
  );
}

export async function updateEvent(
  accessToken: string,
  eventId: string,
  patch: Partial<EventInput>,
  calendarId: string = DEFAULT_CALENDAR_ID,
): Promise<CalendarEvent> {
  const body: Record<string, unknown> = {};
  if (patch.summary !== undefined) body.summary = patch.summary;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.start) body.start = toEventTime(patch.start, patch.timeZone);
  if (patch.end) body.end = toEventTime(patch.end, patch.timeZone);

  // PATCH, not PUT: a full update would clobber attendees, reminders and colour
  // set from Google's own UI.
  return request<CalendarEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export async function deleteEvent(
  accessToken: string,
  eventId: string,
  calendarId: string = DEFAULT_CALENDAR_ID,
): Promise<void> {
  try {
    await request<void>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
    );
  } catch (error) {
    // Already gone (deleted in Google's UI) is the outcome we wanted anyway.
    const gone =
      error instanceof CalendarApiError &&
      (error.status === 404 || error.status === 410);
    if (!gone) throw error;
  }
}

export async function listEvents(
  accessToken: string,
  options: ListEventsOptions,
  calendarId: string = DEFAULT_CALENDAR_ID,
): Promise<CalendarEvent[]> {
  const query = new URLSearchParams({
    timeMin: options.timeMin,
    timeMax: options.timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(options.maxResults ?? 250),
  });

  const data = await request<CalendarEventList>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`,
    { method: "GET" },
  );

  return data.items ?? [];
}
