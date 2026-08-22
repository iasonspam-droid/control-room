"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { differenceInMinutes, parseISO, startOfDay } from "date-fns";
import { useSession } from "next-auth/react";
import { Check, CornerUpLeft, RefreshCw, Undo2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { CAT_VAR, catColor, tasksOnDay } from "@/lib/derive";
import { resolveEventStyle, type EventStyle } from "@/lib/calendar-category";
import { dayRange, fmtRange } from "@/lib/time";
import { taskXp } from "@/lib/xp";
import type { CatColor, Task } from "@/lib/types";
import { deleteCalendarEvent } from "@/lib/calendar-client";
import {
  useGoogleCalendarEvents,
  type ExternalEvent,
} from "@/lib/use-google-calendar-events";

const HOUR_H = 64;

/**
 * Overlapping blocks share the width of their cluster, the way a calendar
 * column does. Two things booked at once should look like a conflict, not
 * like one block hiding another.
 */
function layout(items: Task[]) {
  const rows = items
    .map((t) => ({
      t,
      s: +parseISO(t.scheduledStart!),
      e: +parseISO(t.scheduledEnd!),
      lane: 0,
      lanes: 1,
    }))
    .sort((a, b) => a.s - b.s || a.e - b.e);

  const out: typeof rows = [];
  let cluster: typeof rows = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const laneEnds: number[] = [];
    for (const it of cluster) {
      let lane = laneEnds.findIndex((end) => end <= it.s);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = it.e;
      it.lane = lane;
    }
    for (const it of cluster) it.lanes = laneEnds.length;
    out.push(...cluster);
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const it of rows) {
    if (cluster.length && it.s >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  flush();
  return out;
}

export function Timeline({ day }: { day: Date }) {
  const {
    tasks,
    categories,
    profile,
    setProfile,
    completeTask,
    uncompleteTask,
    unschedule,
  } = useStore();
  const { data: session } = useSession();
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  /* The app's own blocks are already on the calendar (if synced) — never show
     them a second time as an "external" event. */
  const excludeIds = useMemo(
    () => tasks.filter((t) => t.calendarEventId).map((t) => t.calendarEventId!),
    [tasks],
  );
  const rules = profile.calendarRules ?? [];
  const miscColor = profile.calendarMiscColor;

  /* Completion for calendar blocks lives here, not in Google — see ExternalBlock. */
  const completedEvents = useMemo(
    () => new Set(profile.completedEventIds ?? []),
    [profile.completedEventIds],
  );
  function toggleEventDone(id: string) {
    const next = new Set(completedEvents);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setProfile({ completedEventIds: [...next] });
  }
  const { timeMin, timeMax } = useMemo(() => dayRange(day), [day]);
  const { events: externalEvents } = useGoogleCalendarEvents(
    timeMin,
    timeMax,
    excludeIds,
  );

  /* Local state moves the block back to the queue instantly; the Calendar
     delete happens after, best-effort — see calendar-client.ts. */
  function handleUnschedule(task: Task) {
    unschedule(task.id);
    if (session?.user && task.calendarEventId) {
      void deleteCalendarEvent(task.calendarEventId);
    }
  }

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { dayStartHour: h0, dayEndHour: h1 } = profile;
  const hours = useMemo(
    () => Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i),
    [h0, h1],
  );
  const blocks = tasksOnDay(tasks, day);
  const laid = useMemo(() => layout(blocks), [blocks]);

  const top = (iso: string) =>
    ((differenceInMinutes(parseISO(iso), startOfDay(parseISO(iso))) - h0 * 60) /
      60) *
    HOUR_H;

  const nowTop =
    ((differenceInMinutes(now, startOfDay(now)) - h0 * 60) / 60) * HOUR_H;
  const nowVisible = nowTop >= 0 && nowTop <= (h1 - h0) * HOUR_H;

  /* Land on the earliest of (first block, now) so a late-evening visit still
     shows the morning you actually banked, not an empty band above it. */
  useEffect(() => {
    if (!scroller.current) return;
    const firstTop = blocks.length ? top(blocks[0].scheduledStart!) : nowTop;
    scroller.current.scrollTop = Math.max(
      0,
      Math.min(nowTop - 200, firstTop - 40),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={scroller} className="h-full overflow-y-auto">
      <div
        className="relative"
        style={{ height: (h1 - h0) * HOUR_H + 24 }}
      >
        {/* hour rules + gutter */}
        {hours.map((h, i) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-line"
            style={{ top: i * HOUR_H }}
          >
            <span className="t-num absolute -top-[7px] left-3 bg-bg px-1 text-[10px] text-mute">
              {String(h).padStart(2, "0")}
            </span>
          </div>
        ))}

        {/* half-hour ticks, quieter */}
        {hours.slice(0, -1).map((h, i) => (
          <div
            key={`half-${h}`}
            className="absolute left-14 right-0 border-t border-line/40"
            style={{ top: i * HOUR_H + HOUR_H / 2 }}
          />
        ))}

        {/* now */}
        {nowVisible && (
          <div
            className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
            style={{ top: nowTop }}
          >
            <span className="t-num bg-signal px-1 py-[1px] text-[9px] font-bold text-[#140c05]">
              {String(now.getHours()).padStart(2, "0")}:
              {String(now.getMinutes()).padStart(2, "0")}
            </span>
            <span className="h-[1px] flex-1 bg-signal" />
          </div>
        )}

        {/* real calendar, read-only — never part of the conflict-lane layout */}
        {externalEvents.map((e) => (
          <ExternalBlock
            key={e.id}
            event={e}
            style={resolveEventStyle(e.summary, rules, miscColor)}
            done={completedEvents.has(e.id)}
            onToggle={() => toggleEventDone(e.id)}
            top={top(e.start)}
            height={
              (differenceInMinutes(parseISO(e.end), parseISO(e.start)) / 60) *
              HOUR_H
            }
          />
        ))}

        {/* blocks */}
        {laid.map(({ t, lane, lanes }) => (
          <Block
            key={t.id}
            task={t}
            top={top(t.scheduledStart!)}
            height={
              (differenceInMinutes(
                parseISO(t.scheduledEnd!),
                parseISO(t.scheduledStart!),
              ) /
                60) *
              HOUR_H
            }
            lane={lane}
            lanes={lanes}
            color={catColor(categories, t.categoryId)}
            onComplete={() => completeTask(t.id)}
            onUndo={() => uncompleteTask(t.id)}
            onUnschedule={() => handleUnschedule(t)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A real event already on the user's calendar — shown for context only.
 * Deliberately not a `<button>` and not clickable: this app never modifies
 * an event it didn't create (see Settings), so nothing here should even
 * look actionable.
 */
/**
 * A block from the real calendar.
 *
 * Read-only as far as Google is concerned — this app still never edits an
 * event it didn't create — but you can tick it off here, and that tick is
 * what tells the reality score the hour actually happened. Without it a
 * calendar full of bookings would score 100% for a day spent doing none of it.
 */
function ExternalBlock({
  event,
  style,
  done,
  onToggle,
  top,
  height,
}: {
  event: ExternalEvent;
  /** Colour and classification, resolved centrally from the rule list. */
  style: EventStyle;
  done: boolean;
  onToggle: () => void;
  top: number;
  height: number;
}) {
  const short = height < 44;
  const tint = CAT_VAR[style.color];
  return (
    <article
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-label={`${event.summary} — ${done ? "mark not done" : "mark done"}`}
      title={`${event.summary} · ${style.label} · ${
        done ? "done, click to undo" : "click anywhere to mark done"
      }`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className="group absolute left-14 right-2 z-[5] flex cursor-pointer overflow-hidden border border-dashed transition-colors"
      style={{
        top,
        height: Math.max(26, height - 2),
        borderColor: tint,
        background: done ? "var(--color-cool-wash)" : "transparent",
      }}
    >
      <span className="w-[3px] shrink-0" style={{ background: tint }} />
      <div className="flex min-w-0 flex-1 items-start gap-2 px-2.5 py-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          tabIndex={-1}
          aria-hidden="true"
          className="mt-[2px] grid h-[24px] w-[24px] shrink-0 place-items-center border-2 transition-colors"
          style={
            done
              ? {
                  borderColor: "var(--color-cool)",
                  background: "var(--color-cool)",
                  color: "var(--color-bg)",
                }
              : {
                  borderColor: "#ede7dc",
                  background: "rgba(237, 231, 220, 0.18)",
                  color: "#ede7dc",
                }
          }
        >
          <Check
            size={16}
            strokeWidth={3}
            className={done ? "" : "opacity-40 transition-opacity group-hover:opacity-100"}
          />
        </button>
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[26px] leading-tight"
            style={{ color: tint, opacity: done ? 0.55 : 1 }}
          >
            {event.summary}
          </div>
          {!short && (
            <span className="t-num text-[10px] text-dim">
              {fmtRange(event.start, event.end)}
              {done && <span className="ml-2 text-cool">done</span>}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function Block({
  task,
  top,
  height,
  lane,
  lanes,
  color,
  onComplete,
  onUndo,
  onUnschedule,
}: {
  task: Task;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  color: string;
  onComplete: () => void;
  onUndo: () => void;
  onUnschedule: () => void;
}) {
  const done = task.status === "done";
  const short = height < 44;
  const band = `(100% - 3.5rem - 0.75rem)`;

  return (
    <article
      /* The whole block toggles done, exactly as the Week grid already does.
         Hunting for a 24px square to record an hour of work is the wrong deal
         — and if the box is ever hard to spot, the score quietly stops
         reflecting reality, which is the one thing it exists to do. */
      onClick={done ? onUndo : onComplete}
      role="button"
      tabIndex={0}
      aria-label={done ? `${task.title} — mark not done` : `${task.title} — mark done`}
      title={done ? "Done — click anywhere to undo" : "Click anywhere to mark done"}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          (done ? onUndo : onComplete)();
        }
      }}
      className={`group absolute z-10 flex cursor-pointer overflow-hidden border transition-colors ${
        done
          ? "border-line bg-cool-wash"
          : "border-line-hot bg-surface-2 hover:z-30 hover:border-dim"
      }`}
      style={{
        top,
        height: Math.max(26, height - 2),
        left: `calc(3.5rem + ${band} * ${lane / lanes})`,
        width: `calc(${band} * ${1 / lanes} - ${lanes > 1 ? "2px" : "0px"})`,
      }}
    >
      <span
        className="w-[3px] shrink-0"
        style={{ background: done ? "var(--color-cool-dim)" : color }}
      />
      <div className="flex min-w-0 flex-1 items-start gap-2 px-2.5 py-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            (done ? onUndo : onComplete)();
          }}
          tabIndex={-1}
          aria-hidden="true"
          title={done ? "Done — click to undo" : "Mark this block done"}
          className="mt-[2px] grid h-[24px] w-[24px] shrink-0 place-items-center border-2 transition-colors"
          style={
            done
              ? {
                  borderColor: "var(--color-cool)",
                  background: "var(--color-cool)",
                  color: "var(--color-bg)",
                }
              : {
                  borderColor: "#ede7dc",
                  background: "rgba(237, 231, 220, 0.18)",
                  color: "#ede7dc",
                }
          }
        >
          <Check
            size={16}
            strokeWidth={3}
            className={done ? "" : "opacity-40 transition-opacity group-hover:opacity-100"}
          />
        </button>

        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-[26px] leading-tight ${
              done ? "text-dim" : "text-text"
            }`}
          >
            {task.title}
          </div>
          {!short && (
            <div className="mt-1 flex items-center gap-2">
              <span className="t-num text-[10px] text-mute">
                {fmtRange(task.scheduledStart!, task.scheduledEnd!)}
              </span>
              <span
                className={`t-num text-[10px] ${
                  done ? "text-cool" : "text-signal-dim"
                }`}
              >
                {done ? "+" : ""}
                {taskXp(task.actualMin ?? task.estimateMin)} xp
              </span>
              {task.calendarEventId && (
                <RefreshCw
                  size={9}
                  strokeWidth={2}
                  className="text-cool"
                  aria-label="Synced to Google Calendar"
                />
              )}
            </div>
          )}
        </div>

        {!done && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnschedule();
            }}
            title="Back to queue"
            className="shrink-0 text-mute opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
          >
            <CornerUpLeft size={13} strokeWidth={1.5} />
          </button>
        )}
        {done && (
          <button
            onClick={onUndo}
            title="Undo"
            className="shrink-0 text-mute opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
          >
            <Undo2 size={13} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </article>
  );
}
