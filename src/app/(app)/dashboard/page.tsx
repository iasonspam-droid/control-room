"use client";

import { useEffect, useMemo, useState } from "react";
import { endOfDay, endOfWeek, format, startOfDay, startOfWeek } from "date-fns";
import { useSession } from "next-auth/react";
import { Check, Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  catColor,
  completedEventMinutes,
  eventRealityBlocks,
  minutesByCategory,
  productivityPct,
  realityScorePct,
  taskRealityBlocks,
  tasksOnDay,
  unscheduled,
} from "@/lib/derive";
import { dayRange, fmtDuration, fmtClock, weekRange } from "@/lib/time";
import { taskXp, xpInRange } from "@/lib/xp";
import { useGoogleCalendarEvents } from "@/lib/use-google-calendar-events";
import { Empty, Panel } from "@/components/ui/Panel";

interface BestRecords {
  bestDayXp: number;
  bestWeekXp: number;
  bestDayReality: number;
  bestWeekReality: number;
  bestDayProductivity: number;
}

export default function DashboardPage() {
  const { tasks, categories, profile, events } = useStore();
  const { data: session } = useSession();
  const [now, setNow] = useState(() => new Date());
  const [best, setBest] = useState<BestRecords | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  /* Personal bests live in the snapshot tables, not the store — they're the
     one figure on this page that outlives the current week. */
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    fetch("/api/snapshots?range=day&limit=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.best) setBest(d.best as BestRecords);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: profile.weekStartsOn });
  const weekEnd = endOfWeek(now, { weekStartsOn: profile.weekStartsOn });

  const rules = profile.calendarRules ?? [];
  const completedEvents = profile.completedEventIds ?? [];
  const excludeIds = useMemo(
    () => tasks.filter((t) => t.calendarEventId).map((t) => t.calendarEventId!),
    [tasks],
  );
  const day = useMemo(() => dayRange(now), [now]);
  const week = useMemo(
    () => weekRange(now, profile.weekStartsOn),
    [now, profile.weekStartsOn],
  );
  const { events: dayEvents } = useGoogleCalendarEvents(
    day.timeMin,
    day.timeMax,
    excludeIds,
  );
  const { events: weekEvents } = useGoogleCalendarEvents(
    week.timeMin,
    week.timeMax,
    excludeIds,
  );

  /* ── today ────────────────────────────────────────────────── */
  const xpToday = xpInRange(events, dayStart, dayEnd);
  const realityToday = realityScorePct([
    ...taskRealityBlocks(tasks, dayStart, dayEnd),
    ...eventRealityBlocks(dayEvents, rules, dayStart, dayEnd, completedEvents),
  ]);
  const productivityToday = productivityPct(
    tasks,
    profile,
    dayStart,
    dayEnd,
    1,
    completedEventMinutes(dayEvents, dayStart, dayEnd, completedEvents),
  );

  /* ── this week ────────────────────────────────────────────── */
  const xpWeek = xpInRange(events, weekStart, weekEnd);
  const realityWeek = realityScorePct([
    ...taskRealityBlocks(tasks, weekStart, weekEnd),
    ...eventRealityBlocks(weekEvents, rules, weekStart, weekEnd, completedEvents),
  ]);
  const productivityWeek = productivityPct(
    tasks,
    profile,
    weekStart,
    weekEnd,
    7,
    completedEventMinutes(weekEvents, weekStart, weekEnd, completedEvents),
  );

  const todayMins = minutesByCategory(tasks, dayStart, dayEnd);
  const weekMins = minutesByCategory(tasks, weekStart, weekEnd);

  const upcoming = tasksOnDay(tasks, now).filter((t) => t.status !== "done");

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1100px] px-5 py-5">
        <header className="flex items-end justify-between border-b border-line pb-3">
          <div>
            <h1 className="t-display text-[30px] uppercase">Dashboard</h1>
            <p className="mt-1 text-[12px] text-dim">
              {format(now, "EEEE d MMMM")}
            </p>
          </div>
          <p className="t-label max-w-sm text-right leading-relaxed">
            reality = the plan you kept
            <br />
            productivity = the day you used
          </p>
        </header>

        {/* ── today ── */}
        <section className="mt-5">
          <h2 className="t-label mb-2">Today</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="XP"
              value={String(xpToday)}
              sub={best ? `best ${best.bestDayXp}` : undefined}
              tone="text-signal"
            />
            <Stat
              label="Reality score"
              value={`${realityToday}%`}
              sub={best ? `best ${best.bestDayReality}%` : undefined}
              tone={realityToday >= 80 ? "text-cool" : "text-text"}
            />
            <Stat
              label="Productivity"
              value={`${productivityToday}%`}
              sub={best ? `best ${best.bestDayProductivity}%` : undefined}
            />
            <Stat
              label="Banked"
              value={fmtDuration(
                Object.values(todayMins).reduce((a, b) => a + b, 0),
              )}
              sub={`${upcoming.length} still booked`}
              tone="text-cool"
            />
          </div>
        </section>

        {/* ── this week ── */}
        <section className="mt-5">
          <h2 className="t-label mb-2">This week</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="XP"
              value={String(xpWeek)}
              sub={best ? `best ${best.bestWeekXp}` : undefined}
              tone="text-signal"
            />
            <Stat
              label="Reality score"
              value={`${realityWeek}%`}
              sub={best ? `best ${best.bestWeekReality}%` : undefined}
              tone={realityWeek >= 80 ? "text-cool" : "text-text"}
            />
            <Stat label="Productivity" value={`${productivityWeek}%`} />
            <Stat
              label="Banked"
              value={fmtDuration(
                Object.values(weekMins).reduce((a, b) => a + b, 0),
              )}
              tone="text-cool"
            />
          </div>
        </section>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {/* ── to-do ── */}
          <TodoPanel />

          {/* ── what's still booked ── */}
          <Panel label="Still booked today">
            {upcoming.length === 0 ? (
              <Empty>nothing left on the clock today</Empty>
            ) : (
              <ul>
                {upcoming.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 border-b border-line py-2 last:border-b-0"
                  >
                    <span
                      className="h-4 w-[3px] shrink-0"
                      style={{ background: catColor(categories, t.categoryId) }}
                    />
                    <span className="t-num w-12 shrink-0 text-[11px] text-mute">
                      {fmtClock(t.scheduledStart!)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {t.title}
                    </span>
                    <span className="t-num shrink-0 text-[10px] text-dim">
                      {fmtDuration(t.estimateMin)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {!session?.user && (
          <p className="mt-4 max-w-lg text-[11px] leading-relaxed text-mute">
            Signed out, so records aren&rsquo;t being kept — today and this week
            still score, but nothing is filed away when the day ends. Sign in
            from Settings to start a history.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The to-do list is the task queue, not a second parallel list.
 *
 * Anything you tick here is a real task: it pays XP, it lands in the day's
 * totals, and the same item shows up on Today. A separate scratch checklist
 * would be easier to jot into and would quietly become the place real work
 * went to die, invisible to every number on this page.
 */
function TodoPanel() {
  const { tasks, categories, addTask, completeTask, removeTask } = useStore();
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [minutes, setMinutes] = useState(30);

  const todo = unscheduled(tasks);
  const category = categoryId || categories[0]?.id || "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !category) return;
    addTask({ title: title.trim(), categoryId: category, estimateMin: minutes });
    setTitle("");
  }

  return (
    <Panel label={`To-do · ${todo.length}`}>
      {todo.length === 0 ? (
        <Empty>nothing queued — add something below</Empty>
      ) : (
        <ul className="max-h-[260px] overflow-y-auto">
          {todo.map((t) => (
            <li
              key={t.id}
              className="group flex items-start gap-2 border-b border-line py-2 last:border-b-0"
            >
              <button
                onClick={() => completeTask(t.id)}
                aria-label={`Complete ${t.title}`}
                className="mt-[2px] grid h-[15px] w-[15px] shrink-0 place-items-center border border-line-hot transition-colors hover:border-signal hover:bg-signal-wash"
              >
                <Check size={11} strokeWidth={3} className="opacity-0" />
              </button>
              <span
                className="mt-[4px] h-3 w-[3px] shrink-0"
                style={{ background: catColor(categories, t.categoryId) }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug">{t.title}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="t-num text-[10px] text-mute">
                    {fmtDuration(t.estimateMin)}
                  </span>
                  <span className="t-num text-[10px] text-signal-dim">
                    {taskXp(t.estimateMin)} xp
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeTask(t.id)}
                aria-label={`Delete ${t.title}`}
                className="mt-[2px] shrink-0 text-mute opacity-0 transition-opacity hover:text-alarm group-hover:opacity-100"
              >
                <X size={13} strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-3 border-t border-line pt-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="w-full bg-bg px-2 py-1.5 text-[13px] placeholder:text-mute"
        />
        <div className="mt-2 flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategoryId(e.target.value)}
            className="min-w-0 flex-1 px-2 py-1.5 font-mono text-[11px]"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={5}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-20 px-2 py-1.5 text-right font-mono text-[11px]"
          />
          <button type="submit" className="btn btn-signal flex items-center gap-1.5">
            <Plus size={12} strokeWidth={2} /> Add
          </button>
        </div>
      </form>
    </Panel>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "text-text",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="panel px-4 py-3">
      <div className="t-label">{label}</div>
      <div className={`t-num mt-2 text-[32px] font-bold leading-none ${tone}`}>
        {value}
      </div>
      <div className="t-num mt-1.5 h-[12px] text-[10px] text-mute">
        {sub ?? ""}
      </div>
    </div>
  );
}
