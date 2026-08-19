"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

const KEYS: Record<string, string> = {
  "1": "/today",
  "2": "/week",
  "3": "/matrix",
  "4": "/log",
  "5": "/recap",
};

/**
 * Everything downstream reads `new Date()`, so the app is client-rendered
 * behind this gate rather than fighting hydration mismatches all day.
 */
export function Boot({ children }: { children: React.ReactNode }) {
  const ready = useStore((s) => s.ready);
  const hydrate = useStore((s) => s.hydrate);
  const router = useRouter();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const to = KEYS[e.key];
      if (to) router.push(to);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (!ready) {
    return (
      <div className="grid h-dvh place-items-center bg-bg">
        <div className="t-label flex items-center gap-2">
          <span className="live-dot inline-block h-[5px] w-[5px] bg-signal" />
          spinning up
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
