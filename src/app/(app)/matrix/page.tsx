"use client";

import { useState } from "react";
import { Check, GripVertical } from "lucide-react";
import { useStore } from "@/lib/store";
import { catColor } from "@/lib/derive";
import { fmtDuration } from "@/lib/time";
import { QUADRANT_META, QUADRANT_WEIGHT, taskXp } from "@/lib/xp";
import type { Quadrant, Task } from "@/lib/types";

const ORDER: Quadrant[] = ["q1", "q2", "q3", "q4"];

export default function MatrixPage() {
  const { tasks, categories, setQuadrant, completeTask } = useStore();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Quadrant | null>(null);

  const open = tasks.filter((t) => t.status === "open");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-end justify-between border-b border-line px-5 py-3">
        <div>
          <h1 className="t-display text-[30px] uppercase">Matrix</h1>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-dim">
            Q2 pays <span className="t-num text-signal">1.5×</span> — more than
            the fires in Q1. That is deliberate: the urgent stuff already
            rewards itself with relief, so the score is the only lever that can
            bribe you toward the work that compounds.
          </p>
        </div>
        <div className="flex items-stretch">
          {ORDER.map((q) => (
            <div key={q} className="border-l border-line px-4 first:border-l-0">
              <div className="t-label">{QUADRANT_META[q].key} rate</div>
              <div
                className={`t-num mt-1 text-[15px] font-semibold leading-none ${
                  q === "q2" ? "text-signal" : "text-dim"
                }`}
              >
                {QUADRANT_WEIGHT[q].toFixed(1)}×
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2">
        {ORDER.map((q) => {
          const list = open.filter((t) => t.quadrant === q);
          const mins = list.reduce((a, t) => a + t.estimateMin, 0);
          const hot = q === "q1";
          const isOver = over === q;
          return (
            <section
              key={q}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(q);
              }}
              onDragLeave={() => setOver((o) => (o === q ? null : o))}
              onDrop={() => {
                if (dragging) setQuadrant(dragging, q);
                setDragging(null);
                setOver(null);
              }}
              className={`flex min-h-0 flex-col border-b border-r border-line transition-colors ${
                isOver ? "bg-signal-wash" : ""
              } ${hot ? "border-l-2 border-l-signal" : ""}`}
            >
              <header className="flex shrink-0 items-baseline gap-2 border-b border-line px-4 py-2.5">
                <span
                  className={`t-num text-[13px] font-bold ${
                    hot ? "text-signal" : "text-dim"
                  }`}
                >
                  {QUADRANT_META[q].key}
                </span>
                <h2 className="t-display text-[15px] uppercase">
                  {QUADRANT_META[q].name}
                </h2>
                <span className="t-label flex-1">{QUADRANT_META[q].blurb}</span>
                <span className="t-num text-[11px] text-mute">
                  {list.length} · {fmtDuration(mins)}
                </span>
              </header>

              <ul className="min-h-0 flex-1 overflow-y-auto">
                {list.length === 0 && (
                  <li className="px-4 py-6 text-center font-mono text-[10px] text-mute">
                    {q === "q4"
                      ? "nothing here. keep it that way."
                      : "empty — drag something in"}
                  </li>
                )}
                {list.map((t) => (
                  <Row
                    key={t.id}
                    task={t}
                    color={catColor(categories, t.categoryId)}
                    dragging={dragging === t.id}
                    onDragStart={() => setDragging(t.id)}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onComplete={() => completeTask(t.id)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Row({
  task,
  color,
  dragging,
  onDragStart,
  onDragEnd,
  onComplete,
}: {
  task: Task;
  color: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onComplete: () => void;
}) {
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group flex cursor-grab items-start gap-2 border-b border-line px-4 py-2 transition-colors hover:bg-surface-2 active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <GripVertical
        size={13}
        strokeWidth={1.5}
        className="mt-[2px] shrink-0 text-line-hot group-hover:text-mute"
      />
      <button
        onClick={onComplete}
        aria-label="Mark done"
        className="mt-[2px] grid h-[15px] w-[15px] shrink-0 place-items-center border border-line-hot transition-colors hover:border-signal hover:bg-signal-wash"
      >
        <Check size={11} strokeWidth={3} className="opacity-0" />
      </button>
      <span className="mt-[3px] h-3 w-[3px] shrink-0" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug">{task.title}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="t-num text-[10px] text-mute">
            {fmtDuration(task.estimateMin)}
          </span>
          <span className="t-num text-[10px] text-signal-dim">
            {taskXp(task.estimateMin, task.quadrant)} xp
          </span>
          {task.scheduledStart && (
            <span className="chip !text-[9px] border-line text-mute">booked</span>
          )}
        </div>
      </div>
    </li>
  );
}
