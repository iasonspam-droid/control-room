import type { ReactNode } from "react";

/**
 * A panel is a square-cornered plate with a hairline border and a mono
 * caption bar. No shadow — separation comes from the border and the value
 * step between --bg and --surface.
 */
export function Panel({
  label,
  right,
  children,
  className = "",
  bodyClass = "",
  flush = false,
}: {
  label?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
  flush?: boolean;
}) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`}>
      {label && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-2">
          <h2 className="t-label">{label}</h2>
          {right}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${flush ? "" : "p-3"} ${bodyClass}`}>
        {children}
      </div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 py-6 text-center font-mono text-[11px] text-mute">
      {children}
    </p>
  );
}
