"use client";

import { useState } from "react";

export type EvoBucket = { label: string; rnNow: number; rnThen: number; adrNow: number; adrThen: number };

const BLUE = "#2f5bd8", TEAL = "#14b8a6", AMBER = "#f59e0b", RED = "#ef4444";

/**
 * Combined bar + line evolution chart (CRS-REFINEMENT-R2 §2.4) with an interactive hover tooltip
 * (Analytics polish). Grouped Room-night bars (this period vs comparison) on the left axis, ADR lines
 * on the right — hovering a bucket lights a vertical guide and floats a tooltip with exact values +
 * the delta vs the comparison basis. Client component so the hover is live.
 */
export function EvolutionChart({ data, currency, basisLabel }: { data: EvoBucket[]; currency: string; basisLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000, H = 300, padL = 44, padR = 48, padT = 16, padB = 46;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = data.length;
  const rnMax = Math.max(1, ...data.map((d) => Math.max(d.rnNow, d.rnThen)));
  const adrMax = Math.max(1, ...data.map((d) => Math.max(d.adrNow, d.adrThen)));
  const niceMax = (v: number) => { const step = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / step) * step; };
  const rnTop = niceMax(rnMax), adrTop = niceMax(adrMax);
  const step = plotW / n;
  const barW = Math.min(18, step * 0.3);
  const yRn = (v: number) => padT + plotH - (v / rnTop) * plotH;
  const yAdr = (v: number) => padT + plotH - (v / adrTop) * plotH;
  const cx = (i: number) => padL + step * i + step / 2;
  const line = (pick: (d: EvoBucket) => number) => data.map((d, i) => `${cx(i)},${yAdr(pick(d))}`).join(" ");
  const gridVals = [0, 0.25, 0.5, 0.75, 1];

  const money = (v: number) => `${currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : currency + " "}${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const pctDelta = (now: number, then: number) => (then <= 0 ? null : `${now >= then ? "+" : ""}${(((now - then) / then) * 100).toFixed(0)}%`);
  const hd = hover != null ? data[hover] : null;
  // Position the tooltip near the hovered bucket, flipping to the left half when near the right edge.
  const hoverLeftPct = hover != null ? (cx(hover) / W) * 100 : 0;
  const flip = hoverLeftPct > 60;

  return (
    <div className="relative px-4 py-4">
      <div className="mb-1 flex justify-between text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
        <span>Room-nights</span><span>ADR ({currency})</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ height: "auto" }} preserveAspectRatio="xMidYMid meet">
        {gridVals.map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={padT + plotH * (1 - g)} y2={padT + plotH * (1 - g)} stroke="#e9edf3" strokeWidth={1} />
            <text x={padL - 6} y={padT + plotH * (1 - g) + 3} textAnchor="end" className="fill-[#98a2b3]" fontSize={10}>{Math.round(rnTop * g)}</text>
            <text x={W - padR + 6} y={padT + plotH * (1 - g) + 3} textAnchor="start" className="fill-[#98a2b3]" fontSize={10}>{Math.round(adrTop * g)}</text>
          </g>
        ))}
        {/* hovered-bucket vertical guide */}
        {hover != null && <rect x={padL + step * hover} y={padT} width={step} height={plotH} className="fill-[#2f5bd8]" opacity={0.06} />}
        {/* grouped room-night bars: comparison (teal) + current (blue) */}
        {data.map((d, i) => (
          <g key={i} opacity={hover == null || hover === i ? 1 : 0.55}>
            <rect x={cx(i) - barW - 1} y={yRn(d.rnThen)} width={barW} height={Math.max(0, padT + plotH - yRn(d.rnThen))} rx={2} fill={TEAL} opacity={0.85} />
            <rect x={cx(i) + 1} y={yRn(d.rnNow)} width={barW} height={Math.max(0, padT + plotH - yRn(d.rnNow))} rx={2} fill={BLUE} />
            <text x={cx(i)} y={H - padB + 16} textAnchor="middle" className="fill-[#98a2b3]" fontSize={9.5}>{d.label.replace("wk ", "")}</text>
          </g>
        ))}
        {/* ADR lines: comparison (red) + current (amber) */}
        <polyline points={line((d) => d.adrThen)} fill="none" stroke={RED} strokeWidth={2} strokeLinejoin="round" opacity={0.85} />
        <polyline points={line((d) => d.adrNow)} fill="none" stroke={AMBER} strokeWidth={2.5} strokeLinejoin="round" />
        {data.map((d, i) => <circle key={`m-${i}`} cx={cx(i)} cy={yAdr(d.adrNow)} r={hover === i ? 4.5 : 3} className="fill-white" stroke={AMBER} strokeWidth={2} />)}
        {/* invisible hover bands — one per bucket — drive the tooltip */}
        {data.map((_, i) => (
          <rect key={`h-${i}`} x={padL + step * i} y={0} width={step} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }} />
        ))}
      </svg>

      {/* Floating tooltip */}
      {hd && (
        <div
          className="pointer-events-none absolute top-8 z-10 w-44 rounded-lg border border-surface-border bg-white p-2.5 text-[11.5px] shadow-lg"
          style={flip ? { right: `${100 - hoverLeftPct + 2}%` } : { left: `${hoverLeftPct + 2}%` }}
        >
          <div className="mb-1.5 font-semibold text-ink-900">{hd.label}</div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-ink-500"><span className="h-2 w-2 rounded-sm" style={{ background: BLUE }} /> Room-nights</span>
              <span className="tnum font-semibold text-ink-900">{hd.rnNow}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-ink-400"><span className="h-2 w-2 rounded-sm" style={{ background: TEAL }} /> {basisLabel}</span>
              <span className="tnum text-ink-500">{hd.rnThen}{pctDelta(hd.rnNow, hd.rnThen) != null && <span className={hd.rnNow >= hd.rnThen ? "ml-1 text-success-600" : "ml-1 text-danger-600"}>{pctDelta(hd.rnNow, hd.rnThen)}</span>}</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-surface-border/60 pt-1">
              <span className="flex items-center gap-1.5 text-ink-500"><span className="h-2 w-2 rounded-full" style={{ background: AMBER }} /> ADR</span>
              <span className="tnum font-semibold text-ink-900">{money(hd.adrNow)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-ink-400"><span className="h-2 w-2 rounded-full" style={{ background: RED }} /> {basisLabel}</span>
              <span className="tnum text-ink-500">{money(hd.adrThen)}{pctDelta(hd.adrNow, hd.adrThen) != null && <span className={hd.adrNow >= hd.adrThen ? "ml-1 text-success-600" : "ml-1 text-danger-600"}>{pctDelta(hd.adrNow, hd.adrThen)}</span>}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-[11px] text-ink-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BLUE }} /> Room-nights</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: TEAL }} /> Room-nights ({basisLabel})</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: AMBER }} /> ADR</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: RED }} /> ADR ({basisLabel})</span>
      </div>
    </div>
  );
}
