"use client";

import { differenceInCalendarDays, parseISO } from "date-fns";
import { Minus, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { catColor } from "@/lib/derive";
import { Ring } from "@/components/ui/Ring";
import { Empty } from "@/components/ui/Panel";

export function Goals({ compact = false }: { compact?: boolean }) {
  const { goals, categories, bumpGoal } = useStore();

  if (goals.length === 0) return <Empty>no one-off goals set</Empty>;

  return (
    <ul>
      {goals.map((g) => {
        const pct = g.target ? g.current / g.target : 0;
        const days = g.due
          ? differenceInCalendarDays(parseISO(g.due), new Date())
          : null;
        const color = catColor(categories, g.categoryId);
        return (
          <li
            key={g.id}
            className="group flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
          >
            <Ring size={compact ? 34 : 40} stroke={4} done={pct} color={color}>
              <span className="t-num text-[9px] font-semibold text-dim">
                {Math.round(pct * 100)}
              </span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] leading-snug">{g.title}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="t-num text-[10px] text-cool">
                  {g.current}/{g.target}
                </span>
                <span className="t-label !text-[9px]">{g.unit}</span>
                {days !== null && (
                  <span
                    className={`t-num text-[10px] ${
                      days < 7 ? "text-signal" : "text-mute"
                    }`}
                  >
                    {days}d left
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => bumpGoal(g.id, -1)}
                className="grid h-5 w-5 place-items-center border border-line text-mute hover:border-dim hover:text-text"
                aria-label="Decrement"
              >
                <Minus size={11} strokeWidth={2} />
              </button>
              <button
                onClick={() => bumpGoal(g.id, 1)}
                className="grid h-5 w-5 place-items-center border border-line-hot text-dim hover:border-signal hover:bg-signal-wash hover:text-signal"
                aria-label="Increment"
              >
                <Plus size={11} strokeWidth={2} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
