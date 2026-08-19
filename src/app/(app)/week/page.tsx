"use client";

import { useMemo, useState } from "react";
import {
  addWeeks,
  differenceInMinutes,
  format,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { catColor, tasksOnDay, weekMinutes } from "@/lib/derive";
import { weekDays } from "@/lib/time";

export default function WeekPage() {
  const { tasks, categories, profile, completeTask } = useStore();
  const [offset, setOffset] = useState(0);
  const ref = useMemo(() => addWeeks(new Date(), offset), [offset]);
  const days = weekDays(ref, profile.weekStartsOn);
  const today = new Date();

  const { dayStartHour: h0, dayEndHour: h1 } = profile;
  const hours = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i);
  const per = weekMinutes(tasks, ref, profile.weekStartsOn);
  const pct = (i: number) => (i / (h1 - h0)) * 100;

  return (
    <div className="flex h-full flex-col">
      {/* ── day header: dense, no cards, one hairline per column ── */}
      <div className="flex shrink-0 items-stretch border-b border-line bg-surface">
        <div className="flex w-14 shrink-0 items-center justify-between border-r border-line px-1">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="text-mute hover:text-text"
            aria-label="Previous week"
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="text-mute hover:text-text"
            aria-label="Next week"
          >
            <ChevronRight size={14} strokeWidth={1.5} />
          </button>
        </div>
        {days.map((d) => {
          const list = tasksOnDay(tasks, d);
          const doneMin = list
            .filter((t) => t.status === "done")
            .reduce((a, t) => a + (t.actualMin ?? t.estimateMin), 0);
          const openMin = list
            .filter((t) => t.status !== "done")
            .reduce((a, t) => a + t.estimateMin, 0);
          const isToday = isSameDay(d, today);
          return (
            <div
              key={+d}
              className={`min-w-0 flex-1 border-r border-line px-2 py-2 last:border-r-0 ${
                isToday ? "bg-signal-wash" : ""
              }`}
            >
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`t-label ${isToday ? "!text-signal" : ""}`}
                >
                  {format(d, "EEE")}
                </span>
                <span
                  className={`t-num text-[15px] font-semibold leading-none ${
                    isToday ? "text-text" : "text-dim"
                  }`}
                >
                  {format(d, "d")}
                </span>
              </div>
              <div className="mt-1.5 flex h-[3px] w-full bg-line">
                <div
                  className="h-full bg-cool"
                  style={{ width: `${Math.min(100, (doneMin / 480) * 100)}%` }}
                />
                <div
                  className="h-full bg-signal-dim"
                  style={{ width: `${Math.min(100, (openMin / 480) * 100)}%` }}
                />
              </div>
              <div className="t-num mt-1 text-[10px] text-mute">
                {(doneMin / 60).toFixed(1)}
                <span className="text-line-hot"> / </span>
                {((doneMin + openMin) / 60).toFixed(1)}h
              </div>
            </div>
          );
        })}
      </div>

      {/* ── the grid: proportional, so it fills the pane exactly ── */}
      <div className="relative flex min-h-0 flex-1 pt-2">
        <div className="relative w-14 shrink-0 border-r border-line">
          {hours.map((h, i) => (
            <span
              key={h}
              className="t-num absolute right-2 text-[10px] text-mute"
              style={{ top: `calc(${pct(i)}% - 6px)` }}
            >
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>

        {days.map((d) => (
          <div
            key={+d}
            className="relative min-w-0 flex-1 border-r border-line last:border-r-0"
          >
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-line"
                style={{ top: `${pct(i)}%` }}
              />
            ))}
            {isSameDay(d, today) && <NowLine h0={h0} h1={h1} />}
            {tasksOnDay(tasks, d).map((t) => {
              const start = parseISO(t.scheduledStart!);
              const span = (h1 - h0) * 60;
              const top =
                ((differenceInMinutes(start, startOfDay(start)) - h0 * 60) /
                  span) *
                100;
              const height =
                (differenceInMinutes(parseISO(t.scheduledEnd!), start) / span) *
                100;
              const done = t.status === "done";
              return (
                <button
                  key={t.id}
                  onClick={() => !done && completeTask(t.id)}
                  title={`${t.title} — click to complete`}
                  className={`absolute left-[2px] right-[2px] flex overflow-hidden border text-left transition-colors ${
                    done
                      ? "border-line bg-cool-wash"
                      : "border-line-hot bg-surface-2 hover:border-signal"
                  }`}
                  style={{ top: `${top}%`, height: `calc(${height}% - 2px)` }}
                >
                  <span
                    className="w-[2px] shrink-0"
                    style={{
                      background: done
                        ? "var(--color-cool-dim)"
                        : catColor(categories, t.categoryId),
                    }}
                  />
                  <span
                    className={`min-w-0 flex-1 px-1.5 py-0.5 text-[10px] leading-[1.25] ${
                      done
                        ? "text-mute line-through decoration-line-hot"
                        : "text-dim"
                    }`}
                  >
                    <span className="line-clamp-3">{t.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── category load: horizontal bars with a target notch ── */}
      <div className="shrink-0 border-t border-line bg-surface">
        <div className="flex items-center justify-between px-4 pt-2.5">
          <h2 className="t-label">Load against target</h2>
          <span className="t-label">
            <span className="text-cool">banked</span>
            <span className="mx-1 text-line-hot">/</span>
            <span className="text-signal-dim">booked</span>
            <span className="mx-1 text-line-hot">/</span>
            <span className="text-dim">target notch</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-4 pb-3 pt-2 md:grid-cols-3 2xl:grid-cols-6">
          {categories.map((c) => {
            const m = per[c.id] ?? { done: 0, planned: 0 };
            const target = c.weeklyTargetHours * 60;
            const scale = Math.max(target, m.done + m.planned) * 1.05;
            return (
              <div key={c.id} className="flex items-center gap-3">
                <span
                  className="w-14 shrink-0 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-dim"
                  title={c.name}
                >
                  {c.short}
                </span>
                <div className="relative h-[10px] flex-1 bg-bg">
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${(m.done / scale) * 100}%`,
                      background: catColor(categories, c.id),
                    }}
                  />
                  <div
                    className="absolute inset-y-0 opacity-40"
                    style={{
                      left: `${(m.done / scale) * 100}%`,
                      width: `${(m.planned / scale) * 100}%`,
                      background: catColor(categories, c.id),
                    }}
                  />
                  <div
                    className="absolute -top-[2px] bottom-[-2px] w-[1px] bg-text"
                    style={{ left: `${(target / scale) * 100}%` }}
                  />
                </div>
                <span className="t-num w-16 shrink-0 text-right text-[10px] text-mute">
                  {(m.done / 60).toFixed(1)}/{c.weeklyTargetHours}h
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NowLine({ h0, h1 }: { h0: number; h1: number }) {
  const now = new Date();
  const span = (h1 - h0) * 60;
  const top =
    ((differenceInMinutes(now, startOfDay(now)) - h0 * 60) / span) * 100;
  if (top < 0 || top > 100) return null;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20 h-[1px] bg-signal"
      style={{ top: `${top}%` }}
    />
  );
}
