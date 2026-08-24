/**
 * The visual vocabulary Analytics is built from (§2.0–§2.2).
 *
 * The mandate is "no tab renders a data grid" — every panel is a shape. The mandate's own escape
 * clause is what makes these safe: **every visual carries its data labels on the mark**, not hidden
 * in a tooltip, because this module's job is to be trusted under scrutiny and a number you have to
 * hover to read cannot be reconciled against an export.
 *
 * Server components on purpose. Nothing here needs interaction, so nothing here ships JavaScript;
 * `EvolutionChart` stays a client component because its hover genuinely earns it.
 *
 * Deliberately not a charting library. The existing charts are hand-rolled SVG, adding one would put
 * ~100KB in front of a screen a hotelier opens on a phone at the desk, and none of these shapes is
 * hard enough to justify it.
 */

const PALETTE = ["#2f5bd8", "#14b8a6", "#f59e0b", "#a855f7", "#ef4444", "#0ea5e9", "#84cc16", "#f43f5e"];

export function seriesColour(i: number): string {
  return PALETTE[i % PALETTE.length]!;
}

/* ------------------------------------------------------------------ bar list */

export interface BarDatum {
  label: string;
  /** Drives the bar length. */
  value: number;
  /** Printed at the end of the bar — the reconcilable number. */
  valueLabel: string;
  /** Optional secondary facts, printed under the label. */
  meta?: string;
  colour?: string;
}

/**
 * Horizontal bars, sorted by the caller, length proportional to value.
 *
 * Replaces the room-type and rate-plan tables (§2.2). Horizontal rather than vertical because the
 * categories are names of arbitrary length — a vertical bar chart of "Deluxe Double / Standard
 * Twin / Family Suite" spends its width rotating labels.
 *
 * A negative value cannot happen for revenue, and a zero-length bar for a real row reads as missing
 * data, so every row gets at least a sliver.
 */
