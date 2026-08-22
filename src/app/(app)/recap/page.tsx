"use client";

import { useMemo, useState } from "react";
import {
  addWeeks,
  format,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  catColor,
  realityScorePct,
  taskRealityBlocks,
  weekMinutes,
} from "@/lib/derive";
import { weekBounds, weekDays, fmtDuration } from "@/lib/time";
import { xpInRange } from "@/lib/xp";

export default function RecapPage() {
  const { tasks, categories, log, streak, profile, events } = useStore();
  const [offset, setOffset] = useState(0);
  const ref = useMemo(() => addWeeks(new Date(), offset), [offset]);
  const { start, end } = weekBounds(ref, profile.weekStartsOn);

  const doneThisWeek = tasks.filter(
    (t) =>
      t.status === "done" &&
      t.completedAt &&
      isWithinInterval(parseISO(t.completedAt), { start, end }),
  );

  const bankedMin = doneThisWeek.reduce(
    (a, t) => a + (t.actualMin ?? t.estimateMin),
    0,
  );
  /* Every award in the window, not just finished tasks — log entries and
     cleared goals are XP you earned this week too, and counting only tasks
     here would put a different number on this page than on the dashboard. */
  const xp = xpInRange(events, start, end);
  const per = weekMinutes(tasks, ref, profile.weekStartsOn);
  const targetMin = categories.reduce(
    (a, c) => a + c.weeklyTargetHours * 60,
    0,
  );

  /* Task blocks only — a past week's calendar events aren't refetched here,
     for the same reason the stored snapshots don't hold them. */
  const reality = realityScorePct(taskRealityBlocks(tasks, start, end));

  const days = weekDays(ref, profile.weekStartsOn).map((d) => {
    const mins = doneThisWeek
      .filter((t) => t.completedAt && format(parseISO(t.completedAt), "yyyy-MM-dd") === format(d, "yyyy-MM-dd"))
      .reduce((a, t) => a + (t.actualMin ?? t.estimateMin), 0);
    return { d, mins };
  });
  const best = days.reduce((a, b) => (b.mins > a.mins ? b : a), days[0]);
  const peak = Math.max(1, ...days.map((d) => d.mins));

  const entries = log.filter((l) =>
    isWithinInterval(parseISO(l.date), { start, end }),
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1060px] px-12 py-10">
        {/* masthead */}
        <header className="flex items-end justify-between border-b-2 border-text pb-3">
          <div>
            <div className="t-label">Week in review</div>
            <h1 className="t-display mt-1 text-[46px] uppercase">
              {format(start, "d MMM")} — {format(end, "d MMM")}
            </h1>
          </div>
          <div className="flex items-center gap-1 pb-2">
            <button
              onClick={() => setOffset((o) => o - 1)}
              className="btn btn-ghost !px-2"
              aria-label="Previous week"
            >
              <ChevronLeft size={15} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setOffset((o) => o + 1)}
              disabled={offset >= 0}
              className="btn btn-ghost !px-2 disabled:opacity-30"
              aria-label="Next week"
            >
              <ChevronRight size={15} strokeWidth={1.5} />
            </button>
          </div>
        </header>

        {/* the verdict — one opinionated sentence, generated from the numbers */}
        <p className="border-b border-line py-5 text-[16px] leading-relaxed text-text">
          {verdict(bankedMin, targetMin, reality, doneThisWeek.length, entries.length)}
        </p>

        {/* four figures, unequal weight — hours is the headline */}
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-line">
          <Figure
            label="Hours banked"
            value={(bankedMin / 60).toFixed(1)}
            sub={`of ${(targetMin / 60).toFixed(0)}h target`}
            big
            tone="text-cool"
          />
          <Figure label="XP earned" value={String(xp)} tone="text-signal" />
          <Figure label="Tasks cleared" value={String(doneThisWeek.length)} />
          <Figure
            label="Streak"
            value={String(streak.current)}
            sub={`best ${streak.longest}`}
          />
        </div>

        <div className="grid grid-cols-[1.15fr_1fr] gap-10 pt-8">
          {/* category table — a real table, not cards */}
          <section>
            <h2 className="t-label border-b border-line pb-2">
              Where the hours went
            </h2>
            <table className="w-full">
              <tbody>
                {categories.map((c) => {
                  const m = per[c.id] ?? { done: 0, planned: 0 };
                  const target = c.weeklyTargetHours * 60;
                  const delta = m.done - target;
                  return (
                    <tr key={c.id} className="border-b border-line">
                      <td className="py-2.5 pr-2">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-3 w-[3px]"
                            style={{ background: catColor(categories, c.id) }}
                          />
                          <span className="text-[13px]">{c.name}</span>
                        </span>
                      </td>
                      <td className="w-[38%] py-2.5">
                        <div className="relative h-[8px] bg-bg">
                          <div
                            className="absolute inset-y-0 left-0"
                            style={{
                              width: `${Math.min(100, (m.done / Math.max(target, m.done)) * 100)}%`,
                              background: catColor(categories, c.id),
                            }}
                          />
                          <div
                            className="absolute -top-[2px] bottom-[-2px] w-[1px] bg-dim"
                            style={{
                              left: `${(target / Math.max(target, m.done)) * 100}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="t-num w-20 py-2.5 text-right text-[12px]">
                        {(m.done / 60).toFixed(1)}h
                      </td>
                      <td
                        className={`t-num w-16 py-2.5 text-right text-[11px] ${
                          delta >= 0 ? "text-cool" : "text-mute"
                        }`}
                      >
                        {delta >= 0 ? "+" : "−"}
                        {fmtDuration(Math.abs(delta))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <div className="space-y-8">

            {/* day shape */}
            <section>
              <h2 className="t-label border-b border-line pb-2">Day shape</h2>
              <div className="flex items-end gap-1.5 pt-4">
                {days.map(({ d, mins }) => (
                  <div
                    key={+d}
                    className="flex flex-1 flex-col items-center gap-1.5"
                    title={`${format(d, "EEEE")} · ${fmtDuration(mins)}`}
                  >
                    <span className="t-num text-[9px] text-mute">
                      {mins ? (mins / 60).toFixed(1) : ""}
                    </span>
                    <div
                      className={`w-full ${mins ? "bg-cool-dim" : "bg-line"}`}
                      style={{
                        height: `${Math.max(2, Math.round((mins / peak) * 72))}px`,
                      }}
                    />
                    <span className="t-label !text-[9px]">
                      {format(d, "EEEEE")}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 font-mono text-[10px] text-mute">
                best day {format(best.d, "EEEE").toLowerCase()} ·{" "}
                {fmtDuration(best.mins)}
              </p>
            </section>

            <section>
              <h2 className="t-label border-b border-line pb-2">Log</h2>
              <p className="t-num pt-3 text-[15px]">
                {entries.length}
                <span className="ml-2 font-sans text-[12px] text-dim">
                  {entries.length === 1 ? "entry" : "entries"} written
                </span>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  sub,
  big = false,
  tone = "text-text",
}: {
  label: string;
  value: string;
  sub?: string;
  big?: boolean;
  tone?: string;
}) {
  return (
    <div className="border-l border-line py-6 pl-5 first:border-l-0 first:pl-0">
      <div className="t-label">{label}</div>
      <div
        className={`t-num mt-2 font-bold leading-none ${tone} ${
          big ? "text-[64px]" : "text-[38px]"
        }`}
      >
        {value}
      </div>
      {sub && <div className="t-num mt-2 text-[11px] text-mute">{sub}</div>}
    </div>
  );
}

/**
 * One sentence, chosen by the numbers. Never congratulatory by default.
 *
 * Reality is the more interesting half of the pair: hours tell you how much
 * you did, reality tells you whether it was the thing you said you'd do, and
 * the gap between them is where the useful sentence usually is.
 */
function verdict(
  banked: number,
  target: number,
  reality: number,
  cleared: number,
  entries: number,
): string {
  const pct = target ? banked / target : 0;
  if (cleared === 0)
    return "Nothing cleared this week. That happens — the only thing worth doing now is booking one block for tomorrow and letting the streak restart from there.";
  if (pct >= 0.95 && reality >= 85)
    return `You hit your hours and kept ${reality}% of what you actually planned. That's the shape you want; the hard part is doing it again when nothing is on fire.`;
  if (pct >= 0.95 && reality < 60)
    return `The hours are there, but only ${reality}% of them went to what you'd actually booked. Plenty of work, mostly unplanned — worth asking whether the plan is wrong or the week keeps hijacking it.`;
  if (reality >= 85)
    return `Short on hours at ${Math.round(pct * 100)}% of target, but you kept ${reality}% of what you booked. A small plan honoured beats a big one abandoned — the fix is to book more, not to try harder.`;
  if (reality > 0 && reality < 50)
    return `${Math.round(pct * 100)}% of target and only ${reality}% of your plan survived contact with the week. Either the blocks are too big or they're in the wrong place; shrink one and move it earlier before next Monday.`;
  if (entries >= 5)
    return `${Math.round(pct * 100)}% of target with ${entries} log entries — you kept the record even when the hours didn't come. Read them back before you plan next week; the reason is usually in there.`;
  return `${Math.round(pct * 100)}% of target, ${cleared} tasks cleared, ${reality}% of the plan kept. Middling week. Pick the one category that fell furthest short and book it before anything else next Monday.`;
}
