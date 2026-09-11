/**
 * A part-of-a-whole chart, for the one question that genuinely is one: where does the attention go.
 *
 * ## Why a donut here, when a pie is usually the wrong chart
 *
 * A pie is bad at comparison — people cannot judge angles, which is why "use a bar chart" is the
 * standard advice and usually right. It is good at exactly one thing: showing that a handful of
 * parts make up a whole, at a glance, without anybody reading a number. Usage split across three
 * products is that, and only that.
 *
 * So the shares are drawn AND printed. The ring gives the shape in one look; the legend beside it
 * gives the figures somebody can quote on a call. Neither is decoration for the other.
 *
 * ## Why the segments are strokes on one circle
 *
 * `stroke-dasharray` on a single `<circle>` rather than a stack of arc paths: no trigonometry, no
 * path-command string to get wrong, and a segment can never be drawn a fraction of a degree off its
 * neighbour. The only arithmetic is "what fraction of the circumference", which is the thing the
 * chart is actually about.
 */
export function Donut({
  slices,
  size = 132,
  thickness = 18,
  centreLabel,
  centreValue,
}: {
  slices: { label: string; value: number; colour: string; note?: string }[];
  size?: number;
  thickness?: number;
  centreLabel?: string;
  centreValue?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  if (total <= 0) {
    return (
      <p className="text-[12.5px] text-ink-500">
        Nothing recorded in this window yet.
      </p>
    );
  }

  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={
          slices.map((s) => `${s.label}: ${Math.round((s.value / total) * 100)}%`).join(", ")
        }>
          {/* The track, so a single-product platform still reads as a ring rather than a line. */}
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7eaef" strokeWidth={thickness} />
          {slices.map((s) => {
            const length = (s.value / total) * circumference;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.colour}
                strokeWidth={thickness}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                // Starts at twelve o'clock and runs clockwise, which is how everybody reads a dial.
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += length;
            return el;
          })}
        </svg>
        {centreValue && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="tnum text-[18px] font-bold leading-none text-ink-900">{centreValue}</span>
            {centreLabel && (
              <span className="mt-1 text-[10px] uppercase tracking-wide text-ink-400">{centreLabel}</span>
            )}
          </div>
        )}
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-baseline gap-2.5">
            <span
              aria-hidden="true"
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: s.colour }}
            />
            <span className="min-w-0 flex-1">
              <span className="text-[13px] font-semibold text-ink-900">{s.label}</span>
              {s.note && <span className="ml-2 text-[11.5px] text-ink-400">{s.note}</span>}
            </span>
            {/* Printed as well as drawn: the ring is for the shape, this is for the call. */}
            <span className="tnum shrink-0 text-[13px] font-semibold text-ink-700">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
