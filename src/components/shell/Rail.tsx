"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getISOWeek } from "date-fns";
import { signOut, useSession } from "next-auth/react";
import {
  CalendarRange,
  Grid2x2,
  type LucideIcon,
  LogOut,
  NotebookPen,
  Radio,
  Settings2,
  Sun,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { levelProgress, rankForLevel } from "@/lib/xp";

const NAV: { href: string; label: string; icon: LucideIcon; key: string }[] = [
  { href: "/today", label: "Today", icon: Sun, key: "1" },
  { href: "/week", label: "Week", icon: CalendarRange, key: "2" },
  { href: "/matrix", label: "Matrix", icon: Grid2x2, key: "3" },
  { href: "/log", label: "Log", icon: NotebookPen, key: "4" },
  { href: "/recap", label: "Recap", icon: Radio, key: "5" },
];

export function Rail() {
  const pathname = usePathname();
  const xp = useStore((s) => s.xp);
  const { level, into, span, pct } = levelProgress(xp);
  const { data: session, status } = useSession();

  return (
    <nav className="flex w-[188px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="border-b border-line px-4 py-4">
        <div className="t-display text-[22px] uppercase leading-[0.86]">
          Control
          <br />
          Room<span className="text-signal">.</span>
        </div>
        <div className="t-label mt-2">
          Week {getISOWeek(new Date())} · {new Date().getFullYear()}
        </div>
      </div>

      <ul className="flex-1 py-2">
        {NAV.map(({ href, label, icon: Icon, key }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                className={`group relative flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors ${
                  active
                    ? "bg-surface-2 text-text"
                    : "text-dim hover:bg-surface-2 hover:text-text"
                }`}
              >
                <span
                  className={`absolute left-0 top-0 h-full w-[2px] ${
                    active ? "bg-signal" : "bg-transparent"
                  }`}
                />
                <Icon size={16} strokeWidth={1.5} />
                <span className="flex-1">{label}</span>
                <kbd className="font-mono text-[10px] text-mute opacity-0 transition-opacity group-hover:opacity-100">
                  {key}
                </kbd>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="t-label">Level</span>
          <span className="t-num text-[22px] font-bold leading-none text-text">
            {level}
          </span>
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-signal">
          {rankForLevel(level)}
        </div>
        <div className="mt-2 h-[3px] w-full bg-line">
          <div
            className="h-full bg-signal"
            style={{ width: `${Math.round(pct * 100)}%` }}
          />
        </div>
        <div className="t-num mt-1.5 text-[10px] text-mute">
          {into} / {span} xp
        </div>
      </div>

      {/* Only shown once signed in — Settings already covers "not connected"
          / "not configured" states, so this stays quiet otherwise. */}
      {status === "authenticated" && session?.user && (
        <div className="flex items-center gap-2.5 border-t border-line px-4 py-2.5">
          <span className="grid h-6 w-6 shrink-0 place-items-center border border-line-hot bg-cool-wash font-mono text-[10px] font-bold text-cool">
            {(session.user.name ?? session.user.email ?? "?")
              .slice(0, 1)
              .toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-dim">
            {session.user.email ?? session.user.name}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            title="Sign out"
            className="shrink-0 text-mute transition-colors hover:text-alarm"
            aria-label="Sign out"
          >
            <LogOut size={13} strokeWidth={1.5} />
          </button>
        </div>
      )}

      <Link
        href="/settings"
        className={`flex items-center gap-3 border-t border-line px-4 py-3 text-[13px] transition-colors ${
          pathname === "/settings"
            ? "bg-surface-2 text-text"
            : "text-dim hover:bg-surface-2 hover:text-text"
        }`}
      >
        <Settings2 size={16} strokeWidth={1.5} />
        Settings
      </Link>
    </nav>
  );
}
