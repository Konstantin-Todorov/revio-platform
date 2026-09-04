"use client";

import { useRef, useState } from "react";
import { smoothPath, smoothAreaPath, nearestIndex, type Pt } from "@revio/ui/chart-path";

/**
 * Occupancy and revenue on one chart, dual axis (§1.2).
 *
 * The dashboard's hero visual, and it used to render nothing at all on the default view — just "pick
 * a multi-day range to see the daily trend". A hero trend that is blank on load is worse than no
 * hero: it occupies the best space on the page while doing nothing, and pushes the content that
 * works below the fold.
 *
 * **Dual axis is mandatory, not a preference.** Occupancy is a percentage and revenue is money; on a
 * shared axis one of them is a flat line along the bottom. Line for occupancy, bars for revenue, so
 * the eye separates them before it reads the legend.
 *
 * **Deliberately not a mode toggle.** The insight is the GAP between the two — high occupancy with
 * lagging revenue means you are discounting; rising revenue on flat occupancy means the rate strategy
 * is working. A toggle would make you flip back and forth to see a relationship that only exists when
 * both are on screen. So both are on by default and the legend mutes either: comparison first, focus
 * one click away.
 *
 * ## What changed in the polish pass
 *
 * The line was a `<polyline>` — straight segments between daily readings, which on a 60-day range
 * draws a sawtooth and makes an ordinary week look volatile. It is now a Catmull-Rom curve, which
 * passes through every real reading and never overshoots past it (see `@revio/ui/chart-path` for why
 * that constraint is not optional on a percentage axis).
 *
 * The readout was a native SVG `<title>`: the browser's own tooltip, after its own delay, in a system
 * font, and **one series at a time** — so comparing occupancy against revenue on the same day meant
 * hovering twice and remembering the first number. It is now one crosshair that snaps to the nearest
 * day and reads out both series at once, which is the comparison the chart exists to support.
 */

export interface TrendPoint {
  date: string;
  occupancyPct: number;
  revenueMinor: number;
}

const OCC = "#2563c9";
const REV = "#e0822b";

