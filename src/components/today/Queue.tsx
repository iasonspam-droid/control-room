"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { useSession } from "next-auth/react";
import { CalendarPlus, Check, Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { catColor, unscheduled } from "@/lib/derive";
import { nextFreeSlot } from "@/lib/schedule";
import { fmtDuration } from "@/lib/time";
import { QUADRANT_META, QUADRANT_WEIGHT, taskXp } from "@/lib/xp";
import type { Quadrant, Task } from "@/lib/types";
import { Empty } from "@/components/ui/Panel";
import { createCalendarEvent } from "@/lib/calendar-client";

export function Queue({ day }: { day: Date }) {
  const { tasks, categories, profile, completeTask, schedule, removeTask, updateTask } =
    useStore();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const queue = unscheduled(tasks).sort(
    (a, b) =>
      QUADRANT_WEIGHT[b.quadrant] - QUADRANT_WEIGHT[a.quadrant] ||
      b.estimateMin - a.estimateMin,
  );

  function flash(message: string, ms = 4000) {
    setNote(message);
    setTimeout(() => setNote(null), ms);
  }

  /* Roll forward until it fits. A late-evening "no room today" is a dead end;
     landing on Thursday morning and saying so is an answer.
     Booking is local-first: the block lands on the timeline immediately,
     then Google Calendar catches up in the background. A slow or failed
     sync should never make the click itself feel like it did nothing. */
  async function book(task: Task) {
    for (let i = 0; i < 14; i++) {
      const target = addDays(day, i);
      const slot = nextFreeSlot(tasks, target, task.estimateMin, profile);
      if (!slot) continue;

      const startIso = slot.toISOString();
      const endIso = new Date(
        slot.getTime() + task.estimateMin * 60_000,
      ).toISOString();

      schedule(task.id, startIso, task.estimateMin);
      if (i > 0) {
        flash(
          `no room today — booked ${format(slot, "EEEE").toLowerCase()} at ${format(slot, "HH:mm")}`,
        );
      }

      if (session?.user) {
        setSyncingId(task.id);
        const result = await createCalendarEvent({
          summary: task.title,
          start: startIso,
          end: endIso,
        });
        setSyncingId(null);
        if (result.ok && result.eventId) {
          updateTask(task.id, { calendarEventId: result.eventId });
        } else if (result.message) {
          flash(`booked locally — ${result.message}`, 5500);
        }
      }
      return;
    }
    flash("no room in the next two weeks — shorten it or cut something");
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="t-label">
          Queue <span className="text-dim">· {queue.length}</span>
        </h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-mute transition-colors hover:text-signal"
          aria-label="Add task"
        >
          {open ? <X size={14} strokeWidth={1.5} /> : <Plus size={14} strokeWidth={1.5} />}
        </button>
      </div>

      {open && <Composer onDone={() => setOpen(false)} />}

      {note && (
        <p className="border-b border-signal/40 bg-signal-wash px-3 py-1.5 font-mono text-[10px] text-signal">
          {note}
        </p>
      )}

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {queue.length === 0 && <Empty>queue is empty. rare. enjoy it.</Empty>}
        {queue.map((t) => (
          <li
            key={t.id}
            className="group flex items-start gap-2 border-b border-line px-3 py-2 transition-colors hover:bg-surface-2"
          >
            <button
              onClick={() => completeTask(t.id)}
              aria-label="Mark done"
              className="mt-[2px] grid h-[15px] w-[15px] shrink-0 place-items-center border border-line-hot transition-colors hover:border-signal hover:bg-signal-wash"
            >
              <Check size={11} strokeWidth={3} className="opacity-0" />
            </button>
            <span
              className="mt-[3px] h-3 w-[3px] shrink-0"
              style={{ background: catColor(categories, t.categoryId) }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug">{t.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="t-label !text-[9px]">
                  {QUADRANT_META[t.quadrant].key}
                </span>
                <span className="t-num text-[10px] text-mute">
                  {fmtDuration(t.estimateMin)}
                </span>
                <span className="t-num text-[10px] text-signal-dim">
                  {taskXp(t.estimateMin, t.quadrant)} xp
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => book(t)}
                disabled={syncingId === t.id}
                title={
                  session?.user
                    ? "Book the next free slot and add it to Google Calendar"
                    : "Book the next free slot today"
                }
                className="text-mute transition-colors hover:text-signal disabled:animate-pulse disabled:text-signal"
              >
                <CalendarPlus size={14} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => removeTask(t.id)}
                title="Delete"
                className="text-mute transition-colors hover:text-alarm"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Composer({ onDone }: { onDone: () => void }) {
  const { categories, addTask } = useStore();
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [quadrant, setQuadrant] = useState<Quadrant>("q2");
  const [minutes, setMinutes] = useState(45);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addTask({ title: title.trim(), categoryId, quadrant, estimateMin: minutes });
    setTitle("");
    onDone();
  }

  return (
    <form onSubmit={submit} className="border-b border-line bg-surface-2 p-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        className="w-full bg-bg px-2 py-1.5 text-[13px] placeholder:text-mute"
      />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="px-2 py-1.5 font-mono text-[11px]"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={quadrant}
          onChange={(e) => setQuadrant(e.target.value as Quadrant)}
          className="px-2 py-1.5 font-mono text-[11px]"
        >
          {(Object.keys(QUADRANT_META) as Quadrant[]).map((q) => (
            <option key={q} value={q}>
              {QUADRANT_META[q].key} · {QUADRANT_META[q].name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={5}
          step={5}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="px-2 py-1.5 font-mono text-[11px]"
        />
      </div>
      <button type="submit" className="btn btn-signal mt-2 w-full">
        Add to queue
      </button>
    </form>
  );
}
