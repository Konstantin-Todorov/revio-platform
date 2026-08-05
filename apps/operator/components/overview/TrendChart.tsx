"use client";

import { useState } from "react";

export type TrendBucket = { label: string; value: number; secondary?: number };

/**
 * A month-by-month bar chart with a live hover readout.
 *
 * Deliberately NOT the CRS's `EvolutionChart`. That one is a dual-axis room-nights-vs-ADR comparison
 * against a prior period — a shape this screen never needs, and generalising it would have made a
 * worse component for both callers while destabilising a shipped analytics page. If a third caller
 * ever wants *this* shape, it moves to `@revio/ui`; the repo's rule is to extract when a second
 * caller appears, not before.
 *
 * The optional `secondary` series is drawn as a lighter overlay inside the same bar rather than
 * beside it, because the two are always a part and its whole here (billed vs paid) — side-by-side
 * bars would suggest they add up.
 */
export function TrendChart({
  data,
  format,
  secondaryLabel,
  primaryLabel,
  accent = "#2f5bd8",
}: {
  data: TrendBucket[];
  /** How to render a value in the tooltip and axis — money, count, whatever the caller means. */
  format: (v: number) => string;
  primaryLabel: string;
  secondaryLabel?: string;
  accent?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  // Round the axis up to something a person would choose, so the tallest bar is not flush with the top.
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.max(step, Math.ceil(max / step) * step);
  const hd = hover != null ? data[hover] : null;

  if (data.length === 0) return <p className="px-4 py-6 text-[13px] text-ink-500">No data yet.</p>;

  return (
    <div className="relative px-4 py-4">
      {/* Hover readout floats above the bars rather than following the cursor — a tooltip that moves
          under the pointer is harder to read than one that stays where you looked for it. */}
      <div className="mb-2 flex h-9 items-baseline gap-3">
        {hd ? (
          <>
            <span className="text-[12px] font-semibold text-ink-500">{hd.label}</span>
            <span className="tnum text-[15px] font-bold text-ink-900">{format(hd.value)}</span>
            <span className="text-[11.5px] text-ink-400">{primaryLabel}</span>
            {hd.secondary != null && secondaryLabel && (
              <span className="text-[11.5px] text-ink-400">
                · {format(hd.secondary)} {secondaryLabel}
              </span>
            )}
          </>
        ) : (
          <span className="text-[11.5px] text-ink-300">Hover a month for detail</span>
        )}
      </div>

      <div className="flex h-[132px] items-end gap-1.5">
        {data.map((d, i) => {
          const h = (d.value / top) * 100;
          const sh = d.secondary != null ? (d.secondary / top) * 100 : null;
          return (
            <button
              key={d.label}
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="group relative flex h-full flex-1 flex-col justify-end outline-none"
              aria-label={`${d.label}: ${format(d.value)}`}
            >
              <span
                className="relative w-full rounded-t-[3px] transition-opacity"
                style={{
                  height: `${Math.max(h, d.value > 0 ? 2 : 0)}%`,
                  backgroundColor: accent,
                  opacity: hover == null || hover === i ? 1 : 0.35,
                }}
              >
                {sh != null && (
                  <span
                    className="absolute bottom-0 left-0 w-full rounded-t-[3px]"
                    style={{ height: `${(d.secondary! / Math.max(d.value, 1)) * 100}%`, backgroundColor: "rgba(255,255,255,0.42)" }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <span
            key={d.label}
            className={`flex-1 text-center text-[10px] ${hover === i ? "font-semibold text-ink-700" : "text-ink-400"}`}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
