import type { ReactNode } from "react";
import { Sparkline } from "./sparkline";

/**
 * The headline number on a dashboard.
 *
 * ## Why this is tinted and borderless
 *
 * The stat row is the first thing anyone sees, and it was eight white boxes with an 11px uppercase
 * label and a 24px number — correct, legible and completely undifferentiated. A tint per metric
 * does two jobs at once: it gives the row the only real colour on the page, and it lets someone
 * find *their* number by hue before they have read a single word of it. The tone is chosen by what
 * the metric IS, not by whether today's value is good — a revenue card does not turn red in a bad
 * week, because a card that changes colour with its own value makes the row unlearnable.
 *
 * The delta is where good and bad live, and it is the one thing here that is coloured by value.
 *
 * ## Contrast
 *
 * Text sits on a tint rather than on white, so the pairings are measured rather than eyeballed:
 * the worst reading across all six tones is **4.92:1** (`ink-500` sub-label on `accent-050`),
 * against the 4.5:1 floor. Anything darker than `ink-500` is comfortably clear. Do not introduce a
 * lighter foreground here without re-measuring — `ink-400` fails on every one of these grounds.
 */
export type StatTone = "brand" | "success" | "warning" | "danger" | "accent" | "neutral";

const TINT: Record<StatTone, string> = {
  brand: "bg-brand-50",
  success: "bg-success-50",
  warning: "bg-warning-50",
  danger: "bg-danger-50",
  accent: "bg-accent-50",
  neutral: "bg-surface-muted",
};

/** The line colour for the sparkline — the tone's own 600, which is the only saturated ink here. */
const STROKE: Record<StatTone, string> = {
  brand: "#2563c9",
  success: "#0f7a52",
  warning: "#e0822b",
  danger: "#b53528",
  accent: "#5b3fb0",
  neutral: "#7d8aa3",
};

const ICON_WRAP: Record<StatTone, string> = {
  brand: "bg-brand-600/10 text-brand-600",
  success: "bg-success-600/10 text-success-600",
  warning: "bg-warning-600/10 text-warning-600",
  danger: "bg-danger-600/10 text-danger-600",
  accent: "bg-accent-600/10 text-accent-600",
  neutral: "bg-ink-400/10 text-ink-500",
};

export interface StatDelta {
  /** Pre-formatted, e.g. "+12.4%" — this component never does arithmetic. */
  text: string;
  dir: "up" | "down" | "flat";
  /** What the comparison is against. Becomes the title attribute, so it is never a bare number. */
  hint?: string;
  /**
   * Whether "up" is good. Occupancy up is good; cancellations up is not. Without this a rising
   * cancellation rate renders in success green, which is worse than showing no colour at all.
   */
  goodDirection?: "up" | "down";
}

export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  delta,
  spark,
  icon,
}: {
  label: string;
  /** Pre-formatted for display — money arrives here as a string, never as minor units. */
  value: string;
  sub?: string;
  tone?: StatTone;
  delta?: StatDelta | null;
  /** Raw series for the trend line, oldest first. Fewer than two points renders no line. */
  spark?: number[];
  icon?: ReactNode;
}) {
  const good = delta?.goodDirection ?? "up";
  const deltaTone =
    !delta || delta.dir === "flat"
      ? "bg-white/70 text-ink-500"
      : delta.dir === good
        ? "bg-white/80 text-success-600"
        : "bg-white/80 text-danger-600";

  return (
    <div
      className={`group relative overflow-hidden rounded-xl ${TINT[tone]} px-5 py-4 transition-shadow hover:shadow-float`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ICON_WRAP[tone]}`}>
              {icon}
            </span>
          )}
          <span className="text-[13px] font-semibold text-ink-700">{label}</span>
        </div>
        {delta && (
          <span
            title={delta.hint}
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${deltaTone}`}
          >
            {delta.dir === "up" ? "↑" : delta.dir === "down" ? "↓" : "→"} {delta.text}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="tnum text-[30px] font-bold leading-none tracking-tight text-ink-900">{value}</div>
          {sub && <div className="mt-1.5 truncate text-[11.5px] text-ink-500">{sub}</div>}
        </div>
        {spark && spark.length > 1 && (
          <Sparkline points={spark} stroke={STROKE[tone]} className="mb-0.5 opacity-90" />
        )}
      </div>
    </div>
  );
}