export function BarList({ data, emptyMessage = "Nothing in this period." }: { data: BarDatum[]; emptyMessage?: string }) {
  if (data.length === 0) return <p className="px-4 py-6 text-[13px] text-ink-500">{emptyMessage}</p>;
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));

  return (
    <ul className="space-y-2.5 px-4 py-4">
      {data.map((d, i) => (
        <li key={d.label}>
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="truncate font-medium text-ink-800">{d.label}</span>
            <span className="tnum shrink-0 font-semibold text-ink-900">{d.valueLabel}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-sm bg-surface-sunken">
              <div
                className="h-full rounded-sm"
                style={{ width: `${Math.max(1.5, (Math.abs(d.value) / max) * 100)}%`, background: d.colour ?? seriesColour(i) }}
              />
            </div>
            {d.meta && <span className="tnum shrink-0 text-[11px] text-ink-400">{d.meta}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------------- donut */

export interface DonutSlice {
  label: string;
  value: number;
  valueLabel: string;
  /** e.g. a commission caveat — rendered beside the legend row, not inside the ring. */
  note?: string;
  noteTone?: "warning" | "muted";
  colour?: string;
}

/**
 * Composition — "where does my business come from" (§1.3, §2.2).
 *
 * A donut rather than the two fill-bars it replaces, because the question is genuinely about shares
 * of a whole and a bar-per-source loses the whole. Percentages sit in the legend rather than on the
 * arcs: a 3% slice has no room for its own label, and a chart where the small slices are unlabelled
 * is exactly the "decoration" the doc's bar forbids.
 */
export function Donut({ slices, centreLabel, centreSub }: { slices: DonutSlice[]; centreLabel: string; centreSub?: string }) {
  const total = slices.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (total <= 0) return <p className="px-4 py-6 text-[13px] text-ink-500">No revenue in this period.</p>;

  const R = 60, STROKE = 22, C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6 px-4 py-4">
      <svg viewBox="0 0 160 160" className="h-[160px] w-[160px] shrink-0" role="img" aria-label={`${centreLabel} by source`}>
        <g transform="translate(80,80) rotate(-90)">
          {slices.map((s, i) => {
            const share = Math.max(0, s.value) / total;
            const dash = share * C;
            const el = (
              <circle
                key={s.label} r={R} fill="none" strokeWidth={STROKE}
                stroke={s.colour ?? seriesColour(i)}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
        <text x="80" y="76" textAnchor="middle" className="fill-ink-900 text-[15px] font-bold">{centreLabel}</text>
        {centreSub && <text x="80" y="92" textAnchor="middle" className="fill-ink-400 text-[9px]">{centreSub}</text>}
      </svg>

      <ul className="min-w-[220px] flex-1 space-y-1.5">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-baseline gap-2 text-[12.5px]">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.colour ?? seriesColour(i) }} />
            <span className="flex-1 truncate text-ink-700">
              {s.label}
              {s.note && (
                <span className={`ml-1.5 text-[11px] ${s.noteTone === "warning" ? "font-medium text-warning-600" : "text-ink-400"}`}>
                  {s.note}
                </span>
              )}
            </span>
            <span className="tnum shrink-0 text-ink-400">{((Math.max(0, s.value) / total) * 100).toFixed(0)}%</span>
            <span className="tnum w-24 shrink-0 text-right font-semibold text-ink-900">{s.valueLabel}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------------- pace curve */

export interface PacePoint {
  date: string;
  soldNow: number;
  soldThen: number;
}

/**
 * The pace curve — "where is demand building, and where is it flat" (§2.2).
 *
 * The tab this replaces was a table of stay-date × sold-now × sold-at-snapshot × pickup, which is a
 * shape rendered as rows. Two lines with the gap between them shaded IS pickup, and one glance
 * answers the question the table made you compute per row.
 *
 * Green where positive, red where negative: a stay date that has LOST bookings since the snapshot is
 * the single most actionable cell on the tab and was invisible in the table.
 */
export function PaceCurve({ points, height = 200 }: { points: PacePoint[]; height?: number }) {
  if (points.length < 2) {
    return <p className="px-4 py-6 text-[13px] text-ink-500">Pace needs at least two days and one earlier snapshot to compare against.</p>;
  }

  const W = 1000, padL = 34, padR = 12, padT = 12, padB = 26;
  const plotW = W - padL - padR, plotH = height - padT - padB;
  const max = Math.max(1, ...points.map((p) => Math.max(p.soldNow, p.soldThen)));
  const top = Math.ceil(max * 1.15);
  const x = (i: number) => padL + (plotW * i) / (points.length - 1);
  const y = (v: number) => padT + plotH - (v / top) * plotH;

  const path = (pick: (p: PacePoint) => number) => points.map((p, i) => `${x(i)},${y(pick(p))}`).join(" ");
  // The band between the two lines, drawn as one polygon: forward along "now", back along "then".
  const band = [
    ...points.map((p, i) => `${x(i)},${y(p.soldNow)}`),
    ...[...points].reverse().map((p, i) => `${x(points.length - 1 - i)},${y(p.soldThen)}`),
  ].join(" ");

  const netPickup = points.reduce((s, p) => s + (p.soldNow - p.soldThen), 0);
  const bandColour = netPickup >= 0 ? "#16a34a" : "#ef4444";

  return (
    <div className="px-4 py-4">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[11.5px]">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#2f5bd8]" /> Sold now</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-ink-300" /> At snapshot</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm" style={{ background: bandColour, opacity: 0.18 }} />
          Pickup{" "}
          <span className="tnum font-semibold" style={{ color: bandColour }}>
            {netPickup >= 0 ? "+" : ""}{netPickup}
          </span>
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height: "auto" }} preserveAspectRatio="xMidYMid meet">
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={padT + plotH * g} y2={padT + plotH * g} stroke="#e4e7ec" strokeWidth={1} />
            <text x={padL - 6} y={padT + plotH * g + 4} textAnchor="end" className="fill-ink-400 text-[10px]">
              {Math.round(top * (1 - g))}
            </text>
          </g>
        ))}
        <polygon points={band} fill={bandColour} opacity={0.16} />
        <polyline points={path((p) => p.soldThen)} fill="none" stroke="#98a2b3" strokeWidth={1.5} strokeDasharray="4 3" />
        <polyline points={path((p) => p.soldNow)} fill="none" stroke="#2f5bd8" strokeWidth={2.5} />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.soldNow)} r={2.5} fill="#2f5bd8" />
        ))}
        {points.map((p, i) =>
          // Label every few points only — one label per day is unreadable across a 30-day horizon.
          i % Math.ceil(points.length / 8) === 0 ? (
            <text key={`l${p.date}`} x={x(i)} y={height - 8} textAnchor="middle" className="fill-ink-400 text-[10px]">
              {Number(p.date.slice(8, 10))}/{Number(p.date.slice(5, 7))}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

/* --------------------------------------------------------------- forward curve */

export interface ForwardPoint {
  date: string;
  value: number;
  label?: string;
}

/**
 * Committed demand across the horizon ahead (§2.2, On-the-books).
 *
 * Three jobs. It shows the shape of what is already sold; it complements the pace curve (pace is how
 * fast the books fill, this is the current position on them); and it defuses a trust trap — on sparse
 * data the 7-day and 30-day cards show identical totals, which is *correct* when every committed
 * night falls inside the first week, but reads as a failed recompute. The curve makes the clustering
 * self-evident, so the right numbers stop looking wrong.
 */
export function ForwardCurve({ points, height = 170, unitLabel }: { points: ForwardPoint[]; height?: number; unitLabel: string }) {
  if (points.length === 0) return <p className="px-4 py-6 text-[13px] text-ink-500">Nothing on the books yet.</p>;

  const W = 1000, padL = 30, padR = 10, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = height - padT - padB;
  const top = Math.max(1, Math.ceil(Math.max(...points.map((p) => p.value)) * 1.2));
  const barW = Math.max(2, (plotW / points.length) * 0.7);
  const x = (i: number) => padL + (plotW * (i + 0.5)) / points.length;
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const anyValue = points.some((p) => p.value > 0);

  return (
    <div className="px-4 py-4">
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{unitLabel}</div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height: "auto" }} preserveAspectRatio="xMidYMid meet">
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={padT + plotH * g} y2={padT + plotH * g} stroke="#e4e7ec" strokeWidth={1} />
            <text x={padL - 5} y={padT + plotH * g + 4} textAnchor="end" className="fill-ink-400 text-[10px]">
              {Math.round(top * (1 - g))}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <g key={p.date}>
            <rect
              x={x(i) - barW / 2} y={y(p.value)} width={barW} height={Math.max(0, padT + plotH - y(p.value))}
              rx={1.5} fill="#2f5bd8" opacity={p.value > 0 ? 0.85 : 0.15}
            />
            {/* Label only the peaks — labelling 30 bars is unreadable, labelling none breaks §2.0. */}
            {p.value > 0 && p.value >= top * 0.6 && (
              <text x={x(i)} y={y(p.value) - 4} textAnchor="middle" className="fill-ink-700 text-[9.5px] font-semibold">
                {p.value}
              </text>
            )}
            {i % Math.ceil(points.length / 10) === 0 && (
              <text x={x(i)} y={height - 7} textAnchor="middle" className="fill-ink-400 text-[10px]">
                {Number(p.date.slice(8, 10))}/{Number(p.date.slice(5, 7))}
              </text>
            )}
          </g>
        ))}
      </svg>
      {!anyValue && <p className="mt-1 text-[11.5px] text-ink-400">Nothing committed in this window yet.</p>}
    </div>
  );
}
