import type { ReactNode } from "react";

/**
 * Presentational primitives for the esports dashboard aesthetic.
 * These are pure (stateless) components, safe to use from both server and
 * client components. They carry no business logic — only layout/visuals.
 */

// High-contrast accent palette (mirrors the @theme tokens for inline styles).
export const ACCENT = {
  win: "#00e676",
  draw: "#2979ff",
  loss: "#ff1744",
  gold: "#ffb300",
} as const;

type Segment = { value: number; color: string; title?: string };

/**
 * Barra de Proporção V/E/D — a single full-width horizontal bar split
 * proportionally across segments, each labelled with its count in white.
 */
export function ProportionBar({
  segments,
  className = "",
}: {
  segments: Segment[];
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className={`flex h-7 w-full overflow-hidden rounded-md bg-panel ${className}`}>
      {total === 0 ? (
        <div className="flex w-full items-center justify-center text-[11px] font-semibold text-faint">
          Sem registros
        </div>
      ) : (
        segments
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <div
              key={i}
              title={s.title}
              className="flex items-center justify-center text-[11px] font-bold tracking-tight text-white"
              style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            >
              {s.value}
            </div>
          ))
      )}
    </div>
  );
}

/**
 * Barra de performance/histórico — a horizontal progress bar whose fill is
 * proportional to value/max and coloured by rank/status.
 */
export function PerfBar({
  value,
  max,
  color,
  label,
  trailing,
}: {
  value: number;
  max: number;
  color: string;
  label: ReactNode;
  trailing?: ReactNode;
}) {
  const pct = max > 0 && value > 0 ? Math.max((value / max) * 100, 8) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-panel">
        <div
          className="absolute inset-y-0 left-0 rounded-md"
          style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.9 }}
        />
        <div className="relative flex h-full items-center px-2 text-[11px] font-semibold text-white">
          <span className="truncate">{label}</span>
        </div>
      </div>
      {trailing != null && (
        <span className="w-8 shrink-0 text-right font-mono text-xs font-bold tabular-nums">
          {trailing}
        </span>
      )}
    </div>
  );
}

/**
 * Bloco quadrado de resultado — a solid-colour square holding a numeric value,
 * used right-aligned inside flat history tables.
 */
export function ResultBlock({
  value,
  color,
  textClass = "text-white",
  className = "",
}: {
  value: ReactNode;
  color: string;
  /** Tailwind text-colour class for the block contents (default white). */
  textClass?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-sm font-bold ${textClass} ${className}`}
      style={{ backgroundColor: color }}
    >
      {value}
    </span>
  );
}
