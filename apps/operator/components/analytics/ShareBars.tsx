/**
 * A breakdown as proportional bars, with a legend and a reason on hover.
 *
 * ## ⚠️ Colour is IDENTITY here, never severity
 *
 * Nothing on this chart is good or bad. Direct traffic is not better than referral; a phone is not
 * worse than a desktop. So the palette is a set of distinguishable hues with no green-to-red
 * gradient anywhere — a red slice would read as a problem, and "17% of your readers are on a phone"
 * is not a problem.
 *
 * The one exception is deliberate and labelled: **Unattributed** is always grey, because it is the
 * only category that means "we do not know" rather than naming something.
 *
 * ## Every bar says what it is without being hovered
 *
 * The label, the share and the count are printed. `title` adds the sentence a number cannot carry —
 * what the category actually means — so hovering explains rather than reveals. A chart that hides
 * its values until the pointer arrives is a chart nobody can read in a screenshot.
 */

/** Identity hues. Ordered so adjacent bars never share a family. */
const PALETTE = ["#4f46e5", "#0e7490", "#047857", "#b45309", "#7c3aed", "#be123c", "#0f766e", "#a16207"];
const UNKNOWN = "#64748b";

export function colourFor(label: string, index: number): string {
  return label === "Unattributed" || label === "Everything else" ? UNKNOWN : PALETTE[index % PALETTE.length];
}

export function ShareBars({
  rows,
  meanings = {},
  unit = "sessions",
}: {
  rows: { label: string; people: number; sessions: number }[];
  /** What a category means, shown on hover. Keyed by label. */
  meanings?: Record<string, string>;
  unit?: string;
}) {
  const total = rows.reduce((s, r) => s + r.sessions, 0);
  if (!rows.length) {
    return <p className="py-3 text-[12.5px] text-ink-500">Nothing recorded in this period.</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => {
        const pct = total ? Math.round((r.sessions / total) * 1000) / 10 : 0;
        const colour = colourFor(r.label, i);
        return (
          <div
            key={r.label}
            title={`${r.label} — ${r.sessions} ${unit}, ${r.people} people, ${pct}% of the period.${
              meanings[r.label] ? ` ${meanings[r.label]}` : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="flex items-center gap-2 text-ink-800">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colour }} />
                {r.label}
              </span>
              <span className="tnum shrink-0 text-ink-500">
                {r.sessions} · {pct}%
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colour }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
