"use client";

import { useEffect, useState } from "react";
import { endOfDay, format, isAfter, parseISO, startOfDay } from "date-fns";
import { Flame, Snowflake } from "lucide-react";
import { useStore } from "@/lib/store";
import { catColor, weekTotals } from "@/lib/derive";
import { fmtClock } from "@/lib/time";
import { xpInRange } from "@/lib/xp";

function Cell({
  label,
  children,
  grow = false,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <div
      className={`flex flex-col justify-center border-r border-line px-4 py-2 ${
        grow ? "min-w-0 flex-1" : ""
      }`}
    >
      <div className="t-label">{label}</div>
      <div className="mt-1 min-w-0">{children}</div>
    </div>
  );
}

export function Readout() {
  const { tasks, categories, streak, profile, events } = useStore();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { done, planned, target } = weekTotals(
    tasks,
    categories,
    now,
    profile.weekStartsOn,
  );
  const pct = target ? Math.round((done / target) * 100) : 0;

  /* Every award, not just finished tasks — a log entry and a cleared goal are
     XP you earned today too, and the old task-only sum quietly left them out. */
  const xpToday = xpInRange(events, startOfDay(now), endOfDay(now));

  const next = tasks
    .filter(
      (t) =>
        t.status === "open" &&
        t.scheduledStart &&
        isAfter(parseISO(t.scheduledStart), now),
    )
    .sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!))[0];

  return (
    <header className="flex shrink-0 items-stretch border-b border-line bg-surface">
      <div className="flex flex-col justify-center border-r border-line px-4 py-2">
        <div className="t-label flex items-center gap-1.5">
          <span className="live-dot inline-block h-[5px] w-[5px] bg-signal" />
          {format(now, "EEEE").toUpperCase()}
        </div>
        <div className="t-num mt-1 text-[15px] font-semibold leading-none">
          {format(now, "d MMM").toLowerCase()}
          <span className="ml-2 text-mute">{format(now, "HH:mm")}</span>
        </div>
      </div>

      <Cell label="Week load">
        <div className="flex items-baseline gap-1.5">
          <span className="t-num text-[15px] font-semibold leading-none text-cool">
            {(done / 60).toFixed(1)}
          </span>
          <span className="t-num text-[11px] text-mute">
            / {(target / 60).toFixed(0)}h
          </span>
          <span className="t-num text-[11px] text-signal-dim">
            +{(planned / 60).toFixed(1)} booked
          </span>
        </div>
        <div className="mt-1.5 flex h-[3px] w-40 bg-line">
          <div className="h-full bg-cool" style={{ width: `${Math.min(100, pct)}%` }} />
          <div
            className="h-full bg-signal-dim"
            style={{
              width: `${Math.min(100 - Math.min(100, pct), (planned / target) * 100)}%`,
            }}
          />
        </div>
      </Cell>

      <Cell label="XP today">
        <span className="t-num text-[15px] font-semibold leading-none text-signal">
          {xpToday}
        </span>
      </Cell>

      <Cell label="Streak">
        <div className="flex items-center gap-2">
          <Flame size={14} strokeWidth={1.5} className="text-signal" />
          <span className="t-num text-[15px] font-semibold leading-none">
            {streak.current}
          </span>
          <span
            className="chip flex items-center gap-1 border-line text-mute"
            title={`${streak.freezesPerWeek - streak.freezesUsed} grace day(s) left this week`}
          >
            <Snowflake size={9} strokeWidth={2} />
            {streak.freezesPerWeek - streak.freezesUsed}
          </span>
        </div>
      </Cell>

      <Cell label="Next block" grow>
        {next ? (
          <div className="flex items-center gap-2 truncate">
            <span
              className="h-3 w-[3px] shrink-0"
              style={{ background: catColor(categories, next.categoryId) }}
            />
            <span className="t-num text-[13px] text-text">
              {fmtClock(next.scheduledStart!)}
            </span>
            <span className="truncate text-[13px] text-dim">{next.title}</span>
          </div>
        ) : (
          <span className="font-mono text-[11px] text-mute">
            nothing booked — the week is yours
          </span>
        )}
      </Cell>
    </header>
  );
}
