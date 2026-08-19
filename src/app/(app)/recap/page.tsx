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
import { catColor, weekMinutes } from "@/lib/derive";
import { weekBounds, weekDays, fmtDuration } from "@/lib/time";
import { QUADRANT_META, taskXp } from "@/lib/xp";
import type { Quadrant } from "@/lib/types";

const QS: Quadrant[] = ["q1", "q2", "q3", "q4"];

export default function RecapPage() {
  const { tasks, categories, log, streak, profile } = useStore();
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
  const xp = doneThisWeek.reduce(
    (a, t) => a + taskXp(t.actualMin ?? t.estimateMin, t.quadrant),
    0,
  );
  const per = weekMinutes(tasks, ref, profile.weekStartsOn);
  const targetMin = categories.reduce(
    (a, c) => a + c.weeklyTargetHours * 60,
    0,
  );

  const byQuadrant = QS.map((q) => {
    const mins = doneThisWeek
      .filter((t) => t.quadrant === q)
      .reduce((a, t) => a + (t.actualMin ?? t.estimateMin), 0);
    return { q, mins, share: bankedMin ? mins / bankedMin : 0 };
  });
  const q2Share = byQuadrant.find((b) => b.q === "q2")!.share;

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
          {verdict(bankedMin, targetMin, q2Share, doneThisWeek.length, entries.length)}
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
            {/* quadrant split */}
            <section>
              <h2 className="t-label border-b border-line pb-2">
                Quadrant split
              </h2>
              <div className="flex h-[10px] w-full">
                {byQuadrant.map(({ q, share }) => (
                  <div
                    key={q}
                    className={
                      q === "q2"
                        ? "bg-signal"
                        : q === "q1"
                          ? "bg-signal-dim"
                          : q === "q3"
                            ? "bg-line-hot"
                            : "bg-line"
                    }
                    style={{ width: `${share * 100}%` }}
                    title={`${QUADRANT_META[q].key} ${Math.round(share * 100)}%`}
                  />
                ))}
              </div>
              <ul className="mt-3 space-y-1.5">
                {byQuadrant.map(({ q, mins, share }) => (
                  <li key={q} className="flex items-baseline gap-2">
                    <span
                      className={`t-num w-6 text-[11px] ${
                        q === "q2" ? "text-signal" : "text-mute"
                      }`}
                    >
                      {QUADRANT_META[q].key}
                    </span>
                    <span className="flex-1 text-[12px] text-dim">
                      {QUADRANT_META[q].blurb}
                    </span>
                    <span className="t-num text-[11px] text-mute">
                      {fmtDuration(mins)}
                    </span>
                    <span className="t-num w-9 text-right text-[11px]">
                      {Math.round(share * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>

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

/** One sentence, chosen by the numbers. Never congratulatory by default. */
function verdict(
  banked: number,
  target: number,
  q2Share: number,
  cleared: number,
  entries: number,
): string {
  const pct = target ? banked / target : 0;
  if (cleared === 0)
    return "Nothing cleared this week. That happens — the only thing worth doing now is booking one Q2 block for tomorrow and letting the streak restart from there.";
  if (pct >= 0.95 && q2Share >= 0.4)
    return `You hit your hours and spent ${Math.round(q2Share * 100)}% of them on work that wasn't due yet. That's the shape you want; the hard part is doing it again when nothing is on fire.`;
  if (pct >= 0.95)
    return `Hours are there, but only ${Math.round(q2Share * 100)}% went to Q2 — the week ran on urgency. Try booking the important-not-urgent block first next week and letting Q1 fill in around it.`;
  if (q2Share >= 0.5)
    return `Short on hours at ${Math.round(pct * 100)}% of target, but the hours you did put in were the right ones — half of them Q2. Quality over volume is a fine trade for one week, not for three.`;
  if (entries >= 5)
    return `${Math.round(pct * 100)}% of target with ${entries} log entries — you kept the record even when the hours didn't come. Read them back before you plan next week; the reason is usually in there.`;
  return `${Math.round(pct * 100)}% of target, ${cleared} tasks cleared, ${Math.round(q2Share * 100)}% of it Q2. Middling week. Pick the one category that fell furthest short and book it before anything else next Monday.`;
}
