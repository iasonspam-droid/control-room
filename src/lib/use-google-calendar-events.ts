"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

const REFRESH_MS = 5 * 60_000;

export interface ExternalEvent {
  id: string;
  summary: string;
  /** ISO datetime. */
  start: string;
  /** ISO datetime. */
  end: string;
  htmlLink?: string;
}

/**
 * The user's real calendar, read-only, for a given range. Best-effort like
 * the rest of the Calendar sync: signed out, not connected, or a failed
 * fetch all just mean an empty list — never an error the UI has to handle,
 * since nothing here was ever waiting on this succeeding.
 */
export function useGoogleCalendarEvents(
  timeMin: string,
  timeMax: string,
  excludeIds: string[],
): { events: ExternalEvent[]; loading: boolean } {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const [events, setEvents] = useState<ExternalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const exclude = excludeIds.join(",");

  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    if (!userId) {
      setEvents([]);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ timeMin, timeMax });
        if (exclude) params.set("exclude", exclude);
        const res = await fetch(`/api/calendar/events?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled.current) setEvents([]);
          return;
        }
        const data = (await res.json()) as { events?: ExternalEvent[] };
        if (!cancelled.current) setEvents(data.events ?? []);
      } catch {
        if (!cancelled.current) setEvents([]);
      } finally {
        if (!cancelled.current) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(() => void load(), REFRESH_MS);

    return () => {
      cancelled.current = true;
      clearInterval(interval);
    };
  }, [userId, timeMin, timeMax, exclude]);

  return { events, loading };
}
