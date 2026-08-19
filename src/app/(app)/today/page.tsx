"use client";

import { format } from "date-fns";
import { useStore } from "@/lib/store";
import { catColor, tasksOnDay, weekMinutes } from "@/lib/derive";
import { fmtDuration } from "@/lib/time";
import { taskXp } from "@/lib/xp";
import { Timeline } from "@/components/today/Timeline";
import { Queue } from "@/components/today/Queue";
import { Goals } from "@/components/goals/Goals";
import { Ring } from "@/components/ui/Ring";

export default function TodayPage() {
  const { tasks, categories, profile } = useStore();
  const day = new Date();

  const todays = tasksOnDay(tasks, day);
  const doneMin = todays
    .filter((t) => t.status === "done")
    .reduce((a, t) => a + (t.actualMin ?? t.estimateMin), 0);
  const plannedMin = todays
    .filter((t) => t.status !== "done")
    .reduce((a, t) => a + t.estimateMin, 0);
  const totalMin = doneMin + plannedMin;

  const per = weekMinutes(tasks, day, profile.weekStartsOn);

  return (
    /* 62 / 38 — the timeline is the subject, everything else reports on it. */
    <div className="grid h-full grid-cols-[minmax(0,1.62fr)_minmax(320px,1fr)]">
      <section className="flex min-h-0 flex-col border-r border-line">
        <div className="flex shrink-0 items-end justify-between border-b border-line px-5 py-3">
          <div>
            <h1 className="t-display text-[30px] uppercase">
              {format(day, "EEEE")}
            </h1>
            <p className="t-label mt-1">
              {todays.filter((t) => t.status === "done").length} of{" "}
              {todays.length} blocks cleared
            </p>
          </div>
          <div className="flex items-center gap-5">
            <Readouts
              items={[
                ["banked", fmtDuration(doneMin), "text-cool"],
                ["booked", fmtDuration(plannedMin), "text-signal-dim"],
                ["on deck", String(todays.filter((t) => t.status !== "done").length), "text-text"],
              ]}
            />
            <Ring
              size={54}
              stroke={5}
              done={totalMin ? doneMin / totalMin : 0}
              planned={totalMin ? plannedMin / totalMin : 0}
            >
              <span className="t-num text-[13px] font-bold leading-none">
                {totalMin ? Math.round((doneMin / totalMin) * 100) : 0}
              </span>
            </Ring>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <Timeline day={day} />
        </div>
      </section>

      <aside className="flex min-h-0 flex-col overflow-y-auto bg-surface/40">
        <div className="shrink-0 border-b border-line">
          <h2 className="t-label px-3 pb-2 pt-3">Week by category</h2>
          <div className="grid grid-cols-3 gap-x-2 gap-y-3 px-3 pb-3">
            {categories.map((c) => {
              const m = per[c.id] ?? { done: 0, planned: 0 };
              const target = c.weeklyTargetHours * 60;
              return (
                <div key={c.id} className="flex flex-col items-center gap-1.5">
                  <Ring
                    size={46}
                    stroke={4}
                    done={m.done / target}
                    planned={m.planned / target}
                    color={catColor(categories, c.id)}
                  >
                    <span className="t-num text-[10px] font-semibold">
                      {(m.done / 60).toFixed(1)}
                    </span>
                  </Ring>
                  <span
                    className="w-full truncate text-center font-mono text-[9px] uppercase tracking-[0.08em] text-mute"
                    title={c.name}
                  >
                    {c.short}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 shrink-0 border-b border-line">
          <h2 className="t-label px-3 pb-1 pt-3">Goals</h2>
          <Goals compact />
        </div>

        <div className="min-h-0 flex-1">
          <Queue day={day} />
        </div>

        <div className="shrink-0 border-t border-line">
          <div className="flex items-center justify-between px-3 py-2">
            <h2 className="t-label">Banked today</h2>
            <span className="t-num text-[11px] text-cool">
              {fmtDuration(doneMin)}
            </span>
          </div>
          <ul className="pb-2">
            {todays
              .filter((t) => t.status === "done")
              .map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2 px-3 py-1"
                >
                  <span
                    className="h-2.5 w-[3px] shrink-0"
                    style={{ background: catColor(categories, t.categoryId) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-dim">
                    {t.title}
                  </span>
                  <span className="t-num shrink-0 text-[10px] text-cool">
                    +{taskXp(t.actualMin ?? t.estimateMin, t.quadrant)}
                  </span>
                </li>
              ))}
            {doneMin === 0 && (
              <li className="px-3 pb-1 font-mono text-[10px] text-mute">
                nothing yet today
              </li>
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Readouts({ items }: { items: [string, string, string][] }) {
  return (
    <div className="flex items-stretch">
      {items.map(([label, value, tone]) => (
        <div key={label} className="border-l border-line px-4 first:border-l-0 first:pl-0">
          <div className="t-label">{label}</div>
          <div className={`t-num mt-1 text-[17px] font-semibold leading-none ${tone}`}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
