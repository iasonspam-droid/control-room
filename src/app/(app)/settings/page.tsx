"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { CAT_VAR } from "@/lib/derive";
import {
  DEFAULT_MISC_COLOR,
  MISC_LABEL,
  RULE_COLORS,
} from "@/lib/calendar-category";
import type { CalendarRule, CatColor } from "@/lib/types";

const COLORS = RULE_COLORS;

/** Labels sit in the left margin; controls run down a single measure. */
function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-8 border-t border-line py-4">
      <div className="pt-1">
        <div className="t-label !text-dim">{label}</div>
        {hint && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-mute">{hint}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pb-8">
      <h2 className="t-display text-[17px] uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const {
    profile,
    setProfile,
    categories,
    addCategory,
    updateCategory,
    removeCategory,
    streak,
    reseed,
  } = useStore();
  const { data: session } = useSession();
  // Set by the jwt callback when Google rejects the stored refresh token —
  // the 7-day Testing-mode expiry is the usual cause.
  const expired = session?.error === "RefreshAccessTokenError";
  const [perm, setPerm] = useState<string>("default");
  const [status, setStatus] = useState<{
    authConfigured: boolean;
    databaseConfigured: boolean;
    google: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ authConfigured: false, databaseConfigured: false, google: false }));
  }, []);

  const rules = profile.calendarRules ?? [];
  const miscColor = profile.calendarMiscColor ?? DEFAULT_MISC_COLOR;

  /** Patch one rule in place — order is match order, so it has to be stable. */
  function setRule(index: number, patch: Partial<CalendarRule>) {
    setProfile({
      calendarRules: rules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  }

  /** Reorder is the priority control: position in the list is precedence. */
  function moveRule(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= rules.length) return;
    const next = [...rules];
    [next[index], next[to]] = [next[to], next[index]];
    setProfile({ calendarRules: next });
  }

  async function askNotify() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") setProfile({ remindersEnabled: true });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[920px] px-12 py-8">
        <header className="border-b-2 border-text pb-3">
          <h1 className="t-display text-[34px] uppercase">Settings</h1>
        </header>

        <div className="pt-6">
          <Section title="Day">
            <Row label="Name" hint="Only used in the recap heading.">
              <input
                value={profile.name}
                onChange={(e) => setProfile({ name: e.target.value })}
                className="w-64 px-2 py-1.5 text-[13px]"
              />
            </Row>
            <Row
              label="Working window"
              hint="The range the Today and Week timelines draw. Blocks can't be auto-booked outside it."
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={profile.dayStartHour}
                  onChange={(e) =>
                    setProfile({ dayStartHour: Number(e.target.value) })
                  }
                  className="w-20 px-2 py-1.5 font-mono text-[13px]"
                />
                <span className="t-label">to</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={profile.dayEndHour}
                  onChange={(e) =>
                    setProfile({ dayEndHour: Number(e.target.value) })
                  }
                  className="w-20 px-2 py-1.5 font-mono text-[13px]"
                />
              </div>
            </Row>
            <Row label="Week starts" hint="">
              <select
                value={profile.weekStartsOn}
                onChange={(e) =>
                  setProfile({ weekStartsOn: Number(e.target.value) as 0 | 1 })
                }
                className="w-40 px-2 py-1.5 font-mono text-[12px]"
              >
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </select>
            </Row>
          </Section>

          <Section title="Categories">
            <Row
              label="Weekly targets"
              hint="Hours per week. These drive every ring in the product — set them to what you'd actually defend, not what looks good."
            >
              <ul>
                {categories.map((c) => (
                  <li
                    key={c.id}
                    className="group border-b border-line py-2 first:border-t first:border-line"
                  >
                    <div className="flex items-center gap-2">
                    <span
                      className="h-5 w-[3px] shrink-0"
                      style={{ background: CAT_VAR[c.color] }}
                    />
                    <input
                      value={c.name}
                      onChange={(e) =>
                        updateCategory(c.id, { name: e.target.value })
                      }
                      className="min-w-0 flex-1 border-transparent bg-transparent px-2 py-1 text-[13px] focus:bg-surface-2"
                    />
                    <input
                      value={c.short}
                      onChange={(e) =>
                        updateCategory(c.id, {
                          short: e.target.value.toUpperCase().slice(0, 6),
                        })
                      }
                      className="w-16 border-transparent bg-transparent px-2 py-1 text-center font-mono text-[11px] uppercase focus:bg-surface-2"
                    />
                    <select
                      value={c.color}
                      onChange={(e) =>
                        updateCategory(c.id, {
                          color: e.target.value as CatColor,
                        })
                      }
                      className="w-20 px-1 py-1 font-mono text-[10px] uppercase"
                    >
                      {COLORS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={c.weeklyTargetHours}
                      onChange={(e) =>
                        updateCategory(c.id, {
                          weeklyTargetHours: Number(e.target.value),
                        })
                      }
                      className="w-16 px-2 py-1 text-right font-mono text-[12px]"
                    />
                    <span className="t-label w-3">h</span>
                    <button
                      onClick={() => removeCategory(c.id)}
                      className="text-mute opacity-0 transition-opacity hover:text-alarm group-hover:opacity-100"
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() =>
                    addCategory({
                      name: "New category",
                      short: "NEW",
                      color: COLORS[categories.length % COLORS.length],
                      weeklyTargetHours: 2,
                    })
                  }
                  className="btn flex items-center gap-1.5"
                >
                  <Plus size={12} strokeWidth={2} /> Add
                </button>
                <span className="t-num text-[12px] text-dim">
                  {categories.reduce((a, c) => a + c.weeklyTargetHours, 0)}h
                  <span className="t-label ml-2">committed per week</span>
                </span>
              </div>
            </Row>
          </Section>

          <Section title="Scoring">
            <Row
              label="XP rate"
              hint="Fixed, and the same for every task. Time is the one input here that isn't a judgement call, so it is the only thing XP counts — a log entry is a flat 15, a finished goal 100."
            >
              <div className="flex gap-6">
                <div>
                  <div className="t-label">Per 15 min</div>
                  <div className="t-num mt-1 text-[15px] text-signal">5 xp</div>
                </div>
                <div>
                  <div className="t-label">Per hour</div>
                  <div className="t-num mt-1 text-[15px] text-dim">20 xp</div>
                </div>
              </div>
            </Row>
            <Row
              label="Reality score"
              hint="Of the time you actually planned — booked blocks plus any calendar event matched by a rule below — how much did you do? Weighted by length, so a missed four-hour block costs more than a missed fifteen-minute one. Partial counts: 90 minutes of a two-hour block is 75%."
            >
              <span className="font-mono text-[11px] text-mute">
                done ÷ planned, by the minute
              </span>
            </Row>
            <Row
              label="Productivity"
              hint="Of your whole working window above, how much became work — scheduled or not. Reality asks whether you kept the plan; this asks how much of the day you used. They move independently on purpose."
            >
              <span className="font-mono text-[11px] text-mute">
                worked ÷ working window
              </span>
            </Row>
            <Row
              label="Streak freezes"
              hint="Missed days this many times a week don't break the streak. Two is the default; more than that and the streak stops meaning anything."
            >
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={streak.freezesPerWeek}
                  onChange={(e) =>
                    useStore.setState((s) => ({
                      streak: {
                        ...s.streak,
                        freezesPerWeek: Number(e.target.value),
                      },
                    }))
                  }
                  className="w-20 px-2 py-1.5 text-center font-mono text-[13px]"
                />
                <span className="t-num text-[11px] text-mute">
                  {streak.freezesPerWeek - streak.freezesUsed} left this week
                </span>
              </div>
            </Row>
          </Section>

          <Section title="Reminders">
            <Row
              label="Browser push"
              hint="A notification before a booked block starts. Requires granting permission once."
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={askNotify}
                  disabled={perm === "granted"}
                  className={`btn ${perm === "granted" ? "" : "btn-signal"}`}
                >
                  {perm === "granted"
                    ? "Permission granted"
                    : perm === "denied"
                      ? "Blocked in browser"
                      : "Enable notifications"}
                </button>
                <label className="flex items-center gap-2 text-[12px] text-dim">
                  <input
                    type="checkbox"
                    checked={profile.remindersEnabled}
                    onChange={(e) =>
                      setProfile({ remindersEnabled: e.target.checked })
                    }
                    className="h-3.5 w-3.5 accent-[var(--color-signal)]"
                  />
                  on
                </label>
              </div>
            </Row>
            <Row label="Lead time" hint="Minutes before a block starts.">
              <input
                type="number"
                min={0}
                max={60}
                step={5}
                value={profile.remindLeadMin}
                onChange={(e) =>
                  setProfile({ remindLeadMin: Number(e.target.value) })
                }
                className="w-20 px-2 py-1.5 text-center font-mono text-[13px]"
              />
            </Row>
          </Section>

          <Section title="Google Calendar">
            <Row
              label="Connection"
              hint="Booking a block writes an event. Completion stays in here — by the time you tick something off, the slot has already passed, so writing it back would only add noise to your calendar."
            >
              <div className="flex items-center gap-3">
                {status?.authConfigured ? (
                  <>
                    <a href="/api/auth/signin" className="btn btn-signal">
                      {session?.user ? "Reconnect" : "Connect Google"}
                    </a>
                    <span className="t-label">
                      {session?.user
                        ? expired
                          ? "authorisation expired"
                          : `connected as ${session.user.email ?? session.user.name}`
                        : "not connected"}
                    </span>
                  </>
                ) : (
                  <span className="chip border-line-hot text-mute">
                    not configured on this deployment
                  </span>
                )}
              </div>

              {expired && (
                <div className="mt-3 max-w-lg border border-alarm/50 bg-alarm-wash p-3">
                  <p className="text-[12px] leading-relaxed text-text">
                    Google stopped accepting the stored authorisation, so new
                    blocks aren&rsquo;t reaching your calendar. Hit{" "}
                    <strong>Reconnect</strong> above — nothing in your planner is
                    affected either way.
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-mute">
                    If this happens every week, the OAuth app is still in{" "}
                    <span className="font-mono">Testing</span> mode in Google
                    Cloud, where every authorisation expires after 7 days.
                    Publishing the app removes the expiry.
                  </p>
                </div>
              )}

              {status && !status.authConfigured && (
                <ul className="mt-3 max-w-lg space-y-1">
                  {[
                    ["Google OAuth client", status.google],
                    ["Database URL", status.databaseConfigured],
                  ].map(([label, ok]) => (
                    <li
                      key={label as string}
                      className="flex items-center gap-2 font-mono text-[11px]"
                    >
                      <span
                        className={`h-[7px] w-[7px] shrink-0 ${
                          ok ? "bg-cool" : "bg-line-hot"
                        }`}
                      />
                      <span className={ok ? "text-dim" : "text-mute"}>
                        {label as string}
                      </span>
                      <span className={ok ? "text-cool" : "text-mute"}>
                        {ok ? "set" : "missing"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 max-w-lg text-[11px] leading-relaxed text-mute">
                Scopes requested: <span className="font-mono">calendar.events</span>{" "}
                (read and write) and basic profile. Your primary calendar&rsquo;s
                events are read to show alongside your planned blocks in Today
                and Week — for display only. No event you didn&apos;t create
                here is ever modified.
              </p>
            </Row>

            <Row
              label="Calendar rules"
              hint="A keyword colours any event whose title contains it — “physics” catches “AP Physics 1 — Unit 2”. Matching ignores case and looks anywhere in the title. Rules are checked top to bottom and the first hit wins, so drag the specific words above the general ones with the arrows. The category decides whether that time counts toward your reality score; leave it on “don't count” for things you want to see but not be scored on."
            >
              <ul>
                {rules.map((r, i) => (
                  <li
                    key={r.id}
                    className="group flex items-center gap-2 border-b border-line py-2 first:border-t first:border-line"
                  >
                    <span className="t-num w-4 shrink-0 text-[10px] text-mute">
                      {i + 1}
                    </span>
                    <div className="flex shrink-0 flex-col">
                      <button
                        onClick={() => moveRule(i, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${r.keyword || "rule"} up`}
                        className="text-mute transition-colors hover:text-text disabled:opacity-20 disabled:hover:text-mute"
                      >
                        <ChevronUp size={11} strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => moveRule(i, 1)}
                        disabled={i === rules.length - 1}
                        aria-label={`Move ${r.keyword || "rule"} down`}
                        className="text-mute transition-colors hover:text-text disabled:opacity-20 disabled:hover:text-mute"
                      >
                        <ChevronDown size={11} strokeWidth={2} />
                      </button>
                    </div>
                    <span
                      className="h-5 w-[3px] shrink-0"
                      style={{ background: CAT_VAR[r.color] }}
                    />
                    <input
                      value={r.keyword}
                      onChange={(e) =>
                        setRule(i, { keyword: e.target.value })
                      }
                      placeholder="keyword"
                      className="min-w-0 flex-1 border-transparent bg-transparent px-2 py-1 text-[13px] placeholder:text-mute focus:bg-surface-2"
                    />
                    <select
                      value={r.color}
                      onChange={(e) =>
                        setRule(i, { color: e.target.value as CatColor })
                      }
                      className="w-20 px-1 py-1 font-mono text-[10px] uppercase"
                    >
                      {COLORS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    <select
                      value={r.categoryId}
                      onChange={(e) =>
                        setRule(i, { categoryId: e.target.value })
                      }
                      className="w-28 px-1 py-1 font-mono text-[10px]"
                    >
                      <option value="">don&apos;t count</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        setProfile({
                          calendarRules: rules.filter((_, j) => j !== i),
                        })
                      }
                      className="text-mute opacity-0 transition-opacity hover:text-alarm group-hover:opacity-100"
                      aria-label={`Delete rule ${r.keyword}`}
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  </li>
                ))}
              </ul>
              {rules.length === 0 && (
                <p className="border-y border-line py-4 text-center font-mono text-[11px] text-mute">
                  no rules — every event falls through to miscellaneous
                </p>
              )}
              <button
                onClick={() =>
                  setProfile({
                    calendarRules: [
                      ...rules,
                      {
                        id: Math.random().toString(36).slice(2, 10),
                        keyword: "",
                        color: COLORS[rules.length % COLORS.length],
                        categoryId: categories[0]?.id ?? "",
                      },
                    ],
                  })
                }
                className="btn mt-3 flex items-center gap-1.5"
              >
                <Plus size={12} strokeWidth={2} /> Add rule
              </button>

              {/* the fallback bucket — every event lands somewhere */}
              <div className="mt-5 border-t border-line pt-3">
                <div className="flex items-center gap-2">
                  <span className="t-num w-4 shrink-0 text-[10px] text-mute">
                    —
                  </span>
                  <span
                    className="h-5 w-[3px] shrink-0"
                    style={{ background: CAT_VAR[miscColor] }}
                  />
                  <span className="t-label min-w-0 flex-1 px-2">
                    {MISC_LABEL}
                  </span>
                  <select
                    value={miscColor}
                    onChange={(e) =>
                      setProfile({
                        calendarMiscColor: e.target.value as CatColor,
                      })
                    }
                    className="w-20 px-1 py-1 font-mono text-[10px] uppercase"
                  >
                    {COLORS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <span className="w-28 shrink-0 px-1 font-mono text-[10px] text-mute">
                    never counted
                  </span>
                  <span className="w-[13px] shrink-0" />
                </div>
                <p className="mt-2 max-w-lg text-[11px] leading-relaxed text-mute">
                  Anything no keyword claims. It still gets a colour so the
                  timeline reads as deliberate rather than half-finished, but it
                  never counts as planned work — a dentist appointment you
                  skipped is not a promise you broke.
                </p>
              </div>
            </Row>
          </Section>

          <Section title="Data">
            <Row
              label="Reset"
              hint="Wipes local state and reloads the sample week. Does not touch Google Calendar."
            >
              <button
                onClick={() => {
                  if (confirm("Reset all local data back to the sample week?"))
                    reseed();
                }}
                className="btn flex items-center gap-1.5 !border-alarm/60 text-alarm hover:!border-alarm"
              >
                <RotateCcw size={12} strokeWidth={2} /> Reset local data
              </button>
            </Row>
          </Section>
        </div>
      </div>
    </div>
  );
}
