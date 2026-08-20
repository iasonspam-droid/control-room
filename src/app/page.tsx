import Link from "next/link";
import { ArrowRight, Flame, Info, Snowflake } from "lucide-react";
import { Ring } from "@/components/ui/Ring";
import { auth, authConfigured } from "@/lib/auth";

/**
 * Deliberately not a centered hero. The headline is hard-left and bottom-
 * anchored against a full-height rule; the right column is the product's own
 * readout, running as a still. You see the instrument before you read a word.
 */
export default async function Landing() {
  const session = authConfigured ? await auth() : null;

  return (
    <div className="gridpaper flex min-h-dvh flex-col bg-bg">
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
        {/* ── left: the pitch ── */}
        <div className="flex min-h-0 flex-col justify-between border-line px-8 py-8 lg:border-r lg:px-14 lg:py-10">
          <div className="flex items-baseline justify-between">
            <div className="t-display text-[20px] uppercase leading-none">
              Control Room<span className="text-signal">.</span>
            </div>
            <span className="t-label">Personal build · v1</span>
          </div>

          <div className="max-w-[620px] py-10">
            <h1 className="t-display text-[clamp(44px,6.4vw,88px)] uppercase">
              A week you
              <br />
              can actually
              <br />
              see<span className="text-signal">.</span>
            </h1>

            <p className="mt-8 max-w-[46ch] text-[15px] leading-relaxed text-dim">
              Every hour you intend to spend gets a target. Every block you book
              lands on your real calendar. Every task you finish pays out
              against the quadrant it came from — and the work that matters but
              isn&rsquo;t screaming yet pays the most, because that is the only
              work a score can usefully bribe you into doing.
            </p>

            {/* Sign-in is an upgrade, not a gate. With no Google credentials
                configured, don't offer a button that lands on an error page —
                lead with the thing that actually works. */}
            <div className="mt-9 flex flex-wrap items-center gap-3">
              {session?.user ? (
                <>
                  <Link
                    href="/today"
                    className="btn btn-signal flex items-center gap-2 !px-5 !py-3"
                  >
                    Continue to your planner
                    <ArrowRight size={13} strokeWidth={2} />
                  </Link>
                  <span className="t-label">
                    signed in as {session.user.email ?? session.user.name}
                  </span>
                </>
              ) : authConfigured ? (
                <>
                  <Link
                    href="/api/auth/signin"
                    className="btn btn-signal !px-5 !py-3"
                  >
                    Sign in with Google
                  </Link>
                  <Link
                    href="/today"
                    className="btn flex items-center gap-2 !px-5 !py-3"
                  >
                    Look around with sample data
                    <ArrowRight size={13} strokeWidth={2} />
                  </Link>
                </>
              ) : (
                <Link
                  href="/today"
                  className="btn btn-signal flex items-center gap-2 !px-5 !py-3"
                >
                  Open the planner
                  <ArrowRight size={13} strokeWidth={2} />
                </Link>
              )}
            </div>

            {!authConfigured && (
              <p className="mt-4 flex max-w-[46ch] items-start gap-2 text-[12px] leading-relaxed text-mute">
                <Info size={13} strokeWidth={1.5} className="mt-[2px] shrink-0" />
                <span>
                  Everything works right now — your week is stored in this
                  browser. Google Calendar sync stays switched off until
                  credentials are set; <code className="font-mono">README.md</code>{" "}
                  has the steps.
                </span>
              </p>
            )}
          </div>

          {/* spec strip — the actual mechanics, stated flatly */}
          <dl className="grid grid-cols-2 border-t border-line pt-5 sm:grid-cols-4">
            {[
              ["Q2 rate", "1.5×", "highest paying quadrant"],
              ["Log entry", "15 xp", "flat, any length"],
              ["Grace days", "2 / wk", "streak survives a miss"],
              ["Levels", "cosmetic", "no unlocks, ever"],
            ].map(([k, v, note]) => (
              <div key={k} className="border-l border-line pl-4 first:border-l-0 first:pl-0">
                <dt className="t-label">{k}</dt>
                <dd className="t-num mt-1.5 text-[17px] font-semibold text-text">
                  {v}
                </dd>
                <dd className="mt-1 text-[11px] leading-snug text-mute">{note}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── right: the instrument, as a still ── */}
        <div className="hidden min-h-0 flex-col bg-surface/50 lg:flex">
          <div className="flex items-stretch border-b border-line bg-surface">
            {[
              ["Week load", "18.4", "/ 26h", "text-cool"],
              ["XP today", "142", "", "text-signal"],
            ].map(([label, val, sub, tone]) => (
              <div key={label} className="border-r border-line px-4 py-2.5">
                <div className="t-label">{label}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className={`t-num text-[15px] font-semibold ${tone}`}>
                    {val}
                  </span>
                  {sub && <span className="t-num text-[11px] text-mute">{sub}</span>}
                </div>
              </div>
            ))}
            <div className="flex flex-1 items-center gap-2 px-4">
              <Flame size={13} strokeWidth={1.5} className="text-signal" />
              <span className="t-num text-[15px] font-semibold">11</span>
              <span className="chip flex items-center gap-1 border-line text-mute">
                <Snowflake size={9} strokeWidth={2} />1
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-b border-line px-6 py-6">
            {[
              ["PHYS", 0.72, 0.18, "var(--color-cat-olive)"],
              ["ML", 0.44, 0.36, "var(--color-cat-teal)"],
              ["MATH", 0.91, 0.0, "var(--color-cat-amber)"],
              ["HUM", 0.55, 0.24, "var(--color-cat-plum)"],
              ["CS", 0.33, 0.5, "var(--color-cat-steel)"],
              ["SAT", 0.18, 0.62, "var(--color-cat-clay)"],
            ].map(([k, d, p, col]) => (
              <div key={k as string} className="flex flex-col items-center gap-2">
                <Ring
                  size={62}
                  stroke={5}
                  done={d as number}
                  planned={p as number}
                  color={col as string}
                >
                  <span className="t-num text-[11px] font-semibold">
                    {Math.round((d as number) * 100)}
                  </span>
                </Ring>
                <span className="t-label">{k as string}</span>
              </div>
            ))}
          </div>

          <div className="px-6 py-5">
            <div className="t-label mb-3">Today</div>
            <ul className="space-y-[3px]">
              {[
                ["07:15", "Rotational dynamics — problems 1–18", true, "var(--color-cat-olive)"],
                ["08:45", "APUSH ch. 14 — reading + margin notes", true, "var(--color-cat-plum)"],
                ["15:30", "Gamma analysis — rerun DVH feature extraction", false, "var(--color-cat-teal)"],
                ["17:30", "AP Lang — rhetorical analysis draft", false, "var(--color-cat-plum)"],
                ["19:00", "Unit circle problem set", false, "var(--color-cat-amber)"],
              ].map(([time, title, done, col]) => (
                <li
                  key={time as string}
                  className={`flex items-center gap-2.5 border px-2.5 py-2 ${
                    done ? "border-line bg-cool-wash" : "border-line-hot bg-surface-2"
                  }`}
                >
                  <span
                    className="h-4 w-[3px] shrink-0"
                    style={{ background: done ? "var(--color-cool-dim)" : (col as string) }}
                  />
                  <span className="t-num text-[11px] text-mute">{time as string}</span>
                  <span
                    className={`truncate text-[12px] ${done ? "text-dim" : "text-text"}`}
                  >
                    {title as string}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* the week, as a shape */}
          <div className="mt-auto border-t border-line px-6 py-5">
            <div className="flex items-baseline justify-between">
              <span className="t-label">Week shape</span>
              <span className="t-label">hours banked per day</span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              {[
                ["M", 3.1],
                ["T", 2.4],
                ["W", 4.2],
                ["T", 1.6],
                ["F", 3.8],
                ["S", 2.2],
                ["S", 1.1],
              ].map(([d, h], i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="t-num text-[9px] text-mute">{h as number}</span>
                  <div
                    className="w-full bg-cool-dim"
                    style={{ height: `${((h as number) / 4.2) * 56}px` }}
                  />
                  <span className="t-label !text-[9px]">{d as string}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-baseline justify-between">
              <span className="t-label">Quadrant split</span>
              <span className="t-label">
                <span className="text-signal">42% Q2</span>
              </span>
            </div>
            <div className="mt-2 flex h-[8px] w-full">
              <div className="bg-signal-dim" style={{ width: "38%" }} />
              <div className="bg-signal" style={{ width: "42%" }} />
              <div className="bg-line-hot" style={{ width: "14%" }} />
              <div className="bg-line" style={{ width: "6%" }} />
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-line px-8 py-3 lg:px-14">
        <p className="t-label">
          Built for one person. Data stays in your account.
        </p>
      </footer>
    </div>
  );
}