export function TrendChart({
  points,
  currency,
  revenueBasis,
}: {
  points: TrendPoint[];
  currency: string;
  /** "gross" or "net" — the hotel's own setting, stated so the number is not ambiguous. */
  revenueBasis: string;
}) {
  const [showOcc, setShowOcc] = useState(true);
  const [showRev, setShowRev] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length < 2) {
    return <p className="px-4 py-6 text-[13px] text-ink-500">Not enough days in this range to draw a trend.</p>;
  }

  const W = 1000, H = 240, padL = 38, padR = 46, padT = 14, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const baseY = padT + plotH;

  // Occupancy is a percentage, so its axis is always 0–100: scaling it to the observed maximum makes
  // a quiet week look like a full house.
  const revTop = Math.max(1, ...points.map((p) => p.revenueMinor));
  const niceTop = (v: number) => {
    const step = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / step) * step;
  };
  const revMax = niceTop(revTop);

  const x = (i: number) => padL + (plotW * i) / (points.length - 1);
  const yOcc = (v: number) => padT + plotH - (Math.min(100, v) / 100) * plotH;
  const yRev = (v: number) => padT + plotH - (v / revMax) * plotH;
  const barW = Math.max(1.5, (plotW / points.length) * 0.55);

  const money = (m: number) =>
    `${currency === "EUR" ? "€" : currency === "USD" ? "$" : currency + " "}${Math.round(m / 100).toLocaleString("en-GB")}`;

  const occPts: Pt[] = points.map((p, i) => [x(i), yOcc(p.occupancyPct)]);
  const occLine = smoothPath(occPts);
  const occArea = smoothAreaPath(occPts, baseY);

  /* The crosshair snaps to a real day rather than interpolating — between two days there is no
     reading, so a tooltip halfway between Tuesday and Wednesday would be inventing a number. */
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const el = svgRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    setHover(nearestIndex(vx, points.length, padL, plotW));
  };

  const hp = hover === null ? null : points[hover];
  const label = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

  const legend = (on: boolean, colour: string, text: string, toggle: () => void) => (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11.5px] outline-none transition-[color,opacity,transform] duration-fast ease-standard hover:-translate-y-px focus-visible:shadow-focus ${
        on ? "text-ink-600" : "text-ink-300"
      }`}
    >
      <span
        className="h-2.5 w-4 shrink-0 rounded-sm transition-colors duration-fast ease-standard"
        style={{ background: on ? colour : "transparent", border: on ? "none" : "1.5px solid currentColor" }}
      />
      {text}
    </button>
  );

  return (
    <div className="px-4 py-3">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        {legend(showOcc, OCC, "Occupancy %", () => setShowOcc((v) => !v))}
        {legend(showRev, REV, `Revenue (${revenueBasis})`, () => setShowRev((v) => !v))}
        <span className="ml-auto text-[10.5px] text-ink-300">click a legend to isolate</span>
      </div>

      <div className="relative">
        {/* One readout for both series. Positioned in percentages so it tracks the responsive
            viewBox rather than assuming a rendered pixel width. */}
        {hp && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[120%] whitespace-nowrap rounded-lg bg-brand-900 px-2.5 py-2 text-[11.5px] leading-snug text-white shadow-overlay"
            style={{ left: `${(x(hover!) / W) * 100}%`, top: `${(yOcc(hp.occupancyPct) / H) * 100}%` }}
          >
            <div className="mb-1 font-bold">{label(hp.date)}</div>
            <div className="flex items-center gap-1.5 tabular-nums text-white/80">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: OCC }} />
              Occupancy {hp.occupancyPct.toFixed(0)}%
            </div>
            <div className="flex items-center gap-1.5 tabular-nums text-white/80">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: REV }} />
              Revenue {money(hp.revenueMinor)}
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full cursor-crosshair"
          style={{ height: "auto" }}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Occupancy and revenue over ${points.length} days`}
        >
          <defs>
            <linearGradient id="occFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={OCC} stopOpacity={0.22} />
              <stop offset="100%" stopColor={OCC} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={REV} stopOpacity={0.75} />
              <stop offset="100%" stopColor={REV} stopOpacity={0.3} />
            </linearGradient>
          </defs>

          {/* Horizontal rules only. A vertical grid on a 60-day range draws sixty lines the reader
              must look past to see two series. */}
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <g key={g}>
              <line
                x1={padL} x2={W - padR}
                y1={padT + plotH * g} y2={padT + plotH * g}
                stroke="#e7eaef" strokeWidth={1}
                strokeDasharray={g === 1 ? undefined : "3 4"}
              />
              {showOcc && (
                <text x={padL - 6} y={padT + plotH * g + 4} textAnchor="end" className="fill-ink-400 text-[10px]">
                  {Math.round(100 * (1 - g))}%
                </text>
              )}
              {showRev && (
                <text x={W - padR + 6} y={padT + plotH * g + 4} className="fill-ink-400 text-[10px]">
                  {money(revMax * (1 - g))}
                </text>
              )}
            </g>
          ))}

          {showRev &&
            points.map((p, i) => (
              <rect
                key={`r${p.date}`}
                x={x(i) - barW / 2}
                y={yRev(p.revenueMinor)}
                width={barW}
                height={Math.max(0, baseY - yRev(p.revenueMinor))}
                rx={Math.min(2.5, barW / 2)}
                fill="url(#revFill)"
                opacity={hover === null || hover === i ? 1 : 0.45}
                style={{ transition: "opacity 150ms cubic-bezier(0.4,0,0.2,1)" }}
              />
            ))}

          {showOcc && <path d={occArea} fill="url(#occFill)" />}
          {showOcc && (
            <path
              d={occLine}
              fill="none"
              stroke={OCC}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Crosshair. Drawn above the series so it is never hidden by a tall bar. */}
          {hover !== null && (
            <g>
              <line
                x1={x(hover)} x2={x(hover)} y1={padT} y2={baseY}
                stroke={OCC} strokeWidth={1} strokeDasharray="3 3" opacity={0.5}
              />
              {showOcc && (
                <circle cx={x(hover)} cy={yOcc(points[hover].occupancyPct)} r={5} fill="#fff" stroke={OCC} strokeWidth={2.4} />
              )}
            </g>
          )}

          {points.map((p, i) =>
            i % Math.ceil(points.length / 8) === 0 ? (
              <text key={`x${p.date}`} x={x(i)} y={H - 7} textAnchor="middle" className="fill-ink-400 text-[10px]">
                {label(p.date)}
              </text>
            ) : null,
          )}
        </svg>
      </div>
    </div>
  );
}
