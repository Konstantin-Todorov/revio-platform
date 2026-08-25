"use client";

import { useState } from "react";

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
 */

export interface TrendPoint {
  date: string;
  occupancyPct: number;
  revenueMinor: number;
}

const OCC = "#2f5bd8";
const REV = "#f59e0b";

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

  if (points.length < 2) {
    return <p className="px-4 py-6 text-[13px] text-ink-500">Not enough days in this range to draw a trend.</p>;
  }

  const W = 1000, H = 240, padL = 38, padR = 46, padT = 14, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;

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

  const legend = (on: boolean, colour: string, label: string, toggle: () => void, dashed = false) => (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11.5px] transition-opacity ${on ? "text-ink-600" : "text-ink-300"}`}
    >
      <span
        className="h-2.5 w-4 shrink-0 rounded-sm"
        style={{ background: on ? colour : "transparent", border: on ? "none" : `1.5px ${dashed ? "dashed" : "solid"} currentColor` }}
      />
      {label}
    </button>
  );

  return (
    <div className="px-4 py-3">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        {legend(showOcc, OCC, "Occupancy %", () => setShowOcc((v) => !v))}
        {legend(showRev, REV, `Revenue (${revenueBasis})`, () => setShowRev((v) => !v))}
        <span className="ml-auto text-[10.5px] text-ink-300">click a legend to isolate</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={padT + plotH * g} y2={padT + plotH * g} stroke="#e4e7ec" strokeWidth={1} />
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
              height={Math.max(0, padT + plotH - yRev(p.revenueMinor))}
              rx={1}
              fill={REV}
              opacity={0.55}
            >
              <title>{`${p.date} · ${money(p.revenueMinor)}`}</title>
            </rect>
          ))}

        {showOcc && (
          <polyline
            points={points.map((p, i) => `${x(i)},${yOcc(p.occupancyPct)}`).join(" ")}
            fill="none"
            stroke={OCC}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
        )}
        {showOcc &&
          points.map((p, i) => (
            <circle key={`o${p.date}`} cx={x(i)} cy={yOcc(p.occupancyPct)} r={points.length > 45 ? 1.4 : 2.4} fill={OCC}>
              <title>{`${p.date} · ${p.occupancyPct.toFixed(0)}%`}</title>
            </circle>
          ))}

        {points.map((p, i) =>
          i % Math.ceil(points.length / 8) === 0 ? (
            <text key={`x${p.date}`} x={x(i)} y={H - 7} textAnchor="middle" className="fill-ink-400 text-[10px]">
              {Number(p.date.slice(8, 10))}/{Number(p.date.slice(5, 7))}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
