"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { dayKey } from "@/lib/time";
import { LOG_ENTRY_XP } from "@/lib/xp";
import type { LogEntry } from "@/lib/types";

export default function LogPage() {
  const { log, saveLog } = useStore();
  const today = dayKey(new Date());
  const existing = log.find((l) => l.date === today);

  const [body, setBody] = useState(existing?.body ?? "");
  const [energy, setEnergy] = useState<LogEntry["energy"]>(existing?.energy ?? 3);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBody(existing?.body ?? "");
    setEnergy(existing?.energy ?? 3);
  }, [existing?.body, existing?.energy]);

  const past = log
    .filter((l) => l.date !== today)
    .sort((a, b) => b.date.localeCompare(a.date));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    saveLog(today, body.trim(), energy);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Lab-notebook measure: the date lives in the margin, not above the text. */}
      <div className="max-w-[880px] px-12 py-8">
        <header className="mb-8 grid grid-cols-[132px_minmax(0,1fr)] gap-8 border-b border-line pb-6">
          <div />
          <div>
            <h1 className="t-display text-[30px] uppercase">Log</h1>
            <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-dim">
              One entry a day, {LOG_ENTRY_XP} XP flat, no length requirement and
              no bonus for writing more. The point is the record, not the
              performance — a line that says &ldquo;wrote nothing, tired&rdquo;
              counts exactly as much as three paragraphs.
            </p>
          </div>
        </header>

        <form
          onSubmit={submit}
          className="grid grid-cols-[132px_minmax(0,1fr)] gap-8 pb-10"
        >
          <div className="pt-1 text-right">
            <div className="t-num text-[22px] font-semibold leading-none">
              {format(new Date(), "d MMM").toLowerCase()}
            </div>
            <div className="t-label mt-1.5">{format(new Date(), "EEEE")}</div>
            <div className="t-label mt-4">Energy</div>
            <div className="mt-1.5 flex justify-end gap-[3px]">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setEnergy(n as LogEntry["energy"])}
                  aria-label={`Energy ${n}`}
                  className={`h-4 w-[7px] border transition-colors ${
                    (energy ?? 0) >= n
                      ? "border-signal bg-signal"
                      : "border-line-hot bg-transparent hover:border-dim"
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="What actually happened today?"
              className="w-full resize-y bg-surface px-3 py-2.5 text-[14px] leading-relaxed placeholder:text-mute"
            />
            <div className="mt-2 flex items-center gap-3">
              <button type="submit" className="btn btn-signal">
                {existing ? "Update entry" : `Save · +${LOG_ENTRY_XP} xp`}
              </button>
              {saved && (
                <span className="t-label !text-cool">saved</span>
              )}
              {existing && !saved && (
                <span className="t-label">
                  already logged today — editing is free
                </span>
              )}
            </div>
          </div>
        </form>

        <div className="space-y-0">
          {past.map((l) => (
            <article
              key={l.id}
              className="grid grid-cols-[132px_minmax(0,1fr)] gap-8 border-t border-line py-6"
            >
              <div className="text-right">
                <div className="t-num text-[17px] font-semibold leading-none text-dim">
                  {format(parseISO(l.date), "d MMM").toLowerCase()}
                </div>
                <div className="t-label mt-1.5">
                  {format(parseISO(l.date), "EEEE")}
                </div>
                {l.energy && (
                  <div className="mt-3 flex justify-end gap-[3px]">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`h-3 w-[5px] ${
                          l.energy! >= n ? "bg-signal-dim" : "bg-line"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[14px] leading-relaxed text-text/90">{l.body}</p>
            </article>
          ))}
          {past.length === 0 && (
            <p className="border-t border-line py-8 text-center font-mono text-[11px] text-mute">
              nothing behind you yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
