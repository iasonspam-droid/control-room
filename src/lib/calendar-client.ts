"use client";

/**
 * Thin client for /api/calendar/events. Every call is deliberately best-effort:
 * a failed sync must never block the local booking that already happened —
 * the store is the source of truth for the UI, Calendar is a mirror of it.
 */
export interface CalendarSyncResult {
  ok: boolean;
  eventId?: string;
  /** Human-readable, only set on failure — safe to show the person directly. */
  message?: string;
}

async function call(
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown>,
): Promise<CalendarSyncResult> {
  try {
    const res = await fetch("/api/calendar/events", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Not signed in, or Calendar not connected — expected, stay silent.
    if (res.status === 401) return { ok: false };
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) {
      return {
        ok: false,
        message:
          typeof data.message === "string"
            ? data.message
            : "Google Calendar didn't accept that change.",
      };
    }
    return { ok: true, eventId: typeof data.eventId === "string" ? data.eventId : undefined };
  } catch {
    return { ok: false, message: "Couldn't reach Google Calendar." };
  }
}

export function createCalendarEvent(params: {
  summary: string;
  start: string;
  end: string;
}): Promise<CalendarSyncResult> {
  return call("POST", params);
}

export function moveCalendarEvent(params: {
  eventId: string;
  start: string;
  end: string;
}): Promise<CalendarSyncResult> {
  return call("PATCH", params);
}

export function deleteCalendarEvent(eventId: string): Promise<CalendarSyncResult> {
  return call("DELETE", { eventId });
}
