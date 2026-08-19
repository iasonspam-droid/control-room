"use client";

/**
 * Dual-arc progress ring.
 *
 * Two values, one dial — the way a chronograph subdial stacks readings:
 *   cyan  = banked (already done)
 *   amber = scheduled but not yet done
 * Butt line caps, not round. Rounded caps are the tell of a generic ring.
 */
export function Ring({
  size = 56,
  stroke = 5,
  done,
  planned = 0,
  color,
  children,
  faint = false,
}: {
  size?: number;
  stroke?: number;
  /** 0–1 */
  done: number;
  /** 0–1, drawn after `done` */
  planned?: number;
  color?: string;
  children?: React.ReactNode;
  faint?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const d = Math.min(1, Math.max(0, done));
  const p = Math.min(1 - d, Math.max(0, planned));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        {p > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-signal-dim)"
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${c * p} ${c}`}
            strokeDashoffset={-c * d}
          />
        )}
        {d > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color ?? (faint ? "var(--color-cool-dim)" : "var(--color-cool)")}
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${c * d} ${c}`}
          />
        )}
      </svg>
      {children && (
        <div className="absolute inset-0 grid place-items-center">{children}</div>
      )}
    </div>
  );
}
