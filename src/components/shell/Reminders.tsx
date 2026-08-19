"use client";

import { useEffect, useRef } from "react";
import { parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { fmtRange } from "@/lib/time";

/**
 * Browser notification a few minutes before a booked block starts.
 *
 * Deliberately foreground-only: a service worker could fire these with the tab
 * closed, but that needs a push subscription and a server to hold it. This
 * covers the actual case — the tab is open on a second monitor all evening —
 * without a backend. Fired ids are held in a ref so a re-render can't double-fire.
 */
export function Reminders() {
  const tasks = useStore((s) => s.tasks);
  const profile = useStore((s) => s.profile);
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile.remindersEnabled) return;
    if (typeof Notification === "undefined") return;

    const tick = () => {
      if (Notification.permission !== "granted") return;
      const now = Date.now();
      const lead = profile.remindLeadMin * 60_000;

      for (const t of tasks) {
        if (t.status !== "open" || !t.scheduledStart) continue;
        if (fired.current.has(t.id)) continue;
        const start = +parseISO(t.scheduledStart);
        const delta = start - now;
        if (delta <= lead && delta > -60_000) {
          fired.current.add(t.id);
          new Notification(t.title, {
            body: `${fmtRange(t.scheduledStart, t.scheduledEnd!)} · starts in ${Math.max(
              0,
              Math.round(delta / 60_000),
            )} min`,
            tag: t.id,
            silent: false,
          });
        }
      }
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [tasks, profile.remindersEnabled, profile.remindLeadMin]);

  return null;
}
